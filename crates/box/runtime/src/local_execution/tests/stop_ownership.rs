#![cfg(test)]

use super::*;

#[tokio::test]
async fn stop_failure_preserves_owner_if_backend_becomes_unready() {
    let (_directory, manager, backend) = harness();
    let mut create = request("stop-unready-owner");
    create.config.isolation = ExecutionIsolation::Microvm;
    let running = manager
        .create_and_start(create, &operation("stop-unready-owner-create"))
        .await
        .unwrap();
    let before = persisted(&manager, &running.execution_id);
    backend.fail_kill.store(true, Ordering::Relaxed);
    backend
        .executions
        .lock()
        .unwrap()
        .get_mut(running.execution_id.as_str())
        .unwrap()
        .state = ExecutionState::Creating;

    assert!(manager
        .kill(&running.execution_id, running.generation)
        .await
        .is_err());

    let after = persisted(&manager, &running.execution_id);
    assert_eq!(
        after.managed_state().unwrap(),
        Some(ManagedExecutionState::Killing)
    );
    assert_eq!(after.pid, before.pid);
    assert_eq!(after.pid_start_time, before.pid_start_time);
    assert!(after.exit_code.is_none());
    assert!(!after.stopped_by_user);
}

#[tokio::test]
async fn stop_failure_without_a_started_process_can_retire_a_creation() {
    let (_directory, manager, backend) = harness();
    let reservation = manager
        .create(
            request("stop-unstarted"),
            &operation("stop-unstarted-create"),
        )
        .await
        .unwrap();
    let record = persisted(&manager, &reservation.execution_id);
    assert!(record.pid.is_none());
    backend.executions.lock().unwrap().insert(
        record.id.clone(),
        FakeExecution {
            state: ExecutionState::Creating,
            handle: FakeBackend::handle(&record),
            exit_code: None,
        },
    );
    backend.fail_kill.store(true, Ordering::Relaxed);

    assert_eq!(
        manager
            .kill(&reservation.execution_id, reservation.generation)
            .await
            .unwrap(),
        KillOutcome::AlreadyStopped
    );
    let after = persisted(&manager, &reservation.execution_id);
    assert_eq!(
        after.managed_state().unwrap(),
        Some(ManagedExecutionState::Failed)
    );
    assert!(after.exit_code.is_none());
}
