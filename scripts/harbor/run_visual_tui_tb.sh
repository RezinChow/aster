#!/usr/bin/env bash
# One-task Terminal-Bench 4.0 evaluation through an agent-desktop-visible TUI.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TB_TARGET="${TB_TARGET:-x86_64-unknown-linux-gnu}"
export ASTER_TUI_BINARY="${ASTER_TUI_BINARY:-$ROOT/target/${TB_TARGET}/release/aster}"
export ASTER_ACP_BINARY="${ASTER_ACP_BINARY:-$ROOT/target/${TB_TARGET}/release/aster-acp}"
export ASTER_CONFIG="${ASTER_CONFIG:-$ROOT/.aster/config.acl}"
export ASTER_TB_DEFAULT_MODEL="${ASTER_TB_DEFAULT_MODEL:-kimi/k3.1-pro}"
export ASTER_TERMINAL_BENCH_MAX_EXECUTION_MS="${ASTER_TERMINAL_BENCH_MAX_EXECUTION_MS:-28800000}"
export PYTHONPATH="$ROOT/scripts/terminal_bench${PYTHONPATH:+:$PYTHONPATH}"
export PATH="${HOME}/.local/bin:${PATH}"

for binary in "$ASTER_TUI_BINARY" "$ASTER_ACP_BINARY"; do
  if [[ ! -x "$binary" ]]; then
    echo "missing paired binary: $binary" >&2
    exit 1
  fi
done
if [[ ! -f "$ASTER_CONFIG" ]]; then
  echo "missing ASTER_CONFIG: $ASTER_CONFIG" >&2
  exit 1
fi

python3 "$ROOT/scripts/harbor/ensure_logs_trust_patch.py" >/dev/null

TASK_FILTER=()
if [[ -n "${ASTER_TB_INCLUDE_TASK:-}" ]]; then
  TASK_FILTER=(-t "terminal-bench/${ASTER_TB_INCLUDE_TASK}")
fi

exec harbor run \
  -d "${ASTER_TB_DATASET:-terminal-bench/terminal-bench@4.0.0}" \
  -a aster_tui_agent:AsterCodeVisualTuiAgent \
  "${TASK_FILTER[@]}" \
  -n "${ASTER_TB_N:-1}" \
  -k "${ASTER_TB_K:-1}" \
  -y \
  "$@"
