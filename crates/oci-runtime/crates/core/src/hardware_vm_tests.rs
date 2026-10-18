#![cfg(test)]

use sha2::{Digest, Sha256};

use super::{
    admit_device, admit_guest_arch, boot_layout, checkpoint_pair_permitted, is_libkrun,
    profile_bytes, profile_for, restore_permitted, validate_profile_resources, virtiofs_share_mode,
    vm_only_permitted, GuestArch, HardwareVmError, HardwareVmProfile, CONTROL_CREDIT_WINDOW,
    CONTROL_RECORD_MAX_BYTES, DEVICE_ALLOWLIST, MEMORY_ALIGN_MIB, MEMORY_MAX_MIB, MEMORY_MIN_MIB,
    PROFILE_VERSION, VCPU_CHOICES,
};
use crate::{DriverKind, IsolationClass};

const PROFILE_SHA256: &str = "56f8192e40be87270ff34fcef11a824445eeb79a3bd5ce22af0e70b282015d21";

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn libkrun_drivers() -> [DriverKind; 3] {
    [
        DriverKind::LibkrunKvm,
        DriverKind::LibkrunHvf,
        DriverKind::LibkrunWhpx,
    ]
}

#[test]
fn profile_bytes_are_identical_for_every_libkrun_host_and_guest_arch() {
    let shared = profile_bytes(&HardwareVmProfile::shared());
    assert_eq!(shared.len(), 207);
    assert_eq!(sha256_hex(&shared), PROFILE_SHA256);
    assert_eq!(&shared[..4], &PROFILE_VERSION.to_le_bytes());
    for driver in libkrun_drivers() {
        for arch in GuestArch::all() {
            let profile = profile_for(driver, arch).expect("libkrun profile");
            assert_eq!(profile, HardwareVmProfile::shared());
            assert_eq!(profile_bytes(&profile), shared);
        }
    }
    let text = String::from_utf8_lossy(&shared);
    for tag in ["kvm", "hvf", "whpx", "x86_64", "aarch64", "linux-direct"] {
        assert!(!text.contains(tag), "{tag} leaked into profile bytes");
    }
}

#[test]
fn native_linux_is_not_a_hardware_vm_profile_host() {
    let error = profile_for(DriverKind::NativeLinux, GuestArch::X86_64).expect_err("native linux");
    assert_eq!(
        error,
        HardwareVmError::NotHardwareVmHost {
            driver: DriverKind::NativeLinux,
        }
    );
    assert!(!is_libkrun(DriverKind::NativeLinux));
    for driver in libkrun_drivers() {
        assert!(is_libkrun(driver));
    }
}

#[test]
fn boot_layouts_differ_by_guest_arch_and_stay_out_of_the_profile() {
    let x86_64 = boot_layout(GuestArch::X86_64);
    let aarch64 = boot_layout(GuestArch::Aarch64);
    assert_eq!(x86_64.protocol, "linux-direct-x86_64");
    assert_eq!(aarch64.protocol, "linux-direct-aarch64");
    assert_ne!(x86_64.protocol, aarch64.protocol);
}

#[test]
fn device_allowlist_is_versioned() {
    for device in DEVICE_ALLOWLIST {
        assert_eq!(admit_device(PROFILE_VERSION, device), Ok(()));
        assert_eq!(
            admit_device(PROFILE_VERSION + 1, device),
            Err(HardwareVmError::DeviceNotAllowed(device.to_string()))
        );
    }
    assert_eq!(
        admit_device(PROFILE_VERSION, "virtio-pci-blk"),
        Err(HardwareVmError::DeviceNotAllowed(
            "virtio-pci-blk".to_string()
        ))
    );
}

#[test]
fn resources_use_the_shared_bounds() {
    assert_eq!(validate_profile_resources(1, MEMORY_MIN_MIB), Ok(()));
    assert_eq!(validate_profile_resources(8, MEMORY_MAX_MIB), Ok(()));
    assert_eq!(
        validate_profile_resources(3, 256),
        Err(HardwareVmError::VcpuOutOfProfile(3))
    );
    assert_eq!(
        validate_profile_resources(1, 64),
        Err(HardwareVmError::MemoryOutOfProfile(64))
    );
    assert_eq!(
        validate_profile_resources(1, 129),
        Err(HardwareVmError::MemoryOutOfProfile(129))
    );
    assert_eq!(VCPU_CHOICES, [1, 2, 4, 8]);
    assert_eq!(MEMORY_ALIGN_MIB, 128);
    assert_eq!(CONTROL_RECORD_MAX_BYTES, 65_536);
    assert_eq!(CONTROL_CREDIT_WINDOW, 32);
}

#[test]
fn restore_requires_the_same_libkrun_driver_version_and_arch() {
    assert_eq!(
        restore_permitted(
            PROFILE_VERSION,
            GuestArch::X86_64,
            DriverKind::LibkrunKvm,
            PROFILE_VERSION,
            GuestArch::X86_64,
            DriverKind::LibkrunKvm,
        ),
        Ok(())
    );
    assert_eq!(
        restore_permitted(
            PROFILE_VERSION,
            GuestArch::X86_64,
            DriverKind::LibkrunKvm,
            PROFILE_VERSION,
            GuestArch::Aarch64,
            DriverKind::LibkrunKvm,
        ),
        Err(HardwareVmError::RestoreMismatch)
    );
    assert_eq!(
        restore_permitted(
            PROFILE_VERSION,
            GuestArch::X86_64,
            DriverKind::LibkrunKvm,
            PROFILE_VERSION,
            GuestArch::X86_64,
            DriverKind::LibkrunHvf,
        ),
        Err(HardwareVmError::RestoreMismatch)
    );
    assert_eq!(
        restore_permitted(
            PROFILE_VERSION,
            GuestArch::X86_64,
            DriverKind::NativeLinux,
            PROFILE_VERSION,
            GuestArch::X86_64,
            DriverKind::NativeLinux,
        ),
        Err(HardwareVmError::RestoreMismatch)
    );
}

#[test]
fn checkpoint_pairs_match_the_driver_isolation_matrix() {
    let permitted = [
        (DriverKind::NativeLinux, IsolationClass::SharedHostKernel),
        (DriverKind::LibkrunKvm, IsolationClass::DedicatedVm),
        (DriverKind::LibkrunKvm, IsolationClass::SharedGuestKernel),
        (DriverKind::LibkrunHvf, IsolationClass::DedicatedVm),
        (DriverKind::LibkrunHvf, IsolationClass::SharedGuestKernel),
        (DriverKind::LibkrunWhpx, IsolationClass::DedicatedVm),
        (DriverKind::LibkrunWhpx, IsolationClass::SharedGuestKernel),
    ];
    for (driver, isolation) in permitted {
        assert!(checkpoint_pair_permitted(driver, isolation));
    }
    let refused = [
        (DriverKind::NativeLinux, IsolationClass::DedicatedVm),
        (DriverKind::NativeLinux, IsolationClass::SharedGuestKernel),
        (DriverKind::LibkrunKvm, IsolationClass::SharedHostKernel),
        (DriverKind::LibkrunHvf, IsolationClass::SharedHostKernel),
        (DriverKind::LibkrunWhpx, IsolationClass::SharedHostKernel),
    ];
    for (driver, isolation) in refused {
        assert!(!checkpoint_pair_permitted(driver, isolation));
    }
}

#[test]
fn libkrun_guest_arch_is_x86_64_or_aarch64() {
    assert_eq!(admit_guest_arch("x86_64"), Ok(GuestArch::X86_64));
    assert_eq!(admit_guest_arch("aarch64"), Ok(GuestArch::Aarch64));
    assert_eq!(
        admit_guest_arch("riscv64"),
        Err(HardwareVmError::GuestArchNotAllowed("riscv64".to_string()))
    );
    assert_eq!(
        admit_guest_arch("X86_64"),
        Err(HardwareVmError::GuestArchNotAllowed("X86_64".to_string()))
    );
}

#[test]
fn vm_only_operations_allow_guest_kernels_and_refuse_the_host_kernel() {
    assert_eq!(vm_only_permitted(IsolationClass::DedicatedVm), Ok(()));
    assert_eq!(vm_only_permitted(IsolationClass::SharedGuestKernel), Ok(()));
    assert_eq!(
        vm_only_permitted(IsolationClass::SharedHostKernel),
        Err(HardwareVmError::SharedHostKernelRejectsVmOnly)
    );
}

#[test]
fn virtiofs_share_modes_follow_the_libkrun_host() {
    assert_eq!(
        virtiofs_share_mode(DriverKind::LibkrunKvm),
        Some("same-uid-private-per-generation-virtiofs")
    );
    assert_eq!(
        virtiofs_share_mode(DriverKind::LibkrunHvf),
        virtiofs_share_mode(DriverKind::LibkrunKvm)
    );
    assert_eq!(
        virtiofs_share_mode(DriverKind::LibkrunWhpx),
        Some("protected-per-generation-virtiofs")
    );
    assert_eq!(virtiofs_share_mode(DriverKind::NativeLinux), None);
}
