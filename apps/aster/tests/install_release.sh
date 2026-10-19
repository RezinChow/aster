#!/usr/bin/env bash
# Drives scripts/install-aster.sh twice, each time into a fresh prefix.
# Also runs that command a second time on the first prefix.
# Prefixes and homes stay in the system temp directory. Pass an evidence
# directory to keep logs; that directory is not used as HOME.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
install="${repo_root}/scripts/install-aster.sh"
ps1="${repo_root}/scripts/install-aster.ps1"
evidence="${1:-${ASTER_INSTALL_EVIDENCE:-}}"

pkg_version="$(
  awk -F'"' '/^version = / { print $2; exit }' "${repo_root}/apps/aster/Cargo.toml"
)"
acp_version="$(
  awk -F'"' '/^version = / { print $2; exit }' "${repo_root}/crates/code/acp/Cargo.toml"
)"
if [[ "$pkg_version" != "0.1.0" ]]; then
  echo "error: apps/aster version is ${pkg_version}, want 0.1.0" >&2
  exit 1
fi
if [[ -z "$acp_version" ]]; then
  echo "error: a3s-code-acp package version is empty" >&2
  exit 1
fi

grep -q 'Darwin' "$install"
grep -q 'Linux' "$install"
grep -q 'MINGW\*|MSYS\*|CYGWIN\*' "$install"
grep -q 'install-aster.ps1' "$install"
grep -q 'cargo build --locked --release' "$install"
grep -q 'cargo build --locked --release' "$ps1"
if grep -E '(^|[[:space:]])(curl|wget)([[:space:]]|$)|Invoke-WebRequest|\birm\b|\biwr\b|x\.ai' \
  "$install" "$ps1"
then
  echo "error: install entry fetches or names an upstream CLI asset" >&2
  exit 1
fi
grep -q 'https://github.com/aster-ai-lab/aster.git' "$install"
grep -q 'https://github.com/aster-ai-lab/aster.git' "$ps1"
grep -q 'https://raw.githubusercontent.com/aster-ai-lab/aster/main/scripts/install-aster.sh' "$install"
grep -q 'https://raw.githubusercontent.com/aster-ai-lab/aster/main/scripts/install-aster.ps1' "$ps1"
readme="${repo_root}/README.md"
grep -q 'https://raw.githubusercontent.com/aster-ai-lab/aster/main/scripts/install-aster.sh' "$readme"
grep -q 'https://raw.githubusercontent.com/aster-ai-lab/aster/main/scripts/install-aster.ps1' "$readme"

probe="$(mktemp -d "${TMPDIR:-/var/folders}/aster-install-bootstrap.XXXXXX")"
cleanup_probe() {
  rm -rf "$probe"
}
trap cleanup_probe EXIT
mkdir -p "$probe/bin" "$probe/home"
cat >"$probe/bin/git" <<'EOF'
#!/bin/sh
printf '%s\n' "$*" >> "${GIT_LOG:?}"
exit 1
EOF
cat >"$probe/bin/cargo" <<'EOF'
#!/bin/sh
printf '%s\n' "cargo $*" >> "${GIT_LOG:?}"
exit 1
EOF
chmod 755 "$probe/bin/git" "$probe/bin/cargo"
cp "$install" "$probe/install-aster.sh"
: >"$probe/git.log"
set +e
GIT_LOG="$probe/git.log" PATH="$probe/bin:/usr/bin:/bin" HOME="$probe/home" \
  ASTER_REPO="$probe/repo" \
  bash "$probe/install-aster.sh" --prefix "$probe/prefix" \
  >"$probe/outside.out" 2>"$probe/outside.err"
outside_code=$?
set -e
if [[ "$outside_code" -eq 0 ]]; then
  echo "error: checkout bootstrap continued without git" >&2
  exit 1
fi
if [[ -e "$probe/prefix" ]]; then
  echo "error: bootstrap created a prefix" >&2
  exit 1
fi
if ! grep -q 'clone --depth 1 --branch main https://github.com/aster-ai-lab/aster.git' "$probe/git.log"; then
  echo "error: bootstrap did not clone https://github.com/aster-ai-lab/aster.git" >&2
  exit 1
fi
if grep -q '^cargo ' "$probe/git.log"; then
  echo "error: bootstrap built before the checkout existed" >&2
  exit 1
fi
: >"$probe/git.log"
set +e
GIT_LOG="$probe/git.log" PATH="$probe/bin:/usr/bin:/bin" HOME="$probe/home" \
  ASTER_INSTALL_COMMIT=pinned \
  bash "$install" --prefix "$probe/in-prefix" \
  >"$probe/inside.out" 2>"$probe/inside.err"
inside_code=$?
set -e
if [[ "$inside_code" -eq 0 ]]; then
  echo "error: in-repo install continued after the locked build failed" >&2
  exit 1
fi
if grep -q 'clone --depth 1' "$probe/git.log"; then
  echo "error: in-repo install tried to clone" >&2
  exit 1
fi
if ! grep -q 'cargo build --locked --release' "$probe/git.log"; then
  echo "error: in-repo install did not reach the locked build" >&2
  exit 1
fi
if [[ -e "$probe/in-prefix" ]]; then
  echo "error: failed in-repo build created a prefix" >&2
  exit 1
fi
rm -rf "$probe"
trap - EXIT

export ASTER_INSTALL_COMMIT="$(git -C "$repo_root" rev-parse HEAD)"

host_os="$(uname -s)"
case "$host_os" in
  Darwin) executed_platform=macos; skipped_platforms=linux,windows ;;
  Linux) executed_platform=linux; skipped_platforms=macos,windows ;;
  *)
    echo "error: this check runs on macOS or Linux; this host is ${host_os}" >&2
    exit 1
    ;;
esac

work="$(mktemp -d "${TMPDIR:-/var/folders}/aster-install-check.XXXXXX")"
save_evidence() {
  [[ -n "$evidence" ]] || return 0
  mkdir -p "$evidence"
  local f
  shopt -s nullglob
  for f in "$work"/*.out "$work"/*.err "$work"/*.json "$work"/*.txt; do
    cp -f "$f" "$evidence/"
  done
}
cleanup() {
  local code=$?
  save_evidence
  rm -rf "$work"
  exit "$code"
}
trap cleanup EXIT

refuse_prefix="${work}/refuse-prefix"
set +e
"$install" --prefix "$refuse_prefix" "http://example.invalid/cli" \
  >"${work}/refuse.out" 2>"${work}/refuse.err"
refuse_code=$?
set -e
if [[ "$refuse_code" -eq 0 ]]; then
  echo "error: download argument was accepted" >&2
  exit 1
fi
if [[ -e "$refuse_prefix" ]]; then
  echo "error: refused install still created a prefix" >&2
  exit 1
fi

file_size() {
  if stat -f '%z' "$1" >/dev/null 2>&1; then
    stat -f '%z' "$1"
  else
    stat -c '%s' "$1"
  fi
}

run_install() {
  local prefix="$1"
  local log_stem="$2"
  mkdir -p "$(dirname "$prefix")"
  "$install" --prefix "$prefix" >"${log_stem}.out" 2>"${log_stem}.err"
}

run_aster() {
  local prefix="$1"
  local home="$2"
  shift 2
  mkdir -p "$home/grok"
  env -i \
    HOME="$home" \
    GROK_HOME="$home/grok" \
    PATH="/usr/bin:/bin:/usr/sbin:/sbin" \
    TERM="${TERM:-xterm-256color}" \
    TMPDIR="${TMPDIR:-/var/folders}" \
    A3S_DISABLE_CC_SWITCH=1 \
    A3S_DISABLE_GROK_ACCOUNT=1 \
    A3S_DISABLE_CURSOR_ACCOUNT=1 \
    GROK_MANAGED_CONFIG=0 \
    "${prefix}/aster" "$@"
}

check_prefix() {
  local prefix="$1"
  local tag="$2"
  local home="${work}/home-${tag}"
  [[ -x "${prefix}/aster" ]]
  [[ -x "${prefix}/a3s-code-acp" ]]
  [[ "$(dirname "${prefix}/aster")" == "$(dirname "${prefix}/a3s-code-acp")" ]]
  run_aster "$prefix" "$home" version --json >"${work}/${tag}-version.json"
  local acp_code=0
  "${prefix}/a3s-code-acp" --version >"${work}/${tag}-acp-version.txt" 2>"${work}/${tag}-acp.err" || acp_code=$?
  if [[ "$acp_code" -ne 0 ]]; then
    echo "error: ${tag} acp --version exited ${acp_code}" >&2
    exit 1
  fi
  local got_acp
  got_acp="$(tr -d '[:space:]' <"${work}/${tag}-acp-version.txt")"
  if [[ "$got_acp" != "$acp_version" ]]; then
    echo "error: ${tag} acp version ${got_acp} != package ${acp_version}" >&2
    exit 1
  fi
  python3 - "$pkg_version" "${work}/${tag}-version.json" <<'PY'
import json, sys
want, path = sys.argv[1], sys.argv[2]
body = json.loads(open(path, encoding="utf-8").read())
version = str(body.get("currentVersion", ""))
if body.get("product") != "Aster":
    raise SystemExit(f"product {body.get('product')!r}")
if not version.startswith(want):
    raise SystemExit(f"currentVersion {version!r} does not start with {want}")
PY
  local before after
  before="$(file_size "${prefix}/aster")"
  echo "$before" >"${work}/${tag}-size-before.txt"
  run_aster "$prefix" "$home" update --check --json >"${work}/${tag}-update.json"
  after="$(file_size "${prefix}/aster")"
  echo "$after" >"${work}/${tag}-size-after.txt"
  if [[ "$before" != "$after" ]]; then
    echo "error: ${tag} update --check changed aster from ${before} to ${after}" >&2
    exit 1
  fi
  python3 - "${work}/${tag}-update.json" <<'PY'
import json, sys
body = json.loads(open(sys.argv[1], encoding="utf-8").read())
if body.get("updateAvailable") is not False:
    raise SystemExit(f"updateAvailable {body.get('updateAvailable')!r}")
if body.get("autoUpdate") is not False:
    raise SystemExit(f"autoUpdate {body.get('autoUpdate')!r}")
PY
}

prefix_a="${work}/prefix-a"
prefix_b="${work}/prefix-b"
run_install "$prefix_a" "${work}/prefix-a-run1"
check_prefix "$prefix_a" "prefix-a-run1"
cp "${work}/prefix-a-run1-version.json" "${work}/prefix-a-version-before-second.txt"

run_install "$prefix_a" "${work}/prefix-a-run2"
check_prefix "$prefix_a" "prefix-a-run2"
if ! cmp -s "${work}/prefix-a-run1-version.json" "${work}/prefix-a-run2-version.json"; then
  echo "error: second install changed version text" >&2
  exit 1
fi

run_install "$prefix_b" "${work}/prefix-b-run1"
check_prefix "$prefix_b" "prefix-b-run1"
if ! cmp -s "${work}/prefix-a-run1-version.json" "${work}/prefix-b-run1-version.json"; then
  echo "error: fresh prefixes reported different version text" >&2
  exit 1
fi

cat >"${work}/platforms.txt" <<EOF
executed=${executed_platform}
not_executed=${skipped_platforms}
host_os=${host_os}
entry=${install}
windows_branch=${ps1}
package_version=${pkg_version}
acp_package_version=${acp_version}
prefix_a=${prefix_a}
prefix_b=${prefix_b}
EOF

echo "INSTALL_CHECK_OK version=${pkg_version}"
