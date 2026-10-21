# Source submission

Power was committed on the GPU server as
`54841f1df86880654357d3e38a521ed31fa2c98a` and pushed by fast-forward to
`https://github.com/A3S-Lab/Power.git`, branch `main`. An independent ls-remote
read confirmed that exact remote tip. GPU Power's working tree is clean and its
main and origin/main match.

GPU Gateway cancellation/deadline code and qualification tools were committed
as `557ae55622b9fba26b10559ab3bac710e1cde09c` on
`codex/power-serving-gpu-20261021`. Original unrelated Gateway dirty files,
private backups and runtime credentials were preserved outside that commit.

Aster integration uses a separate worktree rooted at the current origin/main.
The GPU increment is cherry-picked, and the local serving implementation,
specification and safe evidence are reconciled against the existing local
`b1b5fab9` / `0a83990c` snapshots. Concurrently published main already contains
those local changes as `a01f971d` / `d921a5df`; they must not be reverted or
duplicated with an old-history merge. No force push is used.

## Checkout integrity repair

Windows auto-conversion to CRLF broke byte-pinned qualification dependencies.
The old matrix source had also lost its final blank line in the working-copy
landing. The exact original files were recovered from the already verified
public and ACP evidence archives. Only newline representation or a final blank
line differed; semantic changes were not overwritten. Scoped attributes retain
the original bytes of serving evidence, the qualification runner and fixture
tests on future checkouts. No expected hash, refusal gate or test assertion was
weakened. Some original JSON receipts intentionally contain CRLF.

The original thirteen Python fixture suites now pass across the focused reruns:
141 reported cases, including one skipped actual-binary/platform case. The
eight changed Gateway Rust files pass the owning standalone rustfmt check, and
code/script/test/spec diff whitespace checks pass. Immutable evidence logs and
patch files retain their original whitespace; a whole-evidence whitespace-only
check is not claimed clean. Existing full-workspace CI and formatting limits
remain recorded in OUTCOME.md.

The staged source/evidence credential scan checked421 paths and344 archive
members (239,977,854 bytes) before the checkout integrity repair. It found no
actual shared credential, full gateway key, GitHub token or private-key block.
Recovered bytes came only from those already scanned archives. The additional
attributes and this submission record contain no credentials or session state.

No production unit, configuration, API key or running binary was changed by
committing or publishing source. Prior inference/load results are retained;
this submission does not rerun or relabel the public VPN-path qualification.
