#!/usr/bin/env bash
# Copy one image into evidence/images and append VISION_LOG.md.
# Usage: scripts/ingest-evidence-image.sh /path/to/file.png [short-name]
set -euo pipefail

src="${1:-}"
if [[ -z "$src" || ! -f "$src" ]]; then
  echo "I could not read this. Pass an existing image path." >&2
  exit 1
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
dest_dir="$root/evidence/images"
mkdir -p "$dest_dir"

base="$(basename "$src")"
ext="${base##*.}"
short="${2:-${base%.*}}"
short="$(echo "$short" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9-' '-')"
stamp="$(date -u +%Y-%m-%d-%H%M%S)"
dest="$dest_dir/${stamp}-${short}.${ext}"

cp -n "$src" "$dest"
{
  echo
  echo "## ${stamp}Z — ingest"
  echo
  echo "- source: \`$src\`"
  echo "- vault: \`$dest\`"
  echo "- bytes: $(wc -c < "$src" | tr -d ' ')"
} >> "$root/evidence/VISION_LOG.md"

echo "saved $dest"
