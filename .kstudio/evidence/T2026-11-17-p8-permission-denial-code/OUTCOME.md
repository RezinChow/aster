# T2026-11-17-p8-permission-denial-code

Updated: 2026-11-17 · defect catalog **P8** knife · ≠产品 Pass · ≠ Meta Harness Done

## Change

ACP `PermissionDenied` now publishes structured rawOutput with stable
`permission.denied` code (mirrors sandbox.violation.* style), instead of
reason text alone / `metadata: None`.

## Verification

```text
cargo test --locked -p aster-acp --lib permission_denial_raw_output_carries_stable_code
→ ok (1 passed)
```

## Explicitly not claimed

- Meta Harness Done / product Pass
- Taxonomy of distinct denial codes beyond `permission.denied`
- Host UI rendering of PermissionDenial
