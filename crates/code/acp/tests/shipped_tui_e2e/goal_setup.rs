use super::*;

#[test]
fn goal_setup_reports_progress_and_resumes_after_cancellation() {
    interrupt_planning(true);
}

#[test]
#[ignore = "holds a provider request for the 120-second interactive setup deadline"]
fn goal_setup_deadline_returns_control_and_preserves_the_goal() {
    interrupt_planning(false);
}

fn interrupt_planning(cancel: bool) {
    let root = tempfile::tempdir().unwrap();
    let workspace = root.path().join("workspace");
    let home = root.path().join("home");
    std::fs::create_dir_all(&workspace).unwrap();
    std::fs::create_dir_all(&home).unwrap();
    let (addr, state) = spawn_mock(
        &workspace.join("unused-write"),
        &workspace.join("unused-command"),
    );
    let (hold, requests) = std::sync::mpsc::channel();
    state.lock().unwrap().held_goal_plan = Some(hold);
    let config = write_acl(&home, &workspace, &format!("http://{addr}/v1"));
    let source = std::fs::read_to_string(&config).unwrap();
    std::fs::write(&config, source + "\nmemory { llm_extraction = false }\n").unwrap();
    let owned = child_env(&binaries::acp_binary(), &config, &home);
    let env: Vec<_> = owned
        .iter()
        .filter(|(key, _)| key != "ASTER_ACP_AGENT_BIN")
        .map(|(key, value)| (key.as_str(), value.as_str()))
        .collect();
    let binary = tui_binary();
    let cwd = workspace.to_str().unwrap();
    let args = ["--cwd", cwd, "--fullscreen", "--trust"];
    let mut pty = open_pty_cleared(&binary, &args, &env, &workspace);
    pty.wait_for(MODEL_ID, Duration::from_secs(45));
    pty.type_text("/goal Verify the workspace remains ready");
    pty.enter();
    let started = Instant::now();
    pty.wait_for("Preparing the goal plan", Duration::from_secs(8));
    let mut pending = requests
        .recv_timeout(Duration::from_secs(8))
        .expect("model request entered");
    let goal = wait_goal_fact(&mut pty, &workspace, "aster.goal.created");
    let session_id = goal["payload"]["session_id"].as_str().unwrap();
    if cancel {
        pty.write_bytes(b"\x03");
    } else {
        pty.wait_for("Goal planning timed out", Duration::from_secs(125));
        assert!(started.elapsed() >= Duration::from_secs(119));
    }
    pending
        .set_read_timeout(Some(Duration::from_secs(5)))
        .unwrap();
    assert_eq!(pending.read(&mut [0]).expect("planner disconnected"), 0);
    assert!(!log_text(&workspace).contains("aster.goal.plan.proposed"));
    eprintln!(
        "Goal setup returned in {:.2}s (cancel={cancel})",
        started.elapsed().as_secs_f64()
    );

    pty.pump(Duration::from_millis(300));
    pty.type_text("/quit");
    pty.enter();
    assert!(pty.child.wait().unwrap().success());
    drop(pty);

    let mut resumed = open_pty_cleared(
        &binary,
        &["--cwd", cwd, "--fullscreen", "--resume", session_id],
        &env,
        &workspace,
    );
    resumed.wait_for_frame(Duration::from_secs(45));
    resumed.type_text("/goal resume");
    resumed.enter();
    let accepted = wait_goal_fact(&mut resumed, &workspace, "aster.goal.plan.accepted");
    assert_eq!(accepted["payload"]["session_id"], session_id);
    let bodies = &state.lock().unwrap().bodies;
    assert_eq!(
        bodies
            .iter()
            .filter(|body| body.contains("You plan a durable Goal."))
            .count(),
        2
    );
    assert!(!bodies
        .iter()
        .any(|body| body.contains("context-compaction engine")));
}
