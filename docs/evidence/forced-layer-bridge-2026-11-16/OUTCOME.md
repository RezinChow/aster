# forced-layer-bridge-2026-11-16 (P1-6)

## Task

B · implement · P1-6 layered requirements / constrained config bridge: document forced vs preference, illegal forced value fail-closed, queryable provenance digest; no JSON sidecar. Decision: `D-2026-11-16-p1-6-wave-lock`.

## Changes

- `crates/code/core/src/config/forced_layer.rs` (new): module docs for forced override; `ForcedLayerProvenance`; `apply_forced_layers`; `load_forced_acl`; hermetic tests.
- `crates/code/core/src/config/mod.rs`: re-exports.

## DoD checklist

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Document forced layer override (incl. trust) | module docs + HOST_AUTHORITATIVE_BLOCKS / withhold |
| 2 | Illegal forced value load fails | `illegal_forced_sandbox_value_fails_to_load` |
| 3 | Digest/source queryable | `ForcedLayerProvenance.trusted_acl_digest` |
| 4 | No second JSON sidecar | ACL layer texts only |

## Commands

```bash
cargo test --locked -p aster-core --lib -- config::forced_layer -- --nocapture
# exit 0 · 2 passed
```

## Explicitly not claimed

- 产品 Pass / 日常稳定使用 / commit·推送·发布
- MDM / requirements.toml 文件名
- P2
