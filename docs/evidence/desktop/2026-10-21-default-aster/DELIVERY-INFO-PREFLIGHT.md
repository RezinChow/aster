# Package brand identity preflight

The package helper now refuses a tenant INFO product that the native host cannot
activate. The previous sealer accepted `tenant/toyou/INFO.md` declaring AsterDream
despite a valid ToWork Info.plist and renderer. Linux hashes likewise proved bytes,
without checking their brand meaning. Native `tenant::load_slug` already rejected
this mismatch, so such a package could be built successfully and fail at startup.

The existing `studio_product.py` helper now checks the native front matter contract:
name, exact selected product, safe declared light logo and optional light theme.
INFO reads are bounded to 64 KiB. The declared logo must be a nonempty regular file;
the mark and icon retain the same checks. Tauri configuration and macOS sealing use
the helper, as do Linux build receipts, staging and installed-generation validation.
A separately declared valid logo is included in the Linux hash and copy set.

The maintained regressions failed before the fix: 2 helper tests had 9 failing
subcases, macOS sealing had 1 failure, and the 3 Linux boundaries each failed to
refuse a foreign product. Linux cases also recompute the byte hashes to prove that
the missing semantic check cannot be replaced by a checksum. Old positive fixtures
now contain valid minimal INFO definitions instead of arbitrary text.

- [Initial concrete sealer proof](delivery-info-product-review.json).
- Before: [helper](delivery-info-helper-before.log), [macOS](delivery-info-macos-before.log),
  [Linux](delivery-info-linux-before.log).
- Final owning suites: [18 macOS/helper tests](delivery-info-macos-explicit-interpreters-final.log)
  and [18 Linux tests](delivery-info-linux-explicit-interpreters-final.log), both pass.
  The added edges cover CRLF, bounded reads and delivery of the actual declared logo.
- [Current source receipt](delivery-source-ready.json) preserves the previous receipt
  as [before INFO preflight](delivery-source-ready-before-info-preflight.json).

Two intermediate complete runs hit temporary executable fixture startup timeouts:
[macOS](delivery-info-macos-final.log) and [Linux](delivery-info-linux-final.log).
An isolated daemon retry also timed out. Its bounded [shell trace](delivery-info-daemon-trace.json)
stopped while starting the new temporary probe, before the decision logic. Tests now
read fake external commands through an explicit existing interpreter; the launcher
still runs through its production `--print` entry. Actual regular-file, executable
mode, identity and checksum gates were retained. Separate rechecks passed before
the final owning suites. The operating-system cause of the startup stalls is not claimed.

These are hermetic fixtures. No real application package, signature, live upgrade,
installation, physical Kylin session or GUI acceptance is certified by this closure.
