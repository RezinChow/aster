#!/usr/bin/env bash
# Diagnostic Harbor run for Terminal-Bench 4.0 with Aster's native runner.
# Full leaderboard matrix still needs -n/-k and a GPU-capable sandbox per TB docs.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TB_TARGET="${TB_TARGET:-x86_64-unknown-linux-musl}"
BINARY="${ASTER_TERMINAL_BENCH_BINARY:-$ROOT/target/${TB_TARGET}/release/examples/terminal_bench_runner}"
CONFIG="${ASTER_CONFIG:-$ROOT/scripts/harbor/native-tb.acl}"
DATASET="${ASTER_TB_DATASET:-terminal-bench/terminal-bench@4.0.0}"
TASK_FILTER=()
if [[ -n "${ASTER_TB_INCLUDE_TASK:-}" ]]; then
  TASK_FILTER=(-t "terminal-bench/${ASTER_TB_INCLUDE_TASK}")
fi

if [[ ! -x "$BINARY" ]]; then
  echo "missing runner binary: $BINARY" >&2
  echo "build with:" >&2
  echo "  cargo zigbuild --locked --target ${TB_TARGET} --release --no-default-features --example terminal_bench_runner -p aster-core" >&2
  exit 1
fi
if [[ ! -f "$CONFIG" ]]; then
  echo "missing ASTER_CONFIG: $CONFIG" >&2
  exit 1
fi

export PATH="${HOME}/.local/bin:${PATH}"
export ASTER_TERMINAL_BENCH_BINARY="$BINARY"
export ASTER_CONFIG="$CONFIG"
export PYTHONPATH="$ROOT/scripts/terminal_bench${PYTHONPATH:+:$PYTHONPATH}"
# TB 4.0 agent timeouts are often hours; the runner default (840s) is only a
# short diagnostic budget. Override via ASTER_TERMINAL_BENCH_MAX_EXECUTION_MS.
export ASTER_TERMINAL_BENCH_MAX_EXECUTION_MS="${ASTER_TERMINAL_BENCH_MAX_EXECUTION_MS:-28800000}"

# rewardkit Worker needs /logs mode 755; Harbor's 777 ensure/empty otherwise
# yields Untrusted parent directory of /logs/verifier on separate verifiers.
if ! python3 "$ROOT/scripts/harbor/ensure_logs_trust_patch.py" >/dev/null; then
  echo "warning: ensure_logs_trust_patch.py failed; separate verifiers may not score" >&2
fi

N_CONCURRENT="${ASTER_TB_N:-1}"
N_ATTEMPTS="${ASTER_TB_K:-1}"

exec harbor run \
  -d "$DATASET" \
  -a aster_agent:AsterCodeAgent \
  "${TASK_FILTER[@]}" \
  -n "$N_CONCURRENT" \
  -k "$N_ATTEMPTS" \
  -y \
  "$@"
