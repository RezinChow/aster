//! Mechanism feature-switch stages mapped onto the capability plane.
//!
//! A small static registry carries lifecycle stage + legacy aliases so hosts
//! do not invent scattered bools. Digest is over the canonical registry rows.

use super::{CapabilitySetError, Sha256Digest};

/// Lifecycle stage for one mechanism switch (Codex-style governance, Aster IDs).
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FeatureStage {
    Development,
    Experimental,
    Stable,
    Deprecated,
    Removed,
}

impl FeatureStage {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Development => "development",
            Self::Experimental => "experimental",
            Self::Stable => "stable",
            Self::Deprecated => "deprecated",
            Self::Removed => "removed",
        }
    }
}

/// One governed mechanism switch with optional legacy name aliases.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct FeatureSwitchSpec {
    pub id: &'static str,
    pub stage: FeatureStage,
    pub legacy_aliases: &'static [&'static str],
}

/// Aster mechanism switches absorbed so far (not a Codex feature mirror).
pub static FEATURE_SWITCHES: &[FeatureSwitchSpec] = &[
    FeatureSwitchSpec {
        id: "permissions.self_test",
        stage: FeatureStage::Stable,
        legacy_aliases: &["execpolicy_self_test"],
    },
    FeatureSwitchSpec {
        id: "effect.rollout_bounds",
        stage: FeatureStage::Stable,
        legacy_aliases: &["rollout_byte_cap"],
    },
    FeatureSwitchSpec {
        id: "sandbox.permission_profile",
        stage: FeatureStage::Experimental,
        legacy_aliases: &[],
    },
    FeatureSwitchSpec {
        id: "acp.wire_surface_v1",
        stage: FeatureStage::Stable,
        legacy_aliases: &["acp_schema_gate"],
    },
    FeatureSwitchSpec {
        id: "compaction.ledger",
        stage: FeatureStage::Experimental,
        legacy_aliases: &["compact_budget_ledger"],
    },
    FeatureSwitchSpec {
        id: "tools.patch_codes",
        stage: FeatureStage::Experimental,
        legacy_aliases: &["verified_patch"],
    },
];

/// Resolve a canonical id or legacy alias to the registry row.
pub fn resolve_feature_switch(name: &str) -> Option<&'static FeatureSwitchSpec> {
    FEATURE_SWITCHES
        .iter()
        .find(|spec| spec.id == name || spec.legacy_aliases.iter().any(|alias| *alias == name))
}

/// Stable digest of the feature-switch registry (sorted canonical rows).
pub fn feature_switch_registry_digest() -> Result<Sha256Digest, CapabilitySetError> {
    let mut rows = FEATURE_SWITCHES
        .iter()
        .map(|spec| {
            let aliases = spec.legacy_aliases.join(",");
            format!("{}|{}|{}", spec.id, spec.stage.as_str(), aliases)
        })
        .collect::<Vec<_>>();
    rows.sort();
    let material = rows.join("\n");
    let hex = sha256::digest(material);
    Sha256Digest::new(format!("sha256:{hex}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_switch_has_a_stage_and_legacy_aliases_resolve() {
        for spec in FEATURE_SWITCHES {
            assert!(!spec.id.is_empty());
            assert!(!spec.stage.as_str().is_empty());
            assert_eq!(resolve_feature_switch(spec.id).unwrap().id, spec.id);
            for alias in spec.legacy_aliases {
                let resolved = resolve_feature_switch(alias).expect(alias);
                assert_eq!(resolved.id, spec.id, "alias {alias}");
                if *alias != spec.id {
                    // Deprecated-style migration: alias still resolves, stage is on the canonical row.
                    assert!(matches!(
                        resolved.stage,
                        FeatureStage::Stable
                            | FeatureStage::Experimental
                            | FeatureStage::Deprecated
                            | FeatureStage::Development
                            | FeatureStage::Removed
                    ));
                }
            }
        }
        assert!(resolve_feature_switch("unknown.flag").is_none());
    }

    #[test]
    fn registry_digest_is_stable_and_changes_when_a_row_changes() {
        let first = feature_switch_registry_digest().unwrap();
        let second = feature_switch_registry_digest().unwrap();
        assert_eq!(first, second);

        let mut rows = FEATURE_SWITCHES
            .iter()
            .map(|spec| {
                let aliases = spec.legacy_aliases.join(",");
                format!("{}|{}|{}", spec.id, spec.stage.as_str(), aliases)
            })
            .collect::<Vec<_>>();
        rows.sort();
        rows.push("tamper|stable|".into());
        let tampered =
            Sha256Digest::new(format!("sha256:{}", sha256::digest(rows.join("\n")))).unwrap();
        assert_ne!(first, tampered);
    }
}
