# Bundled skills survive installation

The release previously looked up builtin skills through `CARGO_MANIFEST_DIR`, while
the package carried only companions, renderer and brand data. That works inside the
build checkout and fails on a machine without it. The new packaging source copies the
repository's complete eight-skill tree into `Resources/skills`; it copies no user-installed
skills. Native lookup and updater verification are a separate coordinated change.

The immutable source contract is
`apps/studio/resources/bundled-skill-files.txt`: 63 exact relative paths covering every
reference, script, extension ACL file and license/notice. It is a build input, not user
configuration. Both Python packaging and native Rust consume that contract. The two
previously empty Python package initializers now contain harmless module docstrings so
every contracted file is nonempty. Other resource bytes, including license notices, are
preserved.

Tauri maps the canonical skills and contract into its resources. The macOS sealer copies
and hashes the exact tree before the final signature. Linux records skill hashes with
the host build, refuses later source or contract changes, and copies/hashes the full tree
when staging. Its installed verifier validates the target generation's own safe contract;
it does not pin future packages to this version's 63 paths. Native updater validation
must likewise keep this forward-update boundary; runtime lookup uses the running
binary's compiled contract.

- [Before](delivery-skills-before.log): seven new maintained tests fail against the old
  production implementation; the other 28 tests pass.
- [After](delivery-skills-final.log): 48 package/helper/Linux tests pass, including missing
  references, external symlinks, empty or extra source files, mixed generations, and an
  omitted required reference with recomputed generation hashes. Actual package-entry
  fixtures exercise both `aster` and `toyou` and compare every copied skill byte.
  A future target generation with an added safe reference and a complete reseal also
  passes, protecting forward updates from an accidental fixed-count restriction.
- [Current source receipt](delivery-source-ready.json) records ownership and the separate
  complete resource inventory. Native resolver/updater tests and final real application
  artifacts remain separate integration gates.

The copy contains Python and Node helper scripts as shipped source. These tests do not
install their optional tools or claim those scripts ran on physical Kylin or Windows.
