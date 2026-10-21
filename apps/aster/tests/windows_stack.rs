//! The Windows debug `aster` binary must reserve an 8 MiB main-thread stack.
//!
//! The MSVC default is 1 MiB. `PagerArgs::parse_cli` and the startup future in
//! `main` overflow that reserve before `--version` can return.

#![cfg(windows)]

const UNIX_MAIN_THREAD_STACK: u64 = 8 * 1024 * 1024;

#[test]
fn debug_binary_reserves_eight_mib_main_stack() {
    let bytes = std::fs::read(env!("CARGO_BIN_EXE_aster")).expect("read aster.exe");
    let reserve = pe32_plus_stack_reserve(&bytes).expect("PE32+ stack reserve");
    assert!(
        reserve >= UNIX_MAIN_THREAD_STACK,
        "SizeOfStackReserve was {reserve}, need at least {UNIX_MAIN_THREAD_STACK}"
    );
}

fn pe32_plus_stack_reserve(bytes: &[u8]) -> Option<u64> {
    let pe_offset = u32::from_le_bytes(bytes.get(0x3C..0x40)?.try_into().ok()?) as usize;
    if bytes.get(pe_offset..pe_offset + 4)? != b"PE\0\0" {
        return None;
    }
    let coff = pe_offset + 4;
    let size_of_optional = u16::from_le_bytes(bytes.get(coff + 16..coff + 18)?.try_into().ok()?);
    let optional = coff + 20;
    let optional_end = optional + size_of_optional as usize;
    let magic = u16::from_le_bytes(bytes.get(optional..optional + 2)?.try_into().ok()?);
    // PE32+ SizeOfStackReserve is at optional-header offset 72.
    if magic != 0x20B || optional_end < optional + 80 {
        return None;
    }
    Some(u64::from_le_bytes(
        bytes.get(optional + 72..optional + 80)?.try_into().ok()?,
    ))
}
