#!/usr/bin/env bash
# Install aster-cli v0.1.1 from this repository's GitHub Release.
#
# One command:
#   curl -fsSL https://raw.githubusercontent.com/aster-ai-lab/aster/main/scripts/install.sh | bash -s -- --prefix "$HOME/.local/bin"
#
# The release page is:
#   https://github.com/aster-ai-lab/aster/releases/tag/aster-cli-v0.1.1
# macOS downloads aster-cli-v0.1.1-macos.tar.gz.
# Linux downloads aster-cli-v0.1.1-linux.tar.gz.
# Windows downloads aster-cli-v0.1.1-windows.zip.
# Each archive contains aster and a3s-code-acp.
# The command does not clone this repository and does not compile.
set -euo pipefail

official_base="https://github.com/aster-ai-lab/aster/releases/download/aster-cli-v0.1.1"

usage() {
  echo "Usage: install.sh [--prefix DIR]" >&2
  echo "https://raw.githubusercontent.com/aster-ai-lab/aster/main/scripts/install.sh" >&2
  echo "${official_base}/aster-cli-v0.1.1-macos.tar.gz" >&2
  exit 2
}

refuse() {
  echo "error: this installer does not download that binary" >&2
  exit 1
}

if [[ -n "${ASTER_INSTALL_URL:-}" || -n "${GROK_INSTALL_URL:-}" ]]; then
  refuse
fi

prefix=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix)
      shift
      [[ $# -gt 0 ]] || usage
      prefix="$1"
      ;;
    --prefix=*)
      prefix="${1#--prefix=}"
      ;;
    -h|--help)
      usage
      ;;
    *://*)
      case "$1" in
        "https://github.com/aster-ai-lab/aster/releases/download/aster-cli-v0.1.1/aster-cli-v0.1.1-macos.tar.gz"|"https://github.com/aster-ai-lab/aster/releases/download/aster-cli-v0.1.1/aster-cli-v0.1.1-linux.tar.gz"|"https://github.com/aster-ai-lab/aster/releases/download/aster-cli-v0.1.1/aster-cli-v0.1.1-windows.zip")
          ;;
        *)
          refuse
          ;;
      esac
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage
      ;;
  esac
  shift
done

case "$prefix" in
  *://*) refuse ;;
esac

uname_s="$(uname -s 2>/dev/null || true)"
case "$uname_s" in
  Darwin) platform=macos ;;
  Linux) platform=linux ;;
  MINGW*|MSYS*|CYGWIN*) platform=windows ;;
  *)
    if [[ "${OS:-}" == "Windows_NT" ]]; then
      platform=windows
    else
      echo "error: unsupported platform: ${uname_s:-unknown}" >&2
      exit 1
    fi
    ;;
esac

case "$platform" in
  windows) asset_name="aster-cli-v0.1.1-windows.zip" ;;
  *) asset_name="aster-cli-v0.1.1-${platform}.tar.gz" ;;
esac

base="${ASTER_RELEASE_BASE:-$official_base}"
case "$base" in
  *x.ai*) refuse ;;
esac
if [[ "$base" == "$official_base" ]]; then
  asset_url="${base}/${asset_name}"
  local_asset=""
elif [[ "$base" != *://* && -d "$base" ]]; then
  asset_url="${base}/${asset_name}"
  local_asset="$asset_url"
else
  refuse
fi

if [[ -z "$prefix" ]]; then
  prefix="${HOME}/.local/bin"
fi

work="$(mktemp -d)"
cleanup() { rm -rf "$work"; }
trap cleanup EXIT
archive="${work}/${asset_name}"
echo "platform=${platform}"
echo "release=aster-cli-v0.1.1"
echo "asset=${asset_url}"

if [[ -n "$local_asset" ]]; then
  cp -f "$local_asset" "$archive"
else
  curl -fsSL --retry 3 --retry-delay 2 -o "$archive" "$asset_url"
fi

unpack="${work}/unpack"
mkdir -p "$unpack"
case "$asset_name" in
  *.tar.gz)
    tar -C "$unpack" -xzf "$archive"
    src_aster="${unpack}/aster"
    src_acp="${unpack}/a3s-code-acp"
    dest_aster="${prefix}/aster"
    dest_acp="${prefix}/a3s-code-acp"
    ;;
  *.zip)
    if command -v python3 >/dev/null 2>&1; then
      py=(python3)
    elif command -v python >/dev/null 2>&1; then
      py=(python)
    else
      echo "error: extracting the Windows archive needs python" >&2
      exit 1
    fi
    "${py[@]}" - "$archive" "$unpack" <<'PY'
import sys, zipfile
zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])
PY
    src_aster="${unpack}/aster.exe"
    src_acp="${unpack}/a3s-code-acp.exe"
    dest_aster="${prefix}/aster.exe"
    dest_acp="${prefix}/a3s-code-acp.exe"
    ;;
esac

if [[ ! -f "$src_aster" || ! -f "$src_acp" ]]; then
  echo "error: archive ${asset_name} did not contain both aster-cli binaries" >&2
  exit 1
fi

mkdir -p "$prefix"
cp -f "$src_aster" "$dest_aster"
cp -f "$src_acp" "$dest_acp"
chmod 755 "$dest_aster" "$dest_acp"
if [[ "$platform" == "macos" ]] && command -v xattr >/dev/null 2>&1; then
  xattr -d com.apple.quarantine "$dest_aster" 2>/dev/null || true
  xattr -d com.apple.quarantine "$dest_acp" 2>/dev/null || true
fi

echo "installed Aster v0.1.1 into ${prefix}"
echo "aster=${dest_aster}"
echo "a3s-code-acp=${dest_acp}"
