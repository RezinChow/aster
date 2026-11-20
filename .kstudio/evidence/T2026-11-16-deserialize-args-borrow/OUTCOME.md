# Hot-path deserialize(&Value) without args/payload clone

Date: 2026-11-16.  
Branch: `main` @ dirty.

## Change

Replaced `serde_json::from_value(….clone())` with `T::deserialize(&value)` on:

- `task` / `parallel_task` / `task_control` / `generate_object` tool arg parse
- `external_observation::observation_from_value`
- `session_folder` sessionKind parse
- `tools::ensure_tool_result_evidence_with_transform_binding`
- `agent_api::transcript` model.turn / turn.yielded / turn.complete / pending_interaction

Also fixed `parallel_isolates_schema_coercion_failure_from_sibling` to use
distinct prompts so A1 in-flight content fingerprint does not refuse the
schema sibling (test was colliding on identical `d`/`p`).

Hardened `unattended_e2e::private_fixture_facts` against temp-dir races
(`read_dir` NotFound) that intermittently failed
`interactive_permission_modes_apply_to_each_prompt_and_preserve_denies`.

## Commands / counts

```text
cargo test --locked -p aster-core --lib parallel_isolates_schema_coercion -- --test-threads=1
# → 1 ok
cargo test --locked -p aster-core --lib external_observation -- --test-threads=1
# → 15 ok
cargo test --locked -p aster-core --lib agent_api::transcript -- --test-threads=1
# → 11 ok (prior this slice)

# unattended: first recheck 32/1 (fixture race) → retry 33/0 → after harden 33/0
python3 scripts/verify-hermetic-perf-e2e.py --suite unattended_e2e
```

## Explicitly not claimed

- Named YOLO Done / Meta Harness Pass.
- Headed Studio / live LLM.
