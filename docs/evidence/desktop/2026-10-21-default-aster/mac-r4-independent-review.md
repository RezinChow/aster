# Mac R4 packages and transitive Effect closure

Both final `.app` generations and the corrected ZIPs passed the independent read-only audit. No app, CUA action, upgrade, user profile, product source, or git state was changed by this audit.

The initial `package-final.py` receipt covers 390 host, resource, renderer, and delivery-script paths. It contains zero `crates/*` source paths. Its `source_unchanged: true` is valid for that declared scope and is not a complete Rust dependency proof. Aster's actual build log explicitly compiled `a3s-effect`, `a3s-code-core`, and ACP at lines 212/231/278. ToYou then compiled ACP against the same cached Effect/Core. The external Effect inputs are:

- `crates/effect/src/coding.rs`: `4bca11fb04d56fa12465193c2b4ecb30f585c94b3b311dfbcc3d9e4d7f30b933`.
- `crates/effect/src/coding/revalidation_tests.rs`: `de8af07e71549b656a9fd672d895e7a4f1b5b58b0352bfec94e491ce9bec68c5`.

The supplemental source snapshot follows normal/build dependency edges from Studio, ACP, and Office through locked Cargo metadata, including all platform branches. It records 37 local packages and 3302 Rust/manifests/config inputs. Actual `cargo build --locked --release -p a3s-code-acp -p a3s-office-cli --message-format=json` completed with rc0; Effect, Core, ACP, and Office were all fresh, and all 3302 source hashes were unchanged before/after. Studio has no normal/build path to Effect; that code is in the ACP companion. Registry sources remain fixed by the recorded lockfile. This is a current supplemental revalidation, not a retroactively invented pre-package snapshot. It does not claim to cover every non-Rust asset in every local crate.

ToYou's packaged ACP matches the freshly validated artifact byte for byte, as does Office in both products. Aster's earlier ACP differs from the current artifact only in its explicit 40-hex CLI source stamp, Mach-O UUID, and corresponding signature bytes. The diagnostic comparison proves all bytes outside those exact metadata ranges equal; it does not pretend the raw SHA values equal or modify either binary. The stamp helper intentionally includes broad CLI source bytes, so a changed pair stamp alone does not imply changed Effect execution code. See `mac-r4-companion-fresh-receipt.json`, `mac-r4-transitive-rust-source.json`, and `mac-r4-aster-acp-metadata-difference.json`. The initially unsuccessful raw-equality attempt is retained as `mac-r4-aster-companion-binding.json` rather than relabeled a pass.

The audit found two genuine defects in the original ditto archives. Their UTF-8 Chinese names lacked ZIP bit 11, so the pinned native zip 7.2 `entry.name()` decoded CP437 names. A real probe linked against the existing release zip 7.2 rlib reproduced this failure. In addition, resource-fork metadata expanded the old Aster/ToYou ZIPs to 5620/5606 entries, above the updater's 4096-entry ceiling. The packaging owner replaced only archive generation with the maintained UTF-8 ZipFile writer. The signed `.app` bytes did not change. Original failing ZIPs and decoder logs remain preserved.

Independent checks of the new archives passed exact file membership and every file's bytes against the signed app, ZIP CRC, safe paths, no symlinks, Unix permissions, three 0755 executable modes, UTF-8 flags for every Chinese name, the updater's entry/size ceilings, and the real native zip 7.2 decoder. The archives contain no `__MACOSX` metadata. Their final identities are:

| Tenant | ZIP SHA-256 | Bytes | ZIP entries |
| --- | --- | ---: | ---: |
| aster | `9898049ac2fa391a8a5e0925590d008f7af7a5b1e8c93c2a601b156ff7fbacbb` | 107023301 | 2786 |
| toyou | `86260b18ae5b458fdb932bea1c8397bc012927e1be6c123815ce2d6b9c7a3214` | 105811073 | 2779 |

Both bundles declare version 2.1.3, executable Studio, and the exact AsterDream/dev.a3s.studio.aster or ToWork/dev.a3s.studio identity. Both have no `LSEnvironment`. The complete resource-generation hashes verify: 2735 Aster and 2728 ToYou declared files. Each skill tree has the exact 63-file inventory and identical source skill bytes. Each packaged renderer matches its current built R4 output file for file. Strict deep codesign validation succeeds; these are local ad-hoc signatures, not a notarization or public-release attestation.

The per-package receipts are `mac-r4-independent-bundle-{aster,toyou}.json`, with `mac-r4-independent-archive-contract.json` and `mac-r4-native-zip-{aster,toyou}-after.log`. ZIP-level validation used the native decoder and independent complete-content checks; it did not execute the full native update installation/relaunch. The proposed synthetic 2.1.2-to-current CUA upgrade remains unexecuted and was paused when the parent prioritized the user's repository migration request. No prior read-only fixture plan should be counted as an upgrade pass.
