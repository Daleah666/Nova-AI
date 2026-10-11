#!/usr/bin/env python3
"""Create missing Unity .meta files for a package folder.

Unity needs a .meta file next to every file and folder inside a package, and
the GUID inside must never change once published. This script only *adds*
missing metas (existing ones are left alone), using a GUID derived from the
file's path so re-running it is deterministic.

    python3 tools/make_metas.py Packages/com.nova.vrfury2          # create
    python3 tools/make_metas.py Packages/com.nova.vrfury2 --check  # CI check
"""
import argparse
import hashlib
import os
import sys

SKIP_NAMES = {".DS_Store", "Thumbs.db", "__pycache__"}

TEMPLATE = """fileFormatVersion: 2
guid: {guid}
{body}"""

TAIL = """  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
"""

MONO = """MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
"""


def importer_for(path, is_dir):
    if is_dir:
        return "folderAsset: yes\nDefaultImporter:\n" + TAIL
    name = os.path.basename(path)
    ext = os.path.splitext(name)[1].lower()
    if ext == ".cs":
        return MONO
    if ext in (".asmdef", ".asmref"):
        return "AssemblyDefinitionImporter:\n" + TAIL
    if name == "package.json":
        return "PackageManifestImporter:\n" + TAIL
    if ext in (".md", ".txt", ".json", ".xml", ".yaml", ".yml", ".csv"):
        return "TextScriptImporter:\n" + TAIL
    return "DefaultImporter:\n" + TAIL


def guid_for(package_root, path):
    rel = os.path.relpath(path, os.path.dirname(os.path.abspath(package_root)))
    return hashlib.md5(rel.replace(os.sep, "/").encode("utf-8")).hexdigest()


def wanted_metas(package_root):
    root = os.path.abspath(package_root)
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames
                             if d not in SKIP_NAMES and not d.startswith(".") and not d.endswith("~"))
        for d in dirnames:
            yield os.path.join(dirpath, d), True
        for f in sorted(filenames):
            if f in SKIP_NAMES or f.startswith(".") or f.endswith(".meta"):
                continue
            yield os.path.join(dirpath, f), False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("package_root")
    ap.add_argument("--check", action="store_true", help="only report problems, exit 1 if any")
    args = ap.parse_args()

    missing, created = [], []
    for path, is_dir in wanted_metas(args.package_root):
        meta = path + ".meta"
        if os.path.exists(meta):
            continue
        missing.append(meta)
        if not args.check:
            with open(meta, "w", newline="\n") as fh:
                fh.write(TEMPLATE.format(guid=guid_for(args.package_root, path),
                                         body=importer_for(path, is_dir)))
            created.append(meta)

    orphans = []
    for dirpath, _, filenames in os.walk(os.path.abspath(args.package_root)):
        for f in filenames:
            if f.endswith(".meta") and not os.path.exists(os.path.join(dirpath, f[:-5])):
                orphans.append(os.path.join(dirpath, f))

    for m in created:
        print("created", os.path.relpath(m))
    for m in orphans:
        print("orphan meta (its file is gone):", os.path.relpath(m))
    if args.check:
        for m in missing:
            print("missing", os.path.relpath(m))
        if missing or orphans:
            sys.exit(1)
        print("all .meta files present")


if __name__ == "__main__":
    main()
