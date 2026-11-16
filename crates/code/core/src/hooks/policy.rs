//! Hook admission policy (P2-9).
//!
//! Documents the mandatory gate set and enforces managed-only admission so
//! user-supplied hooks can be ignored without expanding the event enum.

use super::HookEventType;

/// Mandatory gate events hosts may require for managed deployments.
///
/// This is a closed documentation/admission set — it does not add new
/// [`HookEventType`] variants.
pub const MANDATORY_HOOK_GATES: &[HookEventType] = &[
    HookEventType::SessionStart,
    HookEventType::PreToolUse,
    HookEventType::PostToolUse,
    HookEventType::SessionEnd,
];

/// Where a hook binding came from.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum HookSource {
    /// Host / managed catalog (trusted).
    Managed,
    /// User or workspace-discovered binding.
    User,
}

/// Admission posture for registering hooks into an engine.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct HookAdmissionPolicy {
    /// When true, only [`HookSource::Managed`] hooks are admitted.
    pub managed_only: bool,
}

impl Default for HookAdmissionPolicy {
    fn default() -> Self {
        Self {
            managed_only: false,
        }
    }
}

impl HookAdmissionPolicy {
    pub const fn managed_only() -> Self {
        Self { managed_only: true }
    }

    /// Whether a hook from `source` may be registered under this policy.
    pub fn admits(&self, source: HookSource) -> bool {
        !self.managed_only || matches!(source, HookSource::Managed)
    }
}

/// True when `event` is in the mandatory gate set.
pub fn is_mandatory_hook_gate(event: HookEventType) -> bool {
    MANDATORY_HOOK_GATES.contains(&event)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mandatory_gate_set_is_closed_and_non_empty() {
        assert!(!MANDATORY_HOOK_GATES.is_empty());
        assert!(is_mandatory_hook_gate(HookEventType::PreToolUse));
        assert!(!is_mandatory_hook_gate(HookEventType::PostCompact));
    }

    #[test]
    fn managed_only_ignores_user_hooks() {
        let policy = HookAdmissionPolicy::managed_only();
        assert!(policy.admits(HookSource::Managed));
        assert!(!policy.admits(HookSource::User));

        let open = HookAdmissionPolicy::default();
        assert!(open.admits(HookSource::User));
        assert!(open.admits(HookSource::Managed));
    }
}
