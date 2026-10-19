//! `H0.5-C3` hosted Function scale-from-zero activation demand.
//!
//! Gateway only observes ingress demand for a hosted Function whose snapshot has
//! no healthy target. Demand is bounded, in-memory, never desired state, and is
//! pulled by Cloud through the management API. Workloads alone decides whether
//! to add a replica; Gateway never calls Cloud on the request path.

use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use uuid::Uuid;

/// Distinct Workloads tracked at once; further Workloads are dropped until
/// existing entries expire, so an unauthenticated flood cannot grow memory.
pub const MAX_TRACKED_WORKLOADS: usize = 4096;
/// Demand older than this is forgotten; Cloud activation signals expire sooner.
pub const DEMAND_TTL: Duration = Duration::from_secs(60);
pub const MAX_HOLD: Duration = Duration::from_secs(60);
pub const DEFAULT_RETRY_AFTER_SECS: u64 = 5;
const MAX_RETRY_AFTER_SECS: u64 = 600;

/// Snapshot-declared activation for one hosted Function route without a
/// healthy target.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostedFunctionActivation {
    pub organization_id: Uuid,
    pub workload_id: Uuid,
    /// Present only when Cloud declared a bounded hold for this Workload.
    pub hold: Option<Duration>,
    pub retry_after_secs: u64,
}

impl HostedFunctionActivation {
    pub fn validate(&self) -> Result<(), String> {
        if self.organization_id.is_nil() || self.workload_id.is_nil() {
            return Err("hosted Function activation identity must not be nil".into());
        }
        if self
            .hold
            .is_some_and(|hold| hold.is_zero() || hold > MAX_HOLD)
        {
            return Err("hosted Function activation hold is out of bounds".into());
        }
        if self.retry_after_secs == 0 || self.retry_after_secs > MAX_RETRY_AFTER_SECS {
            return Err("hosted Function activation retry_after_s is out of bounds".into());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
struct DemandKey {
    organization_id: Uuid,
    workload_id: Uuid,
}

#[derive(Debug, Clone, Copy)]
struct DemandEntry {
    pending_requests: u32,
    first_observed_at: chrono::DateTime<chrono::Utc>,
    last_observed_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivationDemand {
    pub organization_id: Uuid,
    pub workload_id: Uuid,
    pub pending_requests: u32,
    pub first_observed_at: chrono::DateTime<chrono::Utc>,
    pub last_observed_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Default)]
pub struct ActivationDemandRegistry {
    entries: Mutex<HashMap<DemandKey, DemandEntry>>,
}

impl ActivationDemandRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Records one request. Returns `false` when the registry is saturated and
    /// the demand was dropped (the request still fails closed).
    pub fn record(
        &self,
        activation: &HostedFunctionActivation,
        now: chrono::DateTime<chrono::Utc>,
    ) -> bool {
        let Ok(mut entries) = self.entries.lock() else {
            return false;
        };
        prune(&mut entries, now);
        let key = DemandKey {
            organization_id: activation.organization_id,
            workload_id: activation.workload_id,
        };
        if let Some(entry) = entries.get_mut(&key) {
            entry.pending_requests = entry.pending_requests.saturating_add(1);
            entry.last_observed_at = now;
            return true;
        }
        if entries.len() >= MAX_TRACKED_WORKLOADS {
            return false;
        }
        entries.insert(
            key,
            DemandEntry {
                pending_requests: 1,
                first_observed_at: now,
                last_observed_at: now,
            },
        );
        true
    }

    /// Current unexpired demand, ordered for deterministic pulls.
    pub fn pending(&self, now: chrono::DateTime<chrono::Utc>) -> Vec<ActivationDemand> {
        let Ok(mut entries) = self.entries.lock() else {
            return Vec::new();
        };
        prune(&mut entries, now);
        let mut demand = entries
            .iter()
            .map(|(key, entry)| ActivationDemand {
                organization_id: key.organization_id,
                workload_id: key.workload_id,
                pending_requests: entry.pending_requests,
                first_observed_at: entry.first_observed_at,
                last_observed_at: entry.last_observed_at,
            })
            .collect::<Vec<_>>();
        demand.sort_by_key(|demand| (demand.organization_id, demand.workload_id));
        demand
    }
}

fn prune(entries: &mut HashMap<DemandKey, DemandEntry>, now: chrono::DateTime<chrono::Utc>) {
    let ttl = chrono::Duration::from_std(DEMAND_TTL).unwrap_or_else(|_| chrono::Duration::zero());
    entries.retain(|_, entry| now - entry.last_observed_at < ttl);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn activation(workload_id: Uuid) -> HostedFunctionActivation {
        HostedFunctionActivation {
            organization_id: Uuid::from_u128(1),
            workload_id,
            hold: None,
            retry_after_secs: DEFAULT_RETRY_AFTER_SECS,
        }
    }

    #[test]
    fn repeated_requests_accumulate_on_one_workload() {
        let registry = ActivationDemandRegistry::new();
        let now = chrono::Utc::now();
        let target = activation(Uuid::from_u128(2));
        assert!(registry.record(&target, now));
        assert!(registry.record(&target, now + chrono::Duration::seconds(1)));
        let pending = registry.pending(now + chrono::Duration::seconds(2));
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].pending_requests, 2);
        assert_eq!(pending[0].first_observed_at, now);
        assert_eq!(
            pending[0].last_observed_at,
            now + chrono::Duration::seconds(1)
        );
    }

    #[test]
    fn demand_expires_after_ttl() {
        let registry = ActivationDemandRegistry::new();
        let now = chrono::Utc::now();
        registry.record(&activation(Uuid::from_u128(2)), now);
        let later = now + chrono::Duration::from_std(DEMAND_TTL).unwrap();
        assert!(registry.pending(later).is_empty());
    }

    #[test]
    fn registry_is_bounded_and_drops_new_workloads_when_full() {
        let registry = ActivationDemandRegistry::new();
        let now = chrono::Utc::now();
        for index in 0..MAX_TRACKED_WORKLOADS {
            assert!(registry.record(&activation(Uuid::from_u128(index as u128 + 10)), now));
        }
        assert!(!registry.record(&activation(Uuid::from_u128(1)), now));
        // Existing Workloads still accumulate.
        assert!(registry.record(&activation(Uuid::from_u128(10)), now));
        assert_eq!(registry.pending(now).len(), MAX_TRACKED_WORKLOADS);
    }

    #[test]
    fn activation_bounds_are_validated() {
        let mut target = activation(Uuid::from_u128(2));
        target.validate().expect("valid");
        target.hold = Some(Duration::ZERO);
        assert!(target.validate().is_err());
        target.hold = Some(MAX_HOLD + Duration::from_millis(1));
        assert!(target.validate().is_err());
        target.hold = Some(Duration::from_secs(10));
        target.retry_after_secs = 0;
        assert!(target.validate().is_err());
        target.retry_after_secs = 5;
        target.workload_id = Uuid::nil();
        assert!(target.validate().is_err());
    }
}

/// ED2: the generalized request-parking policy — the H0.5-C3 hold lifted
/// to any route. A route declaring `parking { hold_ms, retry_after_secs }`
/// holds holdable requests (body-less, no transfer-encoding) for the
/// declared bound while the route's service has no healthy backend,
/// re-routing after the next applied snapshot; anything else answers
/// 503 `target_activating` with a bounded Retry-After. Saturation and
/// wake decisions stay with Cloud/Workloads — Gateway never calls Cloud
/// on the request path (invariant 1).
pub const MAX_PARKING_HOLD: Duration = Duration::from_secs(60);
pub const MIN_PARKING_RETRY_AFTER_SECS: u64 = 1;
pub const MAX_PARKING_RETRY_AFTER_SECS: u64 = 600;
pub const DEFAULT_PARKING_RETRY_AFTER_SECS: u64 = 5;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RequestParkingPolicy {
    /// Bounded hold, clamped to [`MAX_PARKING_HOLD`].
    pub hold_ms: u64,
    /// Bounded Retry-After for the 503 path.
    pub retry_after_secs: u64,
}

impl RequestParkingPolicy {
    pub fn new(hold_ms: u64, retry_after_secs: u64) -> Self {
        Self {
            hold_ms: hold_ms.min(MAX_PARKING_HOLD.as_millis() as u64),
            retry_after_secs: retry_after_secs
                .clamp(MIN_PARKING_RETRY_AFTER_SECS, MAX_PARKING_RETRY_AFTER_SECS),
        }
    }

    pub fn hold(&self) -> Duration {
        Duration::from_millis(self.hold_ms).min(MAX_PARKING_HOLD)
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.hold_ms == 0 || self.hold_ms > MAX_PARKING_HOLD.as_millis() as u64 {
            return Err("route parking hold is out of bounds".into());
        }
        if self.retry_after_secs < MIN_PARKING_RETRY_AFTER_SECS
            || self.retry_after_secs > MAX_PARKING_RETRY_AFTER_SECS
        {
            return Err("route parking retry_after is out of bounds".into());
        }
        Ok(())
    }
}

#[cfg(test)]
mod parking_tests {
    use super::*;

    #[test]
    fn parking_policy_clamps_to_the_platform_bounds() {
        let policy = RequestParkingPolicy::new(120_000, 10_000);
        assert_eq!(policy.hold(), MAX_PARKING_HOLD);
        assert_eq!(policy.retry_after_secs, MAX_PARKING_RETRY_AFTER_SECS);
        let zero = RequestParkingPolicy::new(5_000, 0);
        assert_eq!(zero.retry_after_secs, MIN_PARKING_RETRY_AFTER_SECS);
    }

    #[test]
    fn parking_bounds_fail_closed() {
        let mut policy = RequestParkingPolicy::new(5_000, 5);
        policy.validate().expect("valid");
        policy.hold_ms = 0;
        assert!(policy.validate().is_err());
        policy.hold_ms = 61_000;
        assert!(policy.validate().is_err());
        policy.hold_ms = 5_000;
        policy.retry_after_secs = 601;
        assert!(policy.validate().is_err());
    }
}
