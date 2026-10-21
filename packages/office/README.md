<a id="a3s-office-source-for-desktop"></a>

# A3S Office source for Aster

This private package uses the same internalized Office source snapshot as
Aster Work. Installing Aster builds its editors, declarations, workers,
fonts, and WASM assets locally. Work keeps its separate frontend install.

`pnpm build` and `pnpm kernel:build` rebuild `generated/office-kernel.wasm`
from `crates/office` when those sources or `Cargo.lock` are newer. The command
is the Aster script, so both editor copies receive the same wasm. Install
the `wasm32-unknown-unknown` target first. Packaging sets
`OFFICE_KERNEL_REQUIRED=1` and stops when that target is missing.

`deps/xlsx-0.20.3.tgz` retains the patched SheetJS archive and its license.
The Aster pnpm workspace applies compatibility patches from `patches`.
`LICENSE` and `THIRD_PARTY_NOTICES.md` retain the upstream notices.
