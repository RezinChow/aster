# Harbor / Terminal-Bench helpers

Native Aster lane for `terminal-bench/terminal-bench@4.0.0`.

| Path | Role |
| --- | --- |
| `../terminal_bench/aster_agent.py` | Harbor `BaseInstalledAgent` (`aster_agent:AsterCodeAgent`) |
| `native-tb.acl` | Evaluation ACL that reads provider keys from the host env |
| `run_native_tb.sh` | One-task / matrix runner wrapper |

## Host prep

```bash
uv tool install 'harbor[modal]'
cargo zigbuild --locked --target x86_64-unknown-linux-musl \
  --release --no-default-features --example terminal_bench_runner -p aster-core
```

OrbStack / Docker Desktop must be running. On Apple Silicon, Harbor TB images
are commonly `x86_64`; keep `TB_TARGET=x86_64-unknown-linux-musl`.

## Diagnostic run

`run_native_tb.sh` defaults `ASTER_TERMINAL_BENCH_MAX_EXECUTION_MS=28800000`
(8h) so TB agent timeouts are not clipped by the runner's 840s diagnostic
budget. Override downward for short smokes.

```bash
ASTER_TB_INCLUDE_TASK=bun-sourcemap-leak \
ASTER_TB_DEFAULT_MODEL=deepseek/deepseek-flash \
DEEPSEEK_API_KEY=… \
  ./scripts/harbor/run_native_tb.sh
```

Or set `ASTER_CONFIG` to a trusted local ACL (for example `.aster/config.acl`)
and omit `native-tb.acl` env vars. Codex login uses `ASTERX_AUTH_FILE` /
`ASTERX_MODEL` instead of provider API keys.

Install-only smoke (no model call):

```bash
ASTER_TERMINAL_BENCH_BINARY=$PWD/target/x86_64-unknown-linux-musl/release/examples/terminal_bench_runner \
ASTER_CONFIG=$PWD/scripts/harbor/native-tb.acl \
PYTHONPATH=$PWD/scripts/terminal_bench \
  harbor run -d terminal-bench/terminal-bench@4.0.0 \
    -a aster_agent:AsterCodeAgent \
    -t terminal-bench/bun-sourcemap-leak \
    --install-only -n 1 -k 1 -y
```

Authority and evidence rules: `crates/code/manual/TERMINAL_BENCH.md`.
