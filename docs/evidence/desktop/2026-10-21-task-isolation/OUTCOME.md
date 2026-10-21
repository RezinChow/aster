# Isolated task marker

Date: 2026-10-21. Live open issues after #11 closed were #10 and #12. #12 is the multi-task report: a prompt marked `【新任务，独立处理，不要参考前文】` still saw earlier turns, and creating a new session was the only isolation that worked until that action failed.

## Result

A user turn whose text contains that exact marker starts a fresh agent process when the current process already has earlier turns. The prompt sent to that process is only the marked turn. A resident ToBot transcript does not prepend earlier lines in front of the marker. An unmarked follow-up on a warm process still sees the earlier turn.

#12 is closed from that proof. #10 stays open. This host still has no glibc 2.31 CLI pair.

## Validation

| Command | Result |
| --- | --- |
| `gh issue list --repo aster-ai-lab/aster --state open` | #12 and #10 open. #11 already closed. |
| `cargo test -p a3s-studio --lib -- an_isolated_task_marker_drops_the_warm_process_history a_fresh_transcript_keeps_earlier_lines -- --test-threads=1` | 2 passed, 0 failed, 906 filtered out, 1.60s. Compile waited on another build lock, then finished in 5m 27s. |
| `cargo fmt --all -- --check` | exit 0. |

The warm-process test sends `ALPHA-SECRET`, then an unmarked `继续问` whose reply still contains `ALPHA-SECRET`, then the marked second question. That reply is `hello`, the marked prompt does not contain `ALPHA-SECRET`, and the scripted agent recorded 2 launches.

## Explicitly not claimed

- No real desktop multi-question run was driven.
- The new-task button was not shown failing by a separate hermetic case. The marker is what drops the warm process history.
- #10 was not rebuilt. No glibc 2.31 CLI pair was produced, and no Linux binary was executed on this Mac.
