//! Compatibility stub for the retired in-tree Aster OS sandbox.
//!
//! **This crate is not an execution authority.** It never confines, mediates,
//! allows or denies a command; every enforcement entry point is a no-op,
//! `requires_*` is always false, and every `verify_*` **fails closed** with a
//! stable stub message so callers cannot treat a green check as enforcement.
//! Profiles resolve to [`ProfileName::Off`]. It exists only so the TUI/shell
//! keep compiling against the historical API. Do not read it for policy and do
//! not revive it.
//!
//! Command isolation is owned by `aster-core`'s `sandbox` module, whose native
//! adapter wraps **ksandbox**. Permission profile intersection and the stable
//! `sandbox.violation.*` codes live there too
//! (`crates/code/core/src/sandbox/permission_profile.rs`).

#![forbid(unsafe_code)]

use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::OnceLock;

static CONFIGURED_PROFILE: OnceLock<String> = OnceLock::new();
static AUTO_ALLOW_BASH: OnceLock<bool> = OnceLock::new();

/// Child-process network helpers (no-op).
pub mod child_net {
    use std::process::Command as StdCommand;
    use tokio::process::Command as TokioCommand;

    pub fn restrict_child_network(_cmd: &mut TokioCommand) {}

    pub fn restrict_child_network_std(_cmd: &mut StdCommand) {}
}

/// Built-in profile names retained for config parsing compatibility.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum ProfileName {
    Workspace,
    Devbox,
    ReadOnly,
    Strict,
    #[default]
    Off,
    Custom(String),
}

impl ProfileName {
    pub fn as_str(&self) -> &str {
        match self {
            Self::Workspace => "workspace",
            Self::Devbox => "devbox",
            Self::ReadOnly => "read-only",
            Self::Strict => "strict",
            Self::Off => "off",
            Self::Custom(name) => name.as_str(),
        }
    }
}

impl std::fmt::Display for ProfileName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for ProfileName {
    type Err = anyhow::Error;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        Ok(match value.trim().to_ascii_lowercase().as_str() {
            "workspace" => Self::Workspace,
            "devbox" => Self::Devbox,
            "read-only" | "readonly" => Self::ReadOnly,
            "strict" => Self::Strict,
            "off" | "none" | "" => Self::Off,
            other => Self::Custom(other.to_string()),
        })
    }
}

/// No conflicting sandbox config files are consulted.
pub fn sandbox_profile_conflicts(_workspace: &Path) -> Vec<String> {
    Vec::new()
}

pub fn requires_hook_write_deny(_profile: &ProfileName, _workspace: &Path) -> bool {
    false
}

pub fn requires_read_deny(_profile: &ProfileName, _workspace: &Path) -> bool {
    false
}

pub fn requires_data_write_deny(_profile: &ProfileName, _workspace: &Path) -> bool {
    false
}

pub fn is_inside_bwrap() -> bool {
    false
}

pub fn trust_bwrap_marker_for_devbox() -> bool {
    false
}

pub fn should_restrict_child_network() -> bool {
    false
}

pub fn should_auto_allow_bash() -> bool {
    *AUTO_ALLOW_BASH.get().unwrap_or(&false)
}

pub fn set_auto_allow_bash(enabled: bool) {
    let _ = AUTO_ALLOW_BASH.set(enabled);
}

pub fn set_configured_profile(name: impl Into<String>) {
    let _ = CONFIGURED_PROFILE.set(name.into());
}

pub fn configured_profile_name() -> Option<&'static str> {
    CONFIGURED_PROFILE.get().map(|value| value.as_str())
}

pub fn requested_confinement_profile() -> Option<&'static str> {
    None
}

pub fn is_active() -> bool {
    false
}

pub fn profile_name() -> Option<&'static str> {
    None
}

/// No-op: violations are reported by `aster-core` as `sandbox.violation.*` codes.
pub fn log_violation(_target: &str, _operation: &str) {}

pub fn flush() {}

pub fn bwrap_reexec_for_profile(
    _profile: &ProfileName,
    _workspace: &Path,
) -> Option<std::process::Command> {
    None
}

/// Stable refusal text when a caller asks the stub to prove OS deny mounts.
pub const STUB_NOT_ENFORCEMENT: &str = "aster-confine is a compatibility stub; not an enforcement authority (use aster-core sandbox/ksandbox)";

/// Hosts that need a boolean gate: this crate never enforces.
pub fn is_enforcement_authority() -> bool {
    false
}

pub fn verify_hook_write_deny_enforced() -> Result<(), String> {
    Err(STUB_NOT_ENFORCEMENT.to_string())
}

pub fn verify_read_deny_enforced(_profile: &ProfileName, _workspace: &Path) -> Result<(), String> {
    Err(STUB_NOT_ENFORCEMENT.to_string())
}

pub fn verify_data_write_deny_enforced(
    _profile: &ProfileName,
    _workspace: &Path,
) -> Result<(), String> {
    Err(STUB_NOT_ENFORCEMENT.to_string())
}

/// No-op manager retained for shell startup compatibility.
#[derive(Debug)]
pub struct SandboxManager {
    profile: ProfileName,
    workspace: PathBuf,
}

impl SandboxManager {
    pub fn new(profile: ProfileName, workspace: impl Into<PathBuf>) -> Self {
        Self {
            profile,
            workspace: workspace.into(),
        }
    }

    pub fn profile(&self) -> &ProfileName {
        &self.profile
    }

    pub fn workspace(&self) -> &Path {
        &self.workspace
    }

    pub fn apply(&mut self, _workspace: &Path) -> anyhow::Result<()> {
        tracing::debug!("aster-confine stub: apply is a no-op; use external kbox for isolation");
        Ok(())
    }

    pub fn is_applied(&self) -> bool {
        false
    }

    pub fn install(&mut self) {
        // No kernel confinement to install.
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn stub_is_not_an_enforcement_authority() {
        assert!(!is_enforcement_authority());
        assert!(!requires_hook_write_deny(
            &ProfileName::Strict,
            Path::new(".")
        ));
        assert!(!requires_read_deny(&ProfileName::Strict, Path::new(".")));
        assert!(!requires_data_write_deny(
            &ProfileName::Strict,
            Path::new(".")
        ));
    }

    #[test]
    fn verify_entry_points_fail_closed_with_stable_stub_message() {
        let workspace = PathBuf::from(".");
        let err = verify_hook_write_deny_enforced().expect_err("stub must refuse");
        assert_eq!(err, STUB_NOT_ENFORCEMENT);
        let err = verify_read_deny_enforced(&ProfileName::Workspace, &workspace)
            .expect_err("stub must refuse");
        assert_eq!(err, STUB_NOT_ENFORCEMENT);
        let err = verify_data_write_deny_enforced(&ProfileName::Devbox, &workspace)
            .expect_err("stub must refuse");
        assert_eq!(err, STUB_NOT_ENFORCEMENT);
    }
}
