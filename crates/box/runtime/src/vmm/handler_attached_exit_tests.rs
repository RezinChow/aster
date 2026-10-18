#![cfg(test)]

use super::*;
use std::process::Command;

// The test owns the original Child; the attached handler never does. Cleanup
// belongs to this fixture and supplies no product termination confirmation.
struct AttachedFixture {
    child: Child,
    start_time: u64,
}

impl AttachedFixture {
    fn sleeping() -> Self {
        #[cfg(unix)]
        let child = Command::new("sleep").arg("30").spawn().unwrap();
        #[cfg(windows)]
        let child = Command::new("powershell.exe")
            .args(["-NoProfile", "-Command", "Start-Sleep -Seconds 30"])
            .spawn()
            .unwrap();
        let start_time = crate::process::pid_start_time(child.id()).unwrap();
        Self { child, start_time }
    }

    fn attached(&self) -> ShimHandler {
        ShimHandler::from_recorded_pid(
            self.child.id(),
            self.start_time,
            "attached-fixture".to_string(),
        )
        .unwrap()
    }
}

impl Drop for AttachedFixture {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let deadline = Instant::now() + Duration::from_secs(2);
        loop {
            match self.child.try_wait() {
                Ok(Some(_)) | Err(_) => break,
                Ok(None) if Instant::now() < deadline => {
                    std::thread::sleep(Duration::from_millis(5));
                }
                Ok(None) => break,
            }
        }
    }
}

#[cfg(unix)]
#[test]
fn attached_budget_refuses_all_unqualified_identities() {
    let mut live = AttachedFixture::sleeping();
    let mut dead = AttachedFixture::sleeping();
    let dead_handler = dead.attached();
    dead.child.kill().unwrap();
    let deadline = Instant::now() + Duration::from_secs(2);
    loop {
        if dead.child.try_wait().unwrap().is_some() {
            break;
        }
        assert!(Instant::now() < deadline, "controlled child did not exit");
        std::thread::sleep(Duration::from_millis(5));
    }
    let mut missing_token = live.attached();
    missing_token.pid_start_time = None;
    let stale = ShimHandler::from_recorded_pid(
        live.child.id(),
        live.start_time.wrapping_add(1),
        "stale-attached-fixture".to_string(),
    )
    .unwrap();
    assert_eq!(stale.pid_start_time, Some(live.start_time.wrapping_add(1)));
    assert!(ShimHandler::from_recorded_pid(0, live.start_time, "zero".to_string()).is_err());

    let mut handlers = [
        ShimHandler::from_pid(live.child.id(), "sampled".to_string()),
        live.attached(),
        stale,
        missing_token,
        ShimHandler::from_pid(999_999_999, "missing".to_string()),
        dead_handler,
    ];
    for handler in &mut handlers {
        for admission in [Instant::now(), Instant::now() - Duration::from_secs(10)] {
            let budget = OwnedCloseBudget::from_admission(admission, Duration::ZERO).unwrap();
            assert!(handler.stop_with_budget(libc::SIGKILL, budget).is_err());
            assert!(handler.process.is_none());
            assert!(handler.exit_confirmation().is_none());
            assert_eq!(handler.exit_code(), None);
            assert_eq!(handler.try_wait_exit().unwrap(), None);
        }
    }
    assert!(live.child.try_wait().unwrap().is_none());
}

#[cfg(unix)]
#[test]
fn unix_live_attached_legacy_stop_refuses_without_signalling() {
    let mut fixture = AttachedFixture::sleeping();
    for mut handler in [
        fixture.attached(),
        ShimHandler::from_pid(fixture.child.id(), "sampled".to_string()),
    ] {
        assert!(handler.stop(libc::SIGKILL, 0).is_err());
        assert!(fixture.child.try_wait().unwrap().is_none());
        assert!(handler.process.is_none());
        assert!(handler.exit_confirmation().is_none());
    }
}

#[cfg(windows)]
#[test]
fn windows_attached_handle_identity_mismatch_refuses_force() {
    let mut fixture = AttachedFixture::sleeping();
    assert!(wait_then_terminate_attached_process(
        fixture.child.id(),
        fixture.start_time.wrapping_add(1),
        "mismatched-handle",
        0,
    )
    .is_err());
    assert!(fixture.child.try_wait().unwrap().is_none());
}

#[cfg(windows)]
#[test]
fn windows_attached_force_waits_for_same_process_handle() {
    let mut fixture = AttachedFixture::sleeping();
    let mut handler = fixture.attached();
    handler.stop(15, 0).unwrap();
    assert!(fixture.child.try_wait().unwrap().is_some());
    assert!(handler.process.is_none());
    assert!(handler.exit_confirmation().is_none());
    assert_eq!(handler.exit_code(), None);
    let budget = OwnedCloseBudget::from_admission(Instant::now(), Duration::ZERO).unwrap();
    assert!(handler.stop_with_budget(15, budget).is_err());
}
