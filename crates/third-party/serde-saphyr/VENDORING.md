# Local compatibility patch

Source: published `serde-saphyr` 0.0.16 crate, verified against the checksum in
Power's pre-integration lockfile. Both original licenses and the upstream
source/test suite are retained. The published source file hashes and archive
checksum are in `docs/evidence/power/2026-10-22-native-deepseek-h200/serde-saphyr-source.json`.

The local changes require stable SmallVec >=1.15.2 (currently locked to 1.16.3)
and adapt four internal type
annotations to its array generic. All operations, inline capacities, parser
budgets and public Serde APIs remain unchanged. This avoids the Cargo resolver
collision between serde-saphyr's SmallVec 2 alpha.12 and ONNX Runtime's pinned
SmallVec 2 alpha.10 while preserving the required ORT version and Mistral
backend. The package is unpublished in this workspace.

This is an existing inference backend dependency, not a new product
configuration parser; Aster product configuration remains ACL.
