#!/usr/bin/env bash
# Downloads what compile_check.py needs into one folder:
#   unity/Editor/Data/...      managed DLLs from the Unity Linux editor (no license needed)
#   sdk/<version>/com.vrchat.* VRChat Avatars + Base SDK from the official VPM listing
#   upm/com.unity.*            Unity registry packages the VRChat SDK depends on
#
#   tools/compile-check/fetch_inputs.sh [output-folder]
#
# Env: SDK_VERSIONS (default "3.7.0 3.10.5"), SKIP_UNITY=1 to skip the ~1.5 GB editor download.
set -euo pipefail

OUT=${1:-$HOME/vrfury-compile-inputs}
SDK_VERSIONS=${SDK_VERSIONS:-"3.7.0 3.10.5"}
UNITY_VERSION=2022.3.22f1
UNITY_CHANGESET=887be4894c44
UA="VRFury2-compile-check/1.0"
UPM_PACKAGES=(
  com.unity.burst@1.8.7 com.unity.collections@2.1.4 com.unity.mathematics@1.2.6
  com.unity.nuget.newtonsoft-json@3.2.1 com.unity.timeline@1.7.6 com.unity.xr.management@4.3.3
  com.unity.xr.oculus@4.0.0 com.unity.xr.legacyinputhelpers@2.1.10 com.unity.postprocessing@3.2.2
  com.unity.test-framework@1.1.33 com.unity.ext.nunit@1.0.6
)

mkdir -p "$OUT"
cd "$OUT"

if [ -z "${SKIP_UNITY:-}" ] && [ ! -d unity/Editor/Data/Managed ]; then
  echo "Downloading Unity $UNITY_VERSION (managed DLLs only are kept)…"
  mkdir -p unity
  curl -fL "https://download.unity3d.com/download_unity/$UNITY_CHANGESET/LinuxEditorInstaller/Unity-$UNITY_VERSION.tar.xz" \
    | tar -xJ -C unity \
        Editor/Data/Managed \
        Editor/Data/NetStandard \
        Editor/Data/UnityReferenceAssemblies \
        Editor/Data/Resources/PackageManager/BuiltInPackages
fi

for spec in "${UPM_PACKAGES[@]}"; do
  name=${spec%@*}; version=${spec#*@}
  [ -f "upm/$name/package.json" ] && continue
  echo "Downloading $name $version"
  mkdir -p "upm/$name"
  curl -fsSL "https://download.packages.unity.com/$name/-/$name-$version.tgz" \
    | tar -xz -C "upm/$name" --strip-components=1
done

curl -fsSL -A "$UA" -o official.json "https://packages.vrchat.com/official?download"
for version in $SDK_VERSIONS; do
  for name in com.vrchat.base com.vrchat.avatars; do
    dest="sdk/$version/$name"
    [ -f "$dest/package.json" ] && continue
    url=$(python3 -c 'import json,sys; print(json.load(open("official.json"))["packages"][sys.argv[1]]["versions"][sys.argv[2]]["url"])' "$name" "$version")
    echo "Downloading $name $version"
    mkdir -p "$dest"
    curl -fsSL -A "$UA" -o "$dest.zip" "$url"
    python3 -c 'import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' "$dest.zip" "$dest"
    rm "$dest.zip"
  done
done

echo "Inputs are in $OUT"
