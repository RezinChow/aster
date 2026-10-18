#![cfg(test)]

use super::*;

#[test]
fn owned_close_budget_keeps_original_deadline_and_saturates_after_expiry() {
    let admitted = Instant::now();
    let budget = OwnedCloseBudget::from_admission(admitted, Duration::from_secs(7)).unwrap();
    assert_eq!(budget.admitted_at(), admitted);
    assert_eq!(budget.grace_deadline(), admitted + Duration::from_secs(7));
    assert_eq!(
        budget.physical_deadline(),
        admitted + Duration::from_secs(12)
    );
    assert_eq!(
        budget.remaining_grace_at(admitted + Duration::from_secs(9)),
        Duration::ZERO
    );
    assert_eq!(
        budget.remaining_physical_at(admitted + Duration::from_secs(9)),
        Duration::from_secs(3)
    );
    assert_eq!(
        budget.remaining_physical_at(admitted + Duration::from_secs(13)),
        Duration::ZERO
    );
    let zero_grace = OwnedCloseBudget::from_admission(admitted, Duration::ZERO).unwrap();
    assert_eq!(
        zero_grace.physical_deadline(),
        admitted + Duration::from_secs(5)
    );
}

#[test]
fn ancillary_budget_is_separate_and_expired_budget_cannot_reset_itself() {
    let admitted = Instant::now();
    let budget = OwnedCleanupBudget::from_validation(admitted).unwrap();
    assert_eq!(budget.admitted_at(), admitted);
    assert_eq!(budget.deadline(), admitted + Duration::from_secs(10));
    assert_eq!(
        budget.remaining_at(admitted + Duration::from_secs(8)),
        Duration::from_secs(2)
    );
    assert_eq!(
        budget.remaining_at(admitted + Duration::from_secs(11)),
        Duration::ZERO
    );
    assert!(OwnedCloseBudget::from_admission(admitted, Duration::MAX).is_err());
}

#[test]
fn compatible_handler_default_refuses_without_invoking_legacy_stop() {
    struct LegacyHandler {
        stops: usize,
    }
    impl VmHandler for LegacyHandler {
        fn stop(&mut self, _: i32, _: u64) -> Result<()> {
            self.stops += 1;
            Ok(())
        }
        fn metrics(&self) -> VmMetrics {
            VmMetrics::default()
        }
        fn is_running(&self) -> bool {
            true
        }
        fn pid(&self) -> u32 {
            19
        }
    }
    let mut handler = LegacyHandler { stops: 0 };
    let budget = OwnedCloseBudget::from_admission(Instant::now(), Duration::ZERO).unwrap();
    assert!(handler.stop_with_budget(15, budget).is_err());
    assert_eq!(handler.stops, 0);
    assert!(handler.exit_confirmation().is_none());
}

#[test]
fn exit_evidence_kind_is_closed_and_attached_has_no_owned_status() {
    for kind in [
        VmExitEvidenceKind::OwnedReaped,
        VmExitEvidenceKind::AttachedObserved,
    ] {
        assert_eq!(VmExitEvidenceKind::parse(kind.as_str()).unwrap(), kind);
    }
    for invalid in ["", "owned", "OwnedReaped", "unknown"] {
        assert!(VmExitEvidenceKind::parse(invalid)
            .unwrap_err()
            .to_string()
            .contains("VmExitEvidenceKind"));
    }
    assert!(VmExitConfirmation::attached_observed(0, 37).is_err());
    let attached = VmExitConfirmation::attached_observed(19, 37).unwrap();
    assert_eq!(attached.kind(), VmExitEvidenceKind::AttachedObserved);
    assert_eq!(attached.pid(), 19);
    assert_eq!(attached.pid_start_time(), Some(37));
    assert!(attached.status().is_none());
}
