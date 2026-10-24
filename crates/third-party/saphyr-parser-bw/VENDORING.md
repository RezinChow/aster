# Local compatibility patch

Source: published `saphyr-parser-bw` 0.0.605, verified against Power's
pre-integration lockfile checksum. Both original licenses, packaged source
and packaged tests are retained. The omitted upstream YAML test-suite
submodule was not part of the published crate and is not claimed as tested.

Only the private scanner stack annotations and their constructors are
adapted from SmallVec 2 alpha to stable SmallVec >=1.15.2 (locked to 1.16.3); inline capacity
remains eight. Public parser types, parsing logic and budgets are unchanged.
The package is unpublished. This accompanies the matching serde-saphyr
compatibility patch without changing ONNX Runtime's pinned version.

Original file and archive hashes are recorded in
`docs/evidence/power/2026-10-22-native-deepseek-h200/saphyr-parser-source.json`.
