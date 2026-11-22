# T2026-11-20-fact-log-byte-limit-fix

Authoritative OUTCOME: `docs/evidence/code/2026-11-20-fact-log-byte-limit-fix/OUTCOME.md`

Scope: fix the fact-log 16 MiB byte-limit overflow on long sessions. Root cause:
`tool.prepared` baseline bytes were invisible to compaction triggering, and
`compacted_prefix()` cannot prune without a `compaction.done` anchor. Fix: typed
`ActorError::FactLogByteLimit` + stable `AgentEvent`/wire code, runner
storage-fatal early-stop with `reward_valid=false`/`storage_fatal`, and
prunable-byte pressure compaction independent of message prefix.

Verified: effect lib 101/1 ignored + integration 5/5, event-mapping test,
runner example 35/35, cargo check + clippy exit 0, hermetic `tui_913_hermetic`
13/15 (2 known host-sandbox failures). Provider re-run confirmed the byte-limit
failure path is gone on both arms with `storage_fatal=false`.

Fact-log overflow is fixed. `%≠Pass`.
