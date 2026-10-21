# Native independent review

Reviewed updater and delivery identity callers against spec 004 using source and synthetic owning fixtures. No real profile was read.

The updater carries `HostIdentity` through check, ready, download and install, and rejects a running compiled/installed identity mismatch. Aster returns `NotPublished` before requesting the unscoped ToYou desktop feed. ToYou retains its existing desktop channel. Signature checks bind executable, bundle ID, name, display name and version. Staging uses the enclosing bundle name, keeping the two products' payloads separate.

One concrete missing-resource defect was reported to the owners: macOS sealing and native validation required `INFO.md` but omitted its selected logo, `mark-light.png` and `icon.png`. Such a sealed generation could install and then fail startup. The owners added required-image validation. The final real Studio test crate passed all 28 updater tests, including missing-image negatives and the added `INFO.product`/declared-tenant mismatch negative. Updater production is root-owned; the one approved additional owning test is included in this agent's 30-file manifest.

The release helper and renderer stamp use the declared mapping: `aster`/AsterDream/`dev.a3s.studio.aster` and `toyou`/ToWork/`dev.a3s.studio`. No additional definite identity bypass was found in the reviewed paths. This is source review plus native owning-test proof. It does not substitute for root's canonical Cargo, package/signature, GUI or published-feed acceptance.

The evidence directory was externally renamed to `docs/evidence/desktop`; this report uses actual source identifiers rather than mechanically renamed technical fields. Current receipt hashes attest current bytes only.
