# Current Aster branding prose closure

Updated 23 current parent-repository files: 16 registry package source descriptions/instructions/test plans, DESIGN, one Core doc comment, three current spec004 documents, and two spec templates. No runtime behavior changed.

DESIGN now links to the canonical private `apps/studio` gitlink; all 21 distinct referenced targets exist. The templates consolidate the retired Work/desktop rows into this current host. Current spec004 carries an explicit 2026-10-21 brand amendment; its original input and old-data compatibility statements retain the historical name.

Checks passed: exact expected substitutions for the 18 prose/doc-comment files; current-spec-only amendment checks; 21 existing DESIGN targets; all four affected SKILL frontmatters parsed by the existing gray-matter dependency; scoped `git diff --check`. No native build or GUI test was needed or claimed for these text changes. Registry generated artifacts, signatures and package versions were not rebuilt or modified.

Historical evidence, licenses, migration/provenance/source manifests, dated manuals and old feature specs were retained. Remaining AsterDream strings in that historical scope do not describe the current displayed product. Technical identifiers, bundle IDs, data paths, ToWork naming and user state were not changed.

Source hashes and the exact file list are in [parent-current-branding.json](./parent-current-branding.json). The `beforeSha256` values were recorded from these clean owned paths before this task edited them. Other concurrent working-tree changes were not altered.
