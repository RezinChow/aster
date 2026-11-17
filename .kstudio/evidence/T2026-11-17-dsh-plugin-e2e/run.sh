#!/usr/bin/env bash
# Real DeepSeek Harness plugin E2E: install → use → uninstall.
# Requires: dsh on PATH (tested with @deepseek-ai/dsh 0.2.2-rc.1).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PLUGIN="$ROOT/fixture"
WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/aster-dsh-e2e.XXXXXX")"
export DSH_HOME="$WORKDIR/home"
mkdir -p "$DSH_HOME"
MARKER="$WORKDIR/marker.txt"
MARKER2="$WORKDIR/marker-after-remove.txt"

die() { echo "FAIL: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null || die "missing $1"; }

# Boot dsh briefly until marker appears (or timeout), then SIGTERM.
boot_until_marker() {
  local marker="$1" log="$2" seconds="${3:-20}"
  rm -f "$marker"
  dsh --profile aster-e2e >"$log" 2>&1 &
  local pid=$!
  local i=0
  local limit=$((seconds * 2))
  while (( i < limit )); do
    if [[ -f "$marker" ]]; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      return 0
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      wait "$pid" 2>/dev/null || true
      return 1
    fi
    sleep 0.5
    i=$((i + 1))
  done
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  return 1
}

boot_negative() {
  local marker="$1" log="$2" seconds="${3:-12}"
  rm -f "$marker"
  dsh --profile aster-e2e >"$log" 2>&1 &
  local pid=$!
  sleep "$seconds"
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  [[ ! -e "$marker" ]]
}

need dsh
need rg

echo "== install =="
dsh plugin --profile aster-e2e add "$PLUGIN"
rg -q 'dsh-aster-e2e-hello' "$DSH_HOME/profiles/aster-e2e/package.json" \
  || die "bundle missing after install"
dsh --profile aster-e2e --dump-config | rg -q 'dsh-aster-e2e-hello' \
  || die "dump-config missing plugin layer"

echo "== use (boot until apply marker) =="
export ASTER_DSH_E2E_MARKER="$MARKER"
boot_until_marker "$MARKER" "$WORKDIR/boot.log" 25 \
  || die "plugin apply marker missing within timeout"
rg -q '^loaded:aster-e2e-hello:' "$MARKER" || die "unexpected marker: $(cat "$MARKER")"

echo "== uninstall =="
unset ASTER_DSH_E2E_MARKER
dsh plugin --profile aster-e2e remove dsh-aster-e2e-hello
rg -q 'dsh-aster-e2e-hello' "$DSH_HOME/profiles/aster-e2e/package.json" \
  && die "bundle still listed after remove"
if dsh --profile aster-e2e --dump-config | rg -q 'dsh-aster-e2e-hello'; then
  die "dump-config still lists plugin after remove"
fi

echo "== negative boot (expect no marker) =="
export ASTER_DSH_E2E_MARKER="$MARKER2"
boot_negative "$MARKER2" "$WORKDIR/boot-after-remove.log" 12 \
  || die "plugin still applied after remove: $(cat "$MARKER2" 2>/dev/null || true)"

if test -e "$DSH_HOME/profiles/aster-e2e/node_modules/dsh-aster-e2e-hello"; then
  echo "NOTE: node_modules symlink residual after remove (layer/runtime inactive)"
fi

echo "PASS install/use/uninstall  DSH_HOME=$DSH_HOME  workdir=$WORKDIR"
