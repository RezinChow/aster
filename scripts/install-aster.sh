#!/usr/bin/env bash
# Install Aster v0.1.0 and the sibling ACP agent from this repository.
#
# One command from any directory. The script address is:
#   https://raw.githubusercontent.com/aster-ai-lab/aster/main/scripts/install-aster.sh
# When this file is not already inside a checkout, it clones
#   https://github.com/aster-ai-lab/aster.git
# into $HOME/src/aster (or $ASTER_REPO) and runs that copy.
# From an existing checkout, pass this file by its absolute path.
#
# Platforms:
#   macOS  (uname Darwin) — locked release, then copy aster and a3s-code-acp
#   Linux  (uname Linux)  — locked release, then copy aster and a3s-code-acp
#   Windows (MINGW, MSYS, Cygwin, or OS=Windows_NT) — scripts/install-aster.ps1
#
# The command runs `cargo build --locked --release` in this workspace.
# It copies both binaries into one directory. It does not download a CLI
# binary, and it does not enable auto-update. Rebuild this tree to upgrade.
set -euo pipefail
source_file="${BASH_SOURCE[0]:-}"

usage() {
  echo "Usage: install-aster.sh [--prefix DIR]" >&2
  echo "https://raw.githubusercontent.com/aster-ai-lab/aster/main/scripts/install-aster.sh" >&2
  exit 2
}

refuse_download() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      *://*)
        echo "error: this installer does not download binaries" >&2
        exit 1
        ;;
    esac
  done
  if [[ -n "${ASTER_INSTALL_URL:-}" || -n "${GROK_INSTALL_URL:-}" ]]; then
    echo "error: this installer does not download binaries" >&2
    exit 1
  fi
}

prefix=""
orig_args=("$@")
refuse_download "$@"
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
    *)
      echo "error: unknown argument: $1" >&2
      usage
      ;;
  esac
  shift
done
refuse_download "$prefix"

repo_root=""
if [[ -n "$source_file" && -f "$source_file" ]]; then
  script_dir="$(cd "$(dirname "$source_file")" && pwd)"
  candidate="$(cd "${script_dir}/.." && pwd)"
  if [[ -f "${candidate}/Cargo.toml" && -f "${script_dir}/install-aster.sh" ]]; then
    repo_root="$candidate"
  fi
fi
if [[ -z "$repo_root" ]]; then
  if [[ -z "${ASTER_REPO:-}" && -z "${HOME:-}" ]]; then
    echo "error: HOME is unset; set ASTER_REPO to the checkout path" >&2
    exit 1
  fi
  repo_root="${ASTER_REPO:-${HOME}/src/aster}"
  if [[ -e "$repo_root" && ! -d "${repo_root}/.git" ]]; then
    echo "error: ${repo_root} exists and is not an Aster checkout" >&2
    exit 1
  fi
  if [[ ! -d "${repo_root}/.git" ]]; then
    mkdir -p "$(dirname "$repo_root")"
    git clone --depth 1 --branch main "https://github.com/aster-ai-lab/aster.git" "$repo_root"
  else
    git -C "$repo_root" pull --ff-only
  fi
  if [[ ${#orig_args[@]} -eq 0 ]]; then
    exec "${repo_root}/scripts/install-aster.sh"
  fi
  exec "${repo_root}/scripts/install-aster.sh" "${orig_args[@]}"
fi

uname_s="$(uname -s 2>/dev/null || true)"
case "$uname_s" in
  Darwin)
    platform=macos
    ;;
  Linux)
    platform=linux
    ;;
  MINGW*|MSYS*|CYGWIN*)
    platform=windows
    ;;
  *)
    if [[ "${OS:-}" == "Windows_NT" ]]; then
      platform=windows
    else
      echo "error: unsupported platform: ${uname_s:-unknown}" >&2
      exit 1
    fi
    ;;
esac

if [[ "$platform" == "windows" ]]; then
  ps1="$repo_root/scripts/install-aster.ps1"
  if command -v powershell.exe >/dev/null 2>&1; then
    runner=(powershell.exe)
  elif command -v pwsh >/dev/null 2>&1; then
    runner=(pwsh)
  else
    echo "error: Windows install needs PowerShell" >&2
    exit 1
  fi
  if [[ -n "$prefix" ]]; then
    exec "${runner[@]}" -NoProfile -ExecutionPolicy Bypass -File "$ps1" -Prefix "$prefix"
  fi
  exec "${runner[@]}" -NoProfile -ExecutionPolicy Bypass -File "$ps1"
fi

if [[ -z "$prefix" ]]; then
  prefix="${HOME}/.local/bin"
fi

cd "$repo_root"
# Package version 0.1.0 comes from apps/aster. A leftover upstream version
# variable must not stamp this binary, and no update feature is enabled.
# The commit stamp is the revision at the start of this command, so a commit
# that lands while cargo is compiling does not change this install's version.
commit="${ASTER_INSTALL_COMMIT:-}"
if [[ -z "$commit" ]]; then
  commit="$(git -C "$repo_root" rev-parse HEAD 2>/dev/null || true)"
fi
if [[ -n "$commit" ]]; then
  env -u GROK_VERSION GROK_COMMIT="$commit" cargo build --locked --release
else
  env -u GROK_VERSION -u GROK_COMMIT cargo build --locked --release
fi

if [[ -n "${CARGO_TARGET_DIR:-}" ]]; then
  release_dir="${CARGO_TARGET_DIR}/release"
else
  release_dir="${repo_root}/target/release"
fi
src_aster="${release_dir}/aster"
src_acp="${release_dir}/a3s-code-acp"
if [[ ! -f "$src_aster" || ! -f "$src_acp" ]]; then
  echo "error: locked release did not emit aster and a3s-code-acp in ${release_dir}" >&2
  exit 1
fi

mkdir -p "$prefix"
cp -f "$src_aster" "${prefix}/aster"
cp -f "$src_acp" "${prefix}/a3s-code-acp"
chmod 755 "${prefix}/aster" "${prefix}/a3s-code-acp"

echo "platform=${platform}"
echo "installed Aster v0.1.0 into ${prefix}"
echo "aster=${prefix}/aster"
echo "a3s-code-acp=${prefix}/a3s-code-acp"
