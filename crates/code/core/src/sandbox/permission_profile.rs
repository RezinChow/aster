//! Permission profile intersection and stable sandbox violation codes.
//!
//! This module is pure policy arithmetic. It starts no process and grants no
//! authority: the only execution backend is the ksandbox-backed adapter in
//! [`super::native`]. An intersection that cannot be proven fails closed with a
//! [`ProfileIntersectError`]; callers must refuse the request, never fall back
//! to a wider profile.
//!
//! Violation codes are the stable, machine-readable identity of a sandbox
//! refusal. Backends surface one by returning a typed [`SandboxViolation`]; the
//! `bash` tool records it as `metadata.sandbox_violation.code` instead of
//! asking consumers to scrape stderr.

use super::{NetworkGrant, SandboxNetworkMode};

/// Stable violation code strings. Never reword; consumers match on them.
pub mod violation_code {
    pub const FILESYSTEM_DENIED: &str = "sandbox.violation.filesystem_denied";
    pub const NETWORK_DENIED: &str = "sandbox.violation.network_denied";
    pub const LIFETIME_UNQUALIFIED: &str = "sandbox.violation.lifetime_unqualified";
    pub const PROFILE_INTERSECT_REFUSED: &str = "sandbox.violation.profile_intersect_refused";
}

/// Closed set of sandbox violation kinds.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SandboxViolationCode {
    FilesystemDenied,
    NetworkDenied,
    LifetimeUnqualified,
    ProfileIntersectRefused,
}

impl SandboxViolationCode {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::FilesystemDenied => violation_code::FILESYSTEM_DENIED,
            Self::NetworkDenied => violation_code::NETWORK_DENIED,
            Self::LifetimeUnqualified => violation_code::LIFETIME_UNQUALIFIED,
            Self::ProfileIntersectRefused => violation_code::PROFILE_INTERSECT_REFUSED,
        }
    }
}

/// A typed sandbox refusal. Backends return this (inside `anyhow::Error`) so
/// the tool layer can attach a stable code without inspecting message text.
///
/// Returning it from an execution method asserts the command did not start:
/// the `bash` tool settles it as a pre-spawn refusal.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("{}: {message}", code.as_str())]
pub struct SandboxViolation {
    code: SandboxViolationCode,
    message: String,
}

impl SandboxViolation {
    pub fn new(code: SandboxViolationCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn code(&self) -> SandboxViolationCode {
        self.code
    }

    pub fn message(&self) -> &str {
        &self.message
    }
}

/// The stable code carried by `error` or any cause in its chain.
pub fn violation_code_of(error: &anyhow::Error) -> Option<SandboxViolationCode> {
    error
        .chain()
        .find_map(|cause| cause.downcast_ref::<SandboxViolation>())
        .map(SandboxViolation::code)
}

/// Why an intersection could not be formed. Every variant is a refusal.
#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum ProfileIntersectError {
    #[error("no permission profiles to intersect")]
    NoProfiles,
    #[error("a deny network profile cannot carry network grants")]
    DenyWithGrants,
    #[error("a mediated network profile needs at least one grant")]
    MediatedWithoutGrants,
    #[error("the mediated network allowlists share no grant")]
    EmptyMediatedIntersection,
}

impl ProfileIntersectError {
    pub const fn violation_code(self) -> SandboxViolationCode {
        SandboxViolationCode::ProfileIntersectRefused
    }
}

impl From<ProfileIntersectError> for SandboxViolation {
    fn from(error: ProfileIntersectError) -> Self {
        Self::new(error.violation_code(), error.to_string())
    }
}

/// Network authority a command may use. `Deny` carries no grants; `Mediated`
/// carries a non-empty allowlist. Both invariants hold from construction.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PermissionProfile {
    network: SandboxNetworkMode,
    network_allow: Vec<NetworkGrant>,
}

impl PermissionProfile {
    pub fn new(
        network: SandboxNetworkMode,
        network_allow: Vec<NetworkGrant>,
    ) -> Result<Self, ProfileIntersectError> {
        match (network, network_allow.is_empty()) {
            (SandboxNetworkMode::Deny, false) => Err(ProfileIntersectError::DenyWithGrants),
            (SandboxNetworkMode::Mediated, true) => {
                Err(ProfileIntersectError::MediatedWithoutGrants)
            }
            _ => Ok(Self {
                network,
                network_allow,
            }),
        }
    }

    pub fn deny() -> Self {
        Self {
            network: SandboxNetworkMode::Deny,
            network_allow: Vec::new(),
        }
    }

    pub fn network(&self) -> SandboxNetworkMode {
        self.network
    }

    pub fn network_allow(&self) -> &[NetworkGrant] {
        &self.network_allow
    }

    /// Whether every authority in `self` is also granted by `other`.
    pub fn is_subset_of(&self, other: &Self) -> bool {
        match (self.network, other.network) {
            (SandboxNetworkMode::Deny, _) => true,
            (SandboxNetworkMode::Mediated, SandboxNetworkMode::Deny) => false,
            (SandboxNetworkMode::Mediated, SandboxNetworkMode::Mediated) => self
                .network_allow
                .iter()
                .all(|grant| other.network_allow.iter().any(|wide| covers(wide, grant))),
        }
    }
}

/// Intersect profiles; the result is a subset of every input.
///
/// Any `Deny` input yields `Deny`. All-`Mediated` inputs intersect their
/// allowlists, and an empty result is refused rather than widened.
pub fn intersect_permission_profiles(
    profiles: &[PermissionProfile],
) -> Result<PermissionProfile, ProfileIntersectError> {
    let (first, rest) = profiles
        .split_first()
        .ok_or(ProfileIntersectError::NoProfiles)?;
    if profiles
        .iter()
        .any(|profile| profile.network == SandboxNetworkMode::Deny)
    {
        return Ok(PermissionProfile::deny());
    }
    let mut allow = first.network_allow.clone();
    for profile in rest {
        allow = intersect_grants(&allow, &profile.network_allow);
    }
    PermissionProfile::new(SandboxNetworkMode::Mediated, allow)
        .map_err(|_| ProfileIntersectError::EmptyMediatedIntersection)
}

/// Intersect a request with the base profile it must stay inside.
pub fn intersect_profile_with_request(
    base: &PermissionProfile,
    request: &PermissionProfile,
) -> Result<PermissionProfile, ProfileIntersectError> {
    intersect_permission_profiles(&[base.clone(), request.clone()])
}

/// `wide` covers `narrow` when hosts match exactly and `wide` pins no port or
/// the same port.
fn covers(wide: &NetworkGrant, narrow: &NetworkGrant) -> bool {
    wide.host == narrow.host && (wide.port.is_none() || wide.port == narrow.port)
}

fn intersect_grants(left: &[NetworkGrant], right: &[NetworkGrant]) -> Vec<NetworkGrant> {
    let mut out: Vec<NetworkGrant> = Vec::new();
    for a in left {
        for b in right {
            if a.host != b.host {
                continue;
            }
            let port = match (a.port, b.port) {
                (None, port) | (port, None) => port,
                (Some(x), Some(y)) if x == y => Some(x),
                _ => continue,
            };
            let grant = NetworkGrant {
                host: a.host.clone(),
                port,
            };
            if !out.contains(&grant) {
                out.push(grant);
            }
        }
    }
    out
}

#[cfg(test)]
mod tests;
