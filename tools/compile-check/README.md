# Compile check (no Unity needed)

`compile_check.py` compiles the package's C# against the real Unity 2022.3.22f1 editor DLLs and the real VRChat Avatars SDK. It does this without opening Unity or needing a Unity license, so it's a quick way to catch "this won't compile" mistakes, including SDK API changes.

It mirrors how Unity builds assemblies: asmdef discovery and references, versionDefines, editor-enabled precompiled plugins (read from their `.meta`), Unity's scripting defines, C# 9, and compiling against `unity-4.8-api`. It does **not** run Unity's serializer, IL post-processing or analyzers, and it doesn't run any code. Real behaviour still needs Unity (see [`docs/testing.md`](../../docs/testing.md)).

## Requirements

- Linux or macOS with Python 3.8+, `curl`, `tar` and `xz`
- .NET SDK 6 or newer, with `dotnet` on your `PATH`. It's used to run Roslyn's `csc.dll`. For example: `./dotnet-install.sh --channel 8.0`.

## 1. Fetch the inputs (once)

```bash
tools/compile-check/fetch_inputs.sh ~/vrfury-compile-inputs
```

This downloads the following:

- the Unity Linux editor, keeping only the managed DLLs (about 2.6 GB on disk);
- VRChat Base and Avatars SDK 3.7.0 and 3.10.5, from `packages.vrchat.com`;
- the Unity registry packages the SDK depends on.

Set `SDK_VERSIONS="3.10.5"` to test other SDK versions.

## 2. Run it

```bash
IN=~/vrfury-compile-inputs; U=$IN/unity/Editor/Data; SDK=3.10.5
python3 tools/compile-check/compile_check.py \
  --unity $U --unity-version 2022.3.22f1 \
  --csc ~/.dotnet/sdk/8.0.*/Roslyn/bincore/csc.dll \
  --out /tmp/vrfury-out-$SDK \
  --target VRFury2.Editor --show-warnings-for VRFury2.Editor \
  --packages $IN/sdk/$SDK/com.vrchat.base $IN/sdk/$SDK/com.vrchat.avatars $IN/upm/* \
             $U/Resources/PackageManager/BuiltInPackages/com.unity.ugui \
             $U/Resources/PackageManager/BuiltInPackages/nuget.mono-cecil \
             Packages/com.nova.vrfury2
```

It builds every assembly the target depends on first (the VRChat SDK's own source assemblies included), then the target. It prints one line per assembly with its error and warning counts, plus any errors, and exits non-zero if anything fails to compile. Lines starting with `note:` are references Unity also ignores when they're missing.

To sanity-check the checker itself, add a file with a deliberate mistake (for example `VRCSdkControlPanel.TryGetBuilder<int>(out _)`) and confirm it's reported.
