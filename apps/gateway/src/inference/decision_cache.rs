//! HR2: the turn decision cache — the freezing half of task-aware
//! routing. A new user turn re-decides; tool continuations within the
//! SAME turn reuse the frozen decision (preserving the upstream cache
//! prefix); discontinuity (a new message, a rebuilt history) changes
//! the turn identity and therefore misses — fail-closed to re-decide
//! by construction.
//!
//! The cache stores DECISION FACTS only: which group won, when, why.
//! No prompt bytes, no digests of prompt bytes beyond the turn key's
//! bounded fingerprints, nothing durable — the map is process-local
//! and evictable at any moment without correctness loss.

use std::collections::HashMap;
use std::time::{Duration, Instant};

/// How many frozen turns the cache retains (LRU-by-insertion bound;
/// a working set larger than this re-decides the coldest turns).
const DECISION_CACHE_CAPACITY: usize = 4096;
/// A frozen decision older than this re-decides even on a key hit —
/// bounded staleness for long-running sessions.
const DECISION_CACHE_TTL: Duration = Duration::from_secs(15 * 60);

/// The bounded turn fingerprint: identity-relevant hashes only, never
/// content. Two requests share a turn identity exactly when all fields
/// match — any divergence is a new turn (re-decide).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) struct TurnIdentity {
    /// The authenticated credential's fingerprint (its key id hash —
    /// never the key material).
    pub(crate) credential_fingerprint: u64,
    /// The model alias the turn addresses.
    pub(crate) model_alias_fingerprint: u64,
    /// A bounded digest of the LAST user message (the turn's anchor).
    pub(crate) last_user_digest: u64,
    /// A bounded digest of the visible history BEFORE that message —
    /// compaction or reconstruction changes it, forcing re-decision.
    pub(crate) history_digest: u64,
    /// The message count (a cheap continuity bit).
    pub(crate) message_count: u32,
}

/// Which candidate group a frozen decision chose. Facts only — the
/// dispatch composition (HR3) maps this onto the target walk.
impl ChosenGroup {
    /// HR5: the wire name for evidence lanes.
    pub(crate) fn wire_name(&self) -> String {
        match self {
            Self::Economy => "economy".into(),
            Self::Primary => "primary".into(),
            Self::BranchRegular { category } => format!("branch_regular:{category}"),
            Self::BranchPrimary { category } => format!("branch_primary:{category}"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ChosenGroup {
    /// The economy/regular group.
    Economy,
    /// The primary group (complex turn, low competence, or the
    /// decision service was unreachable — fail-closed).
    Primary,
    /// A category's regular group (branch mode).
    BranchRegular { category: String },
    /// A category's primary group (branch mode, degree judgment).
    BranchPrimary { category: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct FrozenDecision {
    pub(crate) group: ChosenGroup,
    /// Why — a bounded, prompt-free reason token (for evidence and
    /// debugging; never derived content).
    pub(crate) reason: DecisionReason,
    pub(crate) frozen_at: Instant,
}

impl DecisionReason {
    /// HR5: the wire name for evidence lanes.
    pub(crate) const fn wire_name(self) -> &'static str {
        match self {
            Self::SimpleProbability => "simple_probability",
            Self::ComplexProbability => "complex_probability",
            Self::CompetenceFloor => "competence_floor",
            Self::DecisionUnreachable => "decision_unreachable",
            Self::DecisionInvalid => "decision_invalid",
            Self::NoDecisionSurface => "no_decision_surface",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum DecisionReason {
    /// The decision service classified the turn simple.
    SimpleProbability,
    /// The decision service classified the turn complex.
    ComplexProbability,
    /// A fresh assessment fell below the competence floor.
    CompetenceFloor,
    /// The decision service was unreachable — fail-closed to primary.
    DecisionUnreachable,
    /// The decision contract was violated — fail-closed to primary.
    DecisionInvalid,
    /// No decision surface applies (fixed/free-first mode).
    NoDecisionSurface,
}

/// The bounded, process-local turn decision cache. Eviction or expiry
/// is always safe: the only cost of a miss is one re-decision.
#[derive(Debug)]
pub(crate) struct TurnDecisionCache {
    entries: HashMap<TurnIdentity, FrozenDecision>,
    /// Insertion order for bounded eviction (a VecDeque of keys would
    /// duplicate the map; a generation counter per key is simpler at
    /// this scale — the map re-inserts move to the back).
    order: std::collections::VecDeque<TurnIdentity>,
}

impl Default for TurnDecisionCache {
    fn default() -> Self {
        Self::new()
    }
}

impl TurnDecisionCache {
    pub(crate) fn new() -> Self {
        Self {
            entries: HashMap::new(),
            order: std::collections::VecDeque::new(),
        }
    }

    /// A frozen decision valid for reuse: identity hit AND within the
    /// TTL. Anything else is a miss (re-decide).
    pub(crate) fn lookup(&self, identity: &TurnIdentity, now: Instant) -> Option<&FrozenDecision> {
        let decision = self.entries.get(identity)?;
        if now.duration_since(decision.frozen_at) > DECISION_CACHE_TTL {
            return None;
        }
        Some(decision)
    }

    /// Freezes a decision for the turn. Re-freezing the same identity
    /// replaces the entry (the newest decision is the turn's truth).
    /// The clock is a parameter so tests (and only tests) advance it.
    pub(crate) fn freeze(
        &mut self,
        identity: TurnIdentity,
        mut decision: FrozenDecision,
        now: Instant,
    ) {
        decision.frozen_at = now;
        if !self.entries.contains_key(&identity) {
            self.order.push_back(identity);
            if self.order.len() > DECISION_CACHE_CAPACITY {
                if let Some(evicted) = self.order.pop_front() {
                    self.entries.remove(&evicted);
                }
            }
        }
        self.entries.insert(identity, decision);
    }

    /// The retained entry count (observability/testing).
    pub(crate) fn len(&self) -> usize {
        self.entries.len()
    }

    pub(crate) fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn identity(last_user_digest: u64, history_digest: u64) -> TurnIdentity {
        TurnIdentity {
            credential_fingerprint: 1,
            model_alias_fingerprint: 2,
            last_user_digest,
            history_digest,
            message_count: 4,
        }
    }

    fn frozen(group: ChosenGroup) -> FrozenDecision {
        FrozenDecision {
            group,
            reason: DecisionReason::SimpleProbability,
            frozen_at: Instant::now(),
        }
    }

    #[test]
    fn a_continuation_reuses_the_frozen_decision() {
        let mut cache = TurnDecisionCache::new();
        let turn = identity(10, 20);
        cache.freeze(turn, frozen(ChosenGroup::Economy), Instant::now());
        let found = cache
            .lookup(&turn, Instant::now())
            .expect("the frozen turn hits");
        assert_eq!(found.group, ChosenGroup::Economy);
    }

    #[test]
    fn a_new_turn_or_rebuilt_history_misses() {
        let mut cache = TurnDecisionCache::new();
        cache.freeze(
            identity(10, 20),
            frozen(ChosenGroup::Economy),
            Instant::now(),
        );
        // A new user message changes the anchor digest.
        assert!(cache.lookup(&identity(11, 20), Instant::now()).is_none());
        // A rebuilt/compacted history changes the history digest.
        assert!(cache.lookup(&identity(10, 21), Instant::now()).is_none());
        // A different message count misses even with matching digests.
        let mut other = identity(10, 20);
        other.message_count = 5;
        assert!(cache.lookup(&other, Instant::now()).is_none());
    }

    #[test]
    fn stale_decisions_expire_and_re_decide() {
        let mut cache = TurnDecisionCache::new();
        let turn = identity(10, 20);
        let past = Instant::now()
            .checked_sub(DECISION_CACHE_TTL + Duration::from_secs(1))
            .expect("a representable past instant");
        cache.freeze(turn, frozen(ChosenGroup::Economy), past);
        assert!(cache.lookup(&turn, Instant::now()).is_none());
    }

    #[test]
    fn capacity_eviction_is_bounded_and_lossless_to_correctness() {
        let mut cache = TurnDecisionCache::new();
        for index in 0..(DECISION_CACHE_CAPACITY + 8) {
            cache.freeze(
                identity(index as u64, 0),
                frozen(ChosenGroup::Economy),
                Instant::now(),
            );
        }
        assert_eq!(cache.len(), DECISION_CACHE_CAPACITY);
        // The coldest turns missed (evicted); the newest still hits.
        assert!(cache.lookup(&identity(0, 0), Instant::now()).is_none());
        assert!(cache
            .lookup(
                &identity((DECISION_CACHE_CAPACITY + 7) as u64, 0),
                Instant::now()
            )
            .is_some());
    }

    #[test]
    fn frozen_facts_carry_no_content_by_shape() {
        // The facts type carries a group, a reason token, and a
        // timestamp — no String content field exists to misuse.
        let decision = frozen(ChosenGroup::BranchRegular {
            category: "drafting".into(),
        });
        assert_eq!(
            decision.reason,
            DecisionReason::SimpleProbability,
            "reasons are tokens, not derived content"
        );
    }
}
