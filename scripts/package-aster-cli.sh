#!/usr/bin/env bash
# Pack the two aster-cli release binaries into one archive.
# Usage: scripts/package-aster-cli.sh <macos|linux|windows> <bin-dir> <out-file>
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: scripts/package-aster-cli.sh <macos|linux|windows> <bin-dir> <out-file>" >&2
  exit 2
fi

platform="$1"
bin_dir="$2"
out="$3"
stage="$(mktemp -d)"
cleanup() { rm -rf "$stage"; }
trap cleanup EXIT

copy_file() {
  local src="$1"
  local dest="$2"
  if [[ ! -f "$src" ]]; then
    echo "error: missing ${src}" >&2
    exit 1
  fi
  cp -f "$src" "$dest"
}

case "$platform" in
  macos|linux)
    copy_file "${bin_dir}/aster" "${stage}/aster"
    copy_file "${bin_dir}/a3s-code-acp" "${stage}/a3s-code-acp"
    chmod 755 "${stage}/aster" "${stage}/a3s-code-acp"
    COPYFILE_DISABLE=1 tar -C "$stage" -czf "$out" aster a3s-code-acp
    ;;
  windows)
    copy_file "${bin_dir}/aster.exe" "${stage}/aster.exe"
    copy_file "${bin_dir}/a3s-code-acp.exe" "${stage}/a3s-code-acp.exe"
    if command -v python3 >/dev/null 2>&1; then
      py=(python3)
    elif command -v python >/dev/null 2>&1; then
      py=(python)
    else
      echo "error: packaging the Windows archive needs python" >&2
      exit 1
    fi
    "${py[@]}" - "$stage" "$out" <<'PY'
import sys, zipfile
from pathlib import Path
stage, out = Path(sys.argv[1]), Path(sys.argv[2])
with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for name in ("aster.exe", "a3s-code-acp.exe"):
        archive.write(stage / name, name)
PY
    ;;
  *)
    echo "error: unsupported platform: ${platform}" >&2
    exit 1
    ;;
esac
