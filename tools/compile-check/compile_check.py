#!/usr/bin/env python3
"""Compile-check Unity asmdef assemblies without the Unity Editor.

Mirrors the parts of Unity's script compilation that matter for catching
compile errors: asmdef discovery, per-assembly source ownership, asmdef
references, versionDefines, editor-enabled precompiled plugins (from .meta),
Unity's scripting defines, and Roslyn with -nostdlib against the editor's
managed DLLs. It does not run the Unity serializer, ILPP, or analyzers.

See tools/compile-check/README.md for how to fetch the inputs.
"""

import argparse
import json
import os
import re
import struct
import subprocess
import sys
from pathlib import Path

UNITY_DEFINES = [
    "UNITY_EDITOR", "UNITY_EDITOR_64", "UNITY_EDITOR_WIN",
    "UNITY_STANDALONE_WIN", "UNITY_STANDALONE", "PLATFORM_STANDALONE_WIN", "PLATFORM_STANDALONE",
    "UNITY_64", "PLATFORM_ARCH_64", "ENABLE_MONO", "ENABLE_LEGACY_INPUT_MANAGER",
    "UNITY_POST_PROCESSING_STACK_V2", "UNITY_ASSERTIONS", "DEBUG", "TRACE",
    "ENABLE_AUDIO", "ENABLE_CACHING", "ENABLE_CLOTH", "ENABLE_MICROPHONE", "ENABLE_MULTIPLE_DISPLAYS",
    "ENABLE_PHYSICS", "ENABLE_TEXTURE_STREAMING", "ENABLE_VIRTUALTEXTURING", "ENABLE_LZMA",
    "ENABLE_UNITYEVENTS", "ENABLE_VR", "ENABLE_WEBCAM", "ENABLE_UNITYWEBREQUEST", "ENABLE_WWW",
    "ENABLE_CLOUD_SERVICES", "ENABLE_DIRECTOR", "ENABLE_UNET", "ENABLE_SPATIALTRACKING",
    "ENABLE_MANAGED_JOBS", "ENABLE_MANAGED_TRANSFORM_JOBS", "ENABLE_MANAGED_ANIMATION_JOBS",
    "ENABLE_MANAGED_AUDIO_JOBS", "ENABLE_RUNTIME_GI", "ENABLE_GAMECENTER", "ENABLE_NETWORK",
    "ENABLE_CRUNCH_TEXTURE_COMPRESSION", "ENABLE_OUT_OF_PROCESS_CRASH_HANDLER",
    "CSHARP_7_3_OR_NEWER", "CSHARP_7_OR_LATER", "UNITY_INCLUDE_TESTS",
]


def version_defines(unity_version):
    m = re.match(r"(\d+)\.(\d+)\.(\d+)", unity_version)
    major, minor, patch = (int(x) for x in m.groups())
    out = [f"UNITY_{major}", f"UNITY_{major}_{minor}", f"UNITY_{major}_{minor}_{patch}"]
    for v in ["5_3", "5_4", "5_5", "5_6"]:
        out.append(f"UNITY_{v}_OR_NEWER")
    for y in range(2017, major + 1):
        for mi in range(1, 5):
            if y == major and mi > minor:
                break
            out.append(f"UNITY_{y}_{mi}_OR_NEWER")
        out.append(f"UNITY_{y}_1_OR_NEWER")
    return sorted(set(out))


def parse_version(v):
    parts = re.findall(r"\d+", v or "0")
    return tuple(int(p) for p in (parts + ["0", "0", "0"])[:3])


def version_matches(expr, version):
    """Unity versionDefines expression: '' = any, 'x.y.z' = >=, '[a,b)' style intervals."""
    if version is None:
        return False
    expr = (expr or "").strip()
    if not expr:
        return True
    v = parse_version(version)
    if expr[0] in "[(":
        lo_inc, hi_inc = expr[0] == "[", expr[-1] == "]"
        inner = expr[1:-1]
        if "," not in inner:
            return v == parse_version(inner)
        lo, hi = (s.strip() for s in inner.split(",", 1))
        if lo and (v < parse_version(lo) or (v == parse_version(lo) and not lo_inc)):
            return False
        if hi and (v > parse_version(hi) or (v == parse_version(hi) and not hi_inc)):
            return False
        return True
    return v >= parse_version(expr)


def is_managed_dll(path):
    try:
        with open(path, "rb") as f:
            data = f.read(4096)
        if data[:2] != b"MZ":
            return False
        pe = struct.unpack_from("<I", data, 0x3C)[0]
        if data[pe:pe + 4] != b"PE\0\0":
            return False
        opt = pe + 24
        magic = struct.unpack_from("<H", data, opt)[0]
        dd = opt + (96 if magic == 0x10B else 112)
        clr_rva = struct.unpack_from("<I", data, dd + 14 * 8)[0]
        return clr_rva != 0
    except Exception:
        return False


def plugin_editor_flags(dll):
    """Return (editor_enabled, explicitly_referenced) from a PluginImporter .meta."""
    meta = Path(str(dll) + ".meta")
    if not meta.exists():
        return True, False
    text = meta.read_text(errors="ignore")
    explicit = re.search(r"isExplicitlyReferenced:\s*1", text) is not None
    if "PluginImporter" not in text:
        return True, explicit
    blocks = re.split(r"\n\s*(?:- first:|data:\s*\n\s*first:)\s*\n", text)
    any_enabled, exclude_editor, editor_enabled = None, None, None
    for b in blocks[1:]:
        head = b.strip().splitlines()[0].strip()
        enabled = re.search(r"enabled:\s*(\d)", b)
        enabled = enabled is not None and enabled.group(1) == "1"
        if head.startswith("Editor: Editor"):
            editor_enabled = enabled
        elif head.startswith("Any:"):
            any_enabled = enabled
        elif head.startswith("'': Any"):
            m = re.search(r"Exclude Editor:\s*(\d)", b)
            if m:
                exclude_editor = m.group(1) == "1"
    # With "Any Platform" on, Unity ignores per-platform flags and only honors exclusions.
    if any_enabled:
        return not exclude_editor, explicit
    return bool(editor_enabled), explicit


class Asm:
    def __init__(self, path, data, guid):
        self.path = Path(path)
        self.dir = self.path.parent
        self.data = data
        self.name = data["name"]
        self.guid = guid
        self.sources = []

    def get(self, key, default=None):
        return self.data.get(key, default)


def find_package_root(p, package_roots):
    p = Path(p).resolve()
    for root in package_roots:
        try:
            p.relative_to(root)
            return root
        except ValueError:
            continue
    return None


def ignored(path, root):
    rel = Path(path).relative_to(root)
    for part in rel.parts[:-1]:
        if part.endswith("~") or part.startswith("."):
            return True
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--unity", required=True, help="Path to <Unity>/Editor/Data")
    ap.add_argument("--unity-version", default="2022.3.22f1")
    ap.add_argument("--packages", nargs="+", required=True, help="Package root folders (each has package.json)")
    ap.add_argument("--target", nargs="+", required=True, help="Assembly names to compile (dependencies are built first)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--csc", required=True, help="Path to Roslyn csc.dll")
    ap.add_argument("--dotnet", default="dotnet")
    ap.add_argument("--player-api", choices=["netstandard21", "net48"], default="netstandard21",
                    help="Player API compatibility level, used for assemblies that are not editor-only")
    ap.add_argument("--langversion", default="9.0")
    ap.add_argument("--show-warnings-for", nargs="*", default=[], help="Assemblies whose warnings are printed")
    args = ap.parse_args()

    unity = Path(args.unity)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    package_roots = [Path(p).resolve() for p in args.packages]

    pkg_versions = {}
    for root in package_roots:
        pj = root / "package.json"
        if pj.exists():
            d = json.loads(pj.read_text(encoding="utf-8-sig"))
            pkg_versions[d["name"]] = d.get("version", "0.0.0")
    builtin = unity / "Resources/PackageManager/BuiltInPackages"
    if builtin.exists():
        for d in builtin.iterdir():
            if d.name.startswith("com.unity.modules."):
                pkg_versions.setdefault(d.name, "1.0.0")

    asms, by_guid, owners = {}, {}, {}
    for root in package_roots:
        for p in root.rglob("*.asmdef"):
            if ignored(p, root):
                continue
            data = json.loads(p.read_text(encoding="utf-8-sig"))
            guid = None
            meta = Path(str(p) + ".meta")
            if meta.exists():
                m = re.search(r"guid:\s*([0-9a-f]+)", meta.read_text())
                guid = m.group(1) if m else None
            a = Asm(p, data, guid)
            if a.name in asms:
                print(f"warning: duplicate asmdef {a.name} at {p}", file=sys.stderr)
            asms[a.name] = a
            if guid:
                by_guid[guid] = a
            owners[a.dir.resolve()] = a
    for root in package_roots:
        for p in root.rglob("*.asmref"):
            if ignored(p, root):
                continue
            data = json.loads(p.read_text(encoding="utf-8-sig"))
            ref = data.get("reference", "")
            target = by_guid.get(ref[5:]) if ref.startswith("GUID:") else asms.get(ref)
            if target:
                owners[p.parent.resolve()] = target

    for root in package_roots:
        for cs in root.rglob("*.cs"):
            if ignored(cs, root):
                continue
            d = cs.parent.resolve()
            while True:
                if d in owners:
                    owners[d].sources.append(cs)
                    break
                if d == root or d.parent == d:
                    break
                d = d.parent

    precompiled = []
    for root in package_roots:
        for dll in root.rglob("*.dll"):
            if ignored(dll, root) or not is_managed_dll(dll):
                continue
            enabled, explicit = plugin_editor_flags(dll)
            if enabled:
                precompiled.append((dll, explicit))

    # Same lists as UnityEditor.Scripting.ScriptCompilation.MonoLibraryHelpers (2022.3).
    ref48 = unity / "UnityReferenceAssemblies/unity-4.8-api"
    net48_names = ["mscorlib.dll", "System.dll", "System.Core.dll", "System.Runtime.Serialization.dll",
                   "System.Xml.dll", "System.Xml.Linq.dll", "System.Numerics.dll", "System.Numerics.Vectors.dll",
                   "System.Net.Http.dll", "System.IO.Compression.dll", "Microsoft.CSharp.dll", "System.Data.dll",
                   "System.Data.DataSetExtensions.dll", "System.Drawing.dll", "System.IO.Compression.FileSystem.dll",
                   "System.ComponentModel.Composition.dll", "System.Transactions.dll"]
    net48 = []
    for n in net48_names:
        for d in (ref48, ref48 / "Facades"):
            if (d / n).exists():
                net48.append(d / n)
                break
    net48 += sorted((ref48 / "Facades").glob("*.dll"))
    if not (ref48 / "mscorlib.dll").exists():
        sys.exit(f"missing {ref48}; extract Editor/Data/UnityReferenceAssemblies from the Unity install")
    ns = unity / "NetStandard"
    netstd = ([ns / "ref/2.1.0/netstandard.dll"] + sorted((ns / "compat/2.1.0/shims/netstandard").glob("*.dll"))
              + sorted((ns / "Extensions/2.0.0").glob("*.dll")) + sorted((ns / "compat/2.1.0/shims/netfx").glob("*.dll")))
    profiles = {
        "net48": (net48, ["NET_4_6", "NET_UNITY_4_8"]),
        "netstandard21": (netstd, ["NET_STANDARD_2_0", "NET_STANDARD_2_1", "NET_STANDARD"]),
    }
    engine = [p for p in sorted((unity / "Managed/UnityEngine").glob("*.dll")) if not p.name.startswith("Unity.Cecil")]
    engine.append(unity / "Managed/UnityEditor.Graphs.dll")

    # UnityEditor.Scripting.ScriptCompilation.AutoReferencedPackageAssemblies
    auto_refs = ["UnityEngine.UI", "UnityEditor.UI"]
    test_runner = ["UnityEngine.TestRunner", "UnityEditor.TestRunner"]
    auto_ignore = set(auto_refs) | set(test_runner)

    base_defines = UNITY_DEFINES + version_defines(args.unity_version)

    def is_editor_only(a):
        return a.get("includePlatforms", []) == ["Editor"]

    def editor_platform_ok(a):
        inc, exc = a.get("includePlatforms", []), a.get("excludePlatforms", [])
        if inc and "Editor" not in inc:
            return False
        if "Editor" in exc:
            return False
        return True

    def asm_profile(a):
        return profiles["net48" if is_editor_only(a) else args.player_api]

    def asm_defines(a):
        defs = list(base_defines) + asm_profile(a)[1]
        for vd in a.get("versionDefines", []):
            if version_matches(vd.get("expression", ""), pkg_versions.get(vd.get("name"))):
                defs.append(vd["define"])
        return defs

    def constraints_ok(a, defs):
        for c in a.get("defineConstraints", []):
            neg = c.startswith("!")
            sym = c[1:] if neg else c
            ok = all(s in defs for s in sym.split("||")) if "||" not in sym else any(s in defs for s in sym.split("||"))
            if neg == ok:
                return False
        return True

    def resolve(ref):
        if ref.startswith("GUID:"):
            return by_guid.get(ref[5:])
        return asms.get(ref)

    built, order, failed = {}, [], []
    visiting = set()

    def implicit_refs(a):
        out = []
        if a.name not in auto_ignore and not a.get("noEngineReferences", False):
            out += [n for n in auto_refs if n in asms]
        # UnityEditor.Scripting.ScriptCompilation.TestRunnerHelpers: editor-only assemblies get the test runner.
        if is_editor_only(a) and a.name not in test_runner and not set(a.get("references", [])) & set(test_runner):
            out += [n for n in test_runner if n in asms]
        return out

    def visit(name, chain):
        a = asms.get(name)
        if a is None:
            print(f"note: '{name}' (referenced by {chain[-1] if chain else '-'}) not found; Unity ignores missing references too")
            return
        if name in built or name in visiting:
            return
        visiting.add(name)
        for r in a.get("references", []):
            ra = resolve(r)
            if ra is None:
                print(f"note: '{r}' (referenced by {name}) not found; Unity ignores missing references too")
                continue
            visit(ra.name, chain + [name])
        for n in implicit_refs(a):
            visit(n, chain + [name])
        visiting.discard(name)
        order.append(a)
        built[name] = None

    for t in args.target:
        visit(t, [])

    outputs = {}
    total_errors = 0
    for a in order:
        if not editor_platform_ok(a):
            print(f"skip {a.name}: not an editor-platform assembly")
            continue
        defs = asm_defines(a)
        if not constraints_ok(a, defs):
            print(f"skip {a.name}: defineConstraints {a.get('defineConstraints')} not met")
            continue
        refs = list(asm_profile(a)[0])
        if not a.get("noEngineReferences", False):
            refs += engine
        ref_names = [ra.name for ra in (resolve(r) for r in a.get("references", [])) if ra is not None]
        for n in ref_names + implicit_refs(a):
            if n in outputs:
                refs.append(outputs[n])
        listed = set(a.get("precompiledReferences", []))
        override = a.get("overrideReferences", False)
        add_nunit = is_editor_only(a) and not (override and "nunit.framework.dll" in listed)
        for dll, explicit in precompiled:
            if dll.stem == a.name:
                continue
            if dll.name in listed or (not override and not explicit) or (add_nunit and dll.name == "nunit.framework.dll"):
                refs.append(dll)
        seen, uniq = set(), []
        for r in refs:
            key = Path(r).name.lower()
            if key in seen:
                continue
            seen.add(key)
            uniq.append(r)
        dll_out = out / f"{a.name}.dll"
        rsp = out / f"{a.name}.rsp"
        lines = [
            "-nostdlib+", "-noconfig", "-target:library", f"-out:{dll_out}",
            f"-langversion:{args.langversion}", "-nologo", "-deterministic", "-debug-",
            "-nowarn:0169,0649,0282,1701,1702", "-utf8output",
        ]
        if a.get("allowUnsafeCode", False):
            lines.append("-unsafe")
        lines.append("-define:" + ";".join(sorted(set(defs))))
        lines += [f'-r:"{r}"' for r in uniq]
        lines += [f'"{s}"' for s in sorted(a.sources)]
        rsp.write_text("\n".join(lines))
        if not a.sources:
            print(f"skip {a.name}: no sources")
            continue
        proc = subprocess.run([args.dotnet, args.csc, f"@{rsp}"], capture_output=True, text=True)
        diag = [l for l in proc.stdout.splitlines() if ": error " in l or ": warning " in l]
        errs = [l for l in diag if ": error " in l]
        warns = [l for l in diag if ": warning " in l]
        status = "OK" if proc.returncode == 0 else "FAILED"
        print(f"{status:6} {a.name}  ({len(a.sources)} files, {len(errs)} errors, {len(warns)} warnings)")
        if proc.returncode != 0:
            failed.append(a.name)
            total_errors += len(errs)
            for l in errs[:200]:
                print("   " + l)
            if not errs:
                print(proc.stdout[-4000:])
        else:
            outputs[a.name] = dll_out
        if a.name in args.show_warnings_for:
            for l in warns:
                print("   " + l)

    print()
    if failed:
        print(f"FAILED: {', '.join(failed)} ({total_errors} errors)")
        sys.exit(1)
    print("All assemblies compiled.")


if __name__ == "__main__":
    main()
