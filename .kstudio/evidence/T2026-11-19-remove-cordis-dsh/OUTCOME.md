# T2026-11-19-remove-cordis-dsh

User cancelled the DSH compatibility campaign. Removed the native Cordis kernel,
DSH compatibility layer, Node executor, tests, fixtures, examples, and research
copy. Restored the affected Core files to their original content. Preserved the
earlier bridge cleanup and all historical evidence.

`cargo check -p aster-core --lib` passed. Targeted diff checks passed. Full
commands and exclusions: `docs/evidence/code/2026-11-19-remove-cordis-dsh/OUTCOME.md`.

Not claimed: remaining Cordis/DSH support, full-suite Pass, or Meta Harness Done.

Final audit: Studio dependency directory synchronized without lifecycle scripts;
DeepSeek/Cordis package residue is absent, Cordis example build artifacts are
removed, no executor process remains, and Studio deps:check passes. Existing
unrelated Studio DSH product/CLI catalog code was preserved.
