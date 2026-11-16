# CLI 0.3.9 / Core+ACP 9.2.7 — land + publish closeout

Date: 2026-11-16.  
Contracts: `docs/release-governance.md`; named YOLO「全面完成收尾工作并发布新版本」.

## Preparation

| Check | Result |
| --- | --- |
| Tip | `22856ef337040fed61388443ead056ccf94fa820` on `main` |
| Versions | aster `0.3.9`; core/acp `9.2.7` (+ `Cargo.lock` path packages) |
| `RELEASE_9.2.7.md` | written |
| Local `cargo build --locked -p aster -p aster-acp` | PASS |
| `cargo fmt --all -- --check` | PASS (after `cargo fmt --all`) |
| `cargo clippy --locked -p aster-core|aster-acp --all-targets --no-deps` | exit 0 (warnings only) |
| Focused unit filters (elicitation / feature_stage / forced_layer / byte_budget / permission_profile / self_test / hooks::policy / compaction::ledger / acp permission / unconfigured) | PASS |
| `tests/release_governance.py` | 16 OK |

## Qualify

| Workflow | Result |
| --- | --- |
| `qualify-aster-cli` | **success** — https://github.com/aster-ai-lab/aster/actions/runs/43789945732 |
| `qualify-code` | **success** — https://github.com/aster-ai-lab/aster/actions/runs/43789945766 |

## Tags

| Tag | SHA |
| --- | --- |
| `aster-acp-v9.2.7` | `22856ef337040fed61388443ead056ccf94fa820` |
| `aster-cli-v0.3.9` | `22856ef337040fed61388443ead056ccf94fa820` |

## Builds + publish

| Item | Result |
| --- | --- |
| `release-code` / ACP | **success** — https://github.com/aster-ai-lab/aster/actions/runs/43795267541 ; Release published `--latest=false` |
| `release-aster-cli` | first pass **cancelled** at 3h0m50s on `macos-bins` (job `timeout-minutes: 180`); `gh run rerun --failed` → **success** — https://github.com/aster-ai-lab/aster/actions/runs/43795267584 |
| CLI draft assemble | `scripts/publish-aster-cli.sh` with `ARTIFACT_RUN_ID=43795267584` / `BUILD_SHA=22856ef33…` |
| CLI Release | **published** (not draft) — https://github.com/aster-ai-lab/aster/releases/tag/aster-cli-v0.3.9 |
| ACP Release | **published** — https://github.com/aster-ai-lab/aster/releases/tag/aster-acp-v9.2.7 |
| Channel | **OK** — `release-aster-cli-channel.yml` https://github.com/aster-ai-lab/aster/actions/runs/43834520942 ; `aster-cli-stable/latest.json` → `version=0.3.9` / `tag=aster-cli-v0.3.9` |
| `--latest=false` | observed on CLI create/edit and ACP create |

## Explicitly not claimed

- That every installed client has already updated (users must `aster update` / reinstall).
- Studio desktop release / gitlink land synced to this tip (`apps/studio` stayed dirty locally; not bumped).
- Windows native `win-gates` re-run for this tip.
- That the first `macos-bins` timeout root cause beyond wall-clock 180m was fixed in-tree (timeout remains 180; mitigated by rerun with warm cache).
- Overall GOALS「日常稳定使用」product Pass solely from this channel bump (%≠Pass).

## Short report

```text
阶段：cli-0.3.9-publish-closeout
SHA：22856ef33
qualify：cli=success；code=success
tag：aster-acp-v9.2.7 + aster-cli-v0.3.9
构建：acp=success；cli=success(rerun after macos-bins 180m cancel)
Release：CLI + ACP published；--latest=false
channel：aster-cli-stable → 0.3.9
证据：docs/evidence/code/2026-11-16-cli-0.3.9-acp-9.2.7-release/OUTCOME.md
```
