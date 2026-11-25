use super::*;

fn fixture() -> (
    tempfile::TempDir,
    PathBuf,
    PathBuf,
    PathBuf,
    Arc<Mutex<MockState>>,
) {
    let root = tempfile::tempdir().unwrap();
    let workspace = root.path().join("workspace");
    let home = root.path().join("home");
    std::fs::create_dir(&workspace).unwrap();
    std::fs::create_dir(&home).unwrap();
    let workspace = workspace.canonicalize().unwrap();
    let (address, state) = spawn_mock(&workspace.join("unused"), &workspace.join("unused"));
    let config = root.path().join("config.acl");
    std::fs::write(
        &config,
        format!(
            r#"
providers "mock" {{
  base_url = "http://{address}/v1"
  api_key = "fixture"
  models "gpt" {{ limit = {{ context = 65536, output = 1024 }} }}
  models "alt" {{ limit = {{ context = 12288, output = 1024 }} }}
}}
default_model = "{MODEL_ID}"
memory {{ llm_extraction = false }}
"#
        ),
    )
    .unwrap();
    (root, workspace, home, config, state)
}

async fn open(agent: &AgentProc, workspace: &Path) -> acp::SessionId {
    acp::Agent::new_session(
        agent.conn.as_ref(),
        acp::NewSessionRequest::new(workspace.to_path_buf()),
    )
    .await
    .unwrap()
    .session_id
}

async fn compact(agent: &AgentProc, session: &acp::SessionId) -> acp::Result<acp::ExtResponse> {
    let params =
        serde_json::value::to_raw_value(&serde_json::json!({"sessionId": session})).unwrap();
    acp::Agent::ext_method(
        agent.conn.as_ref(),
        acp::ExtRequest::new("aster/compact_conversation", Arc::from(params)),
    )
    .await
}

async fn goal_refusal(agent: &AgentProc, session: &acp::SessionId, prompt: &str) -> String {
    let error = acp::Agent::prompt(agent.conn.as_ref(), user_prompt(session, prompt))
        .await
        .expect_err("oversized scope should refuse planning");
    error.data.unwrap().as_str().unwrap().to_owned()
}

#[tokio::test(flavor = "current_thread")]
async fn cancelling_manual_compaction_keeps_the_original_log_and_releases_the_session() {
    tokio::task::LocalSet::new()
        .run_until(async {
            let (_root, workspace, home, config, state) = fixture();
            let agent = connect_agent(&workspace, &config, &home).await;
            let id = open(&agent, &workspace).await;
            slash(&agent, &id, "Seed a conversation.").await;
            let (started, pending) = std::sync::mpsc::channel();
            state.lock().unwrap().held_compaction = Some(started);
            let mut operation = Box::pin(compact(&agent, &id));
            let mut socket = tokio::select! {
                result = &mut operation => panic!("compaction returned early: {result:?}"),
                pending = tokio::task::spawn_blocking(move || {
                    pending.recv_timeout(Duration::from_secs(6)).unwrap()
                }) => pending.unwrap(),
            };
            acp::Agent::cancel(
                agent.conn.as_ref(),
                acp::CancelNotification::new(id.clone()),
            )
            .await
            .unwrap();
            let error = tokio::time::timeout(Duration::from_secs(4), &mut operation)
                .await
                .expect("cancel releases a held provider request")
                .unwrap_err();
            assert_eq!(error.data.unwrap()["kind"], "compact_cancelled");
            let _ = write_http(&mut socket, &reply_text("LATE-COMPACTION", false));
            let reply = slash(&agent, &id, "Continue after cancellation.").await;
            assert!(!reply.is_empty());
            assert!(!log_text(&workspace).contains("compaction.done"));
            drop(operation);
            stop_agent(agent).await;
        })
        .await;
}

#[tokio::test(flavor = "current_thread")]
async fn goal_capacity_is_checked_before_bind_and_legacy_goal_recovers_its_exact_scope() {
    tokio::task::LocalSet::new()
        .run_until(async {
            let (_root, workspace, home, config, state) = fixture();
            let agent = connect_agent(&workspace, &config, &home).await;
            let id = open(&agent, &workspace).await;
            let requirement = "Keep the test marker violet-593.";
            slash(
                &agent,
                &id,
                &format!("LARGE-ASSISTANT-FIXTURE. {requirement}"),
            )
            .await;
            acp::Agent::set_session_model(
                agent.conn.as_ref(),
                acp::SetSessionModelRequest::new(id.clone(), acp::ModelId::new("mock/alt")),
            )
            .await
            .unwrap();

            let objective = "Prioritize the original test requirement.";
            let refusal = goal_refusal(&agent, &id, &format!("/goal {objective}")).await;
            assert!(
                refusal.contains("exceed the model context window"),
                "{refusal}"
            );
            let unbound = goal_state(&agent, &id).await;
            assert!(unbound["definition"].is_null());
            assert!(!state
                .lock()
                .unwrap()
                .bodies
                .iter()
                .any(|body| body.contains("You plan a durable Goal.")));

            let thread = aster_core::fact_control::thread_for_session(id.0.as_ref());
            let scope =
                aster_core::fact_control::goal_scope_sequences(&workspace, &thread).unwrap();
            let mut create =
                create_goal_command(&id, &workspace, "legacy-capacity", objective, requirement);
            create["scope_fact_sequences"] = serde_json::json!(scope);
            create["work_policy_digest"] = unbound["work_policy_digest"].clone();
            let original = goal_ext(&agent, "aster/goal/definition", create).await;
            let plan_refusal = goal_refusal(&agent, &id, "/goal resume").await;
            assert!(plan_refusal.contains("Run /compact"), "{plan_refusal}");
            compact(&agent, &id).await.unwrap();
            slash(&agent, &id, "/goal resume").await;
            let recovered = goal_state(&agent, &id).await;
            assert_eq!(recovered["definition"]["binding"], original["binding"]);
            assert_eq!(recovered["definition"]["goal"]["description"], objective);
            assert_eq!(
                recovered["definition"]["plan_accepted"], true,
                "{recovered}"
            );
            {
                let bodies = &state.lock().unwrap().bodies;
                let planning: Vec<_> = bodies
                    .iter()
                    .filter(|body| body.contains("You plan a durable Goal."))
                    .collect();
                assert_eq!(planning.len(), 1);
                assert!(planning[0].contains(requirement));
                assert!(planning[0].contains(COMPACT_SUMMARY));
                assert!(planning[0].contains("goalScopeSource"));
                assert!(!planning[0].contains("verbose prior work"));
            }
            let protected = open(&agent, &workspace).await;
            let exact_requirement = "Preserve every byte of this user scope. ".repeat(1800);
            slash(&agent, &protected, &exact_requirement).await;
            acp::Agent::set_session_model(
                agent.conn.as_ref(),
                acp::SetSessionModelRequest::new(protected.clone(), acp::ModelId::new("mock/alt")),
            )
            .await
            .unwrap();
            let refusal =
                goal_refusal(&agent, &protected, "/goal preserve the exact requirement").await;
            assert!(
                refusal.contains("Select a model with a larger context window"),
                "{refusal}"
            );
            assert!(goal_state(&agent, &protected).await["definition"].is_null());

            let reserved = open(&agent, &workspace).await;
            let near_limit = "ordinary material ".repeat(2350);
            slash(&agent, &reserved, &near_limit).await;
            acp::Agent::set_session_model(
                agent.conn.as_ref(),
                acp::SetSessionModelRequest::new(reserved.clone(), acp::ModelId::new("mock/alt")),
            )
            .await
            .unwrap();
            let refusal =
                goal_refusal(&agent, &reserved, "/goal Check the synthetic requirements.").await;
            assert!(
                refusal.contains("exceed the model context window"),
                "{refusal}"
            );
            assert!(goal_state(&agent, &reserved).await["definition"].is_null());
            assert_eq!(
                state
                    .lock()
                    .unwrap()
                    .bodies
                    .iter()
                    .filter(|body| body.contains("You plan a durable Goal."))
                    .count(),
                1
            );
            stop_agent(agent).await;
        })
        .await;
}

pub(super) fn serve_stream(body: &str, stream: &TcpStream) -> bool {
    let productive = body.contains("PRODUCTIVE-SSE-FIXTURE");
    let headless_pipe = body.contains("HEADLESS-PIPE-FIXTURE");
    if headless_pipe
        && serde_json::from_str::<serde_json::Value>(body).is_ok_and(|body| body["stream"] == true)
    {
        let mut stream = stream.try_clone().unwrap();
        std::thread::spawn(move || {
            let _ = (|| -> std::io::Result<()> {
                stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n")?;
                for text in [
                    "PIPE-FIXTURE-READY\n".into(),
                    "fixture output ".repeat(20_000),
                ] {
                    let value = format!(
                        "data: {}\n\n",
                        serde_json::json!({"choices":[{"delta":{"content":text}}]})
                    );
                    write!(stream, "{:x}\r\n{value}\r\n", value.len())?;
                    stream.flush()?;
                    std::thread::sleep(Duration::from_millis(100));
                }
                // Withhold the terminal marker beyond the child exit deadline.
                std::thread::sleep(Duration::from_secs(8));
                Ok(())
            })();
        });
        return true;
    }
    if !productive && !body.contains("HEARTBEAT-SSE-FIXTURE") {
        return false;
    }
    if !serde_json::from_str::<serde_json::Value>(body).is_ok_and(|body| body["stream"] == true) {
        return false;
    }
    let mut stream = stream.try_clone().unwrap();
    std::thread::spawn(move || {
        fn chunk(stream: &mut TcpStream, value: &str) -> std::io::Result<()> {
            write!(stream, "{:x}\r\n{value}\r\n", value.len())?;
            stream.flush()
        }
        let _ = (|| -> std::io::Result<()> {
            stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n")?;
            for _ in 0..24 {
                let value = if productive {
                    "data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"r\"}}]}\n\n"
                } else {
                    ": ping\n\n"
                };
                chunk(&mut stream, value)?;
                std::thread::sleep(Duration::from_millis(50));
            }
            if productive {
                chunk(&mut stream, &reply_text("PRODUCTIVE-SSE-COMPLETE", true))?;
            } else {
                chunk(&mut stream, &reply_text("LATE-SSE-CONTENT", true))?;
            }
            stream.write_all(b"0\r\n\r\n")
        })();
    });
    true
}

#[tokio::test(flavor = "current_thread")]
async fn headless_stdout_backpressure_preserves_interrupt_and_broken_pipe_exit() {
    use tokio::io::{AsyncReadExt as _, BufReader};
    let binary = tui_binary();
    assert!(
        binary.is_file(),
        "build the paired aster binary before running this test"
    );
    for interrupt in [false, true] {
        let (_root, workspace, home, config, _state) = fixture();
        let mut child = tokio::process::Command::new(&binary)
            .args(["--trust", "--no-auto-update", "-p", "HEADLESS-PIPE-FIXTURE"])
            .current_dir(&workspace)
            .envs(child_env(&binaries::acp_binary(), &config, &home))
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true)
            .spawn()
            .unwrap();
        let mut stdout = BufReader::new(child.stdout.take().unwrap());
        let mut ready = [0; b"PIPE-FIXTURE-READY".len()];
        tokio::time::timeout(Duration::from_secs(10), stdout.read_exact(&mut ready))
            .await
            .expect("model delta reaches stdout")
            .unwrap();
        assert_eq!(&ready, b"PIPE-FIXTURE-READY");
        if interrupt {
            tokio::time::sleep(Duration::from_millis(350)).await;
            let pid = child.id().unwrap().to_string();
            assert!(tokio::process::Command::new("kill")
                .args(["-INT", &pid])
                .status()
                .await
                .unwrap()
                .success());
            let status = tokio::time::timeout(Duration::from_secs(4), child.wait())
                .await
                .expect("one SIGINT exits with an open, full stdout pipe")
                .unwrap();
            assert_eq!(status.code(), Some(130));
        } else {
            drop(stdout);
            let status = tokio::time::timeout(Duration::from_secs(4), child.wait())
                .await
                .expect("reader closure stops the turn while the provider is held")
                .unwrap();
            assert!(status.success(), "{status}");
        }
    }
}

#[tokio::test(flavor = "current_thread")]
async fn sse_transport_heartbeats_do_not_extend_idle_but_reasoning_deltas_do() {
    tokio::task::LocalSet::new()
        .run_until(async {
            let (_root, workspace, home, config, state) = fixture();
            let agent = spawn_agent_with_env(
                &workspace, &config, &home, &[("ASTER_LLM_STREAM_IDLE_TIMEOUT_MS", Path::new("250"))],
            ).await;
            acp::Agent::initialize(
                agent.conn.as_ref(), acp::InitializeRequest::new(acp::ProtocolVersion::V1),
            ).await.unwrap();
            let productive = open(&agent, &workspace).await;
            assert!(slash(&agent, &productive, "PRODUCTIVE-SSE-FIXTURE").await
                .contains("PRODUCTIVE-SSE-COMPLETE"));
            let idle = open(&agent, &workspace).await;
            let mut prompt = Box::pin(acp::Agent::prompt(
                agent.conn.as_ref(), user_prompt(&idle, "HEARTBEAT-SSE-FIXTURE"),
            ));
            tokio::select! {
                result = &mut prompt => panic!("heartbeat request completed before retry: {result:?}"),
                () = async {
                    loop {
                        let count = state.lock().unwrap().bodies.iter()
                            .filter(|body| body.contains("HEARTBEAT-SSE-FIXTURE"))
                            .count();
                        if count >= 2 {
                            break;
                        }
                        tokio::time::sleep(Duration::from_millis(20)).await;
                    }
                } => {}
                () = tokio::time::sleep(Duration::from_secs(5)) => panic!("heartbeat stream never retried"),
            }
            acp::Agent::cancel(agent.conn.as_ref(), acp::CancelNotification::new(idle.clone()))
                .await.unwrap();
            let result = tokio::time::timeout(Duration::from_secs(4), &mut prompt).await.unwrap().unwrap();
            assert_eq!(result.stop_reason, acp::StopReason::Cancelled);
            assert!(!log_text(&workspace).contains("LATE-SSE-CONTENT"));
            drop(prompt);
            stop_agent(agent).await;
        })
        .await;
}

#[tokio::test(flavor = "current_thread")]
async fn provider_sse_error_cannot_commit_partial_assistant_text() {
    tokio::task::LocalSet::new()
        .run_until(async {
            let (_root, workspace, home, config, state) = fixture();
            let agent = connect_agent(&workspace, &config, &home).await;
            let id = open(&agent, &workspace).await;
            slash(&agent, &id, "SSE-FAULT-FIXTURE").await;
            assert_eq!(
                state
                    .lock()
                    .unwrap()
                    .bodies
                    .iter()
                    .filter(|body| body.contains("SSE-FAULT-FIXTURE"))
                    .count(),
                2
            );
            let log = log_text(&workspace);
            assert!(log.contains("turn.complete"));
            assert!(!log.contains("UNCOMMITTED-SSE-PARTIAL"));
            stop_agent(agent).await;
        })
        .await;
}

#[tokio::test(flavor = "current_thread")]
async fn refused_live_session_load_leaves_original_usable() {
    tokio::task::LocalSet::new()
        .run_until(async {
            let (_root, workspace, home, config, _state) = fixture();
            let agent = connect_agent(&workspace, &config, &home).await;
            let id = open(&agent, &workspace).await;
            slash(&agent, &id, "Original session marker.").await;
            let goal = aster_core::session_folder::find_session_dir(&workspace, id.0.as_ref())
                .unwrap()
                .unwrap()
                .join("durable-goal.json");
            std::fs::write(&goal, "{").unwrap();
            let rejected = acp::Agent::load_session(
                agent.conn.as_ref(),
                acp::LoadSessionRequest::new(id.clone(), workspace.clone()),
            )
            .await
            .unwrap_err();
            assert!(rejected
                .data
                .unwrap()
                .to_string()
                .contains("invalid session goal"));
            std::fs::remove_file(goal).unwrap();
            slash(&agent, &id, "Continue after refused restore.").await;
            let log = log_text(&workspace);
            assert!(log.contains("Original session marker."));
            assert!(log.contains("Continue after refused restore."));
            stop_agent(agent).await;
        })
        .await;
}

#[tokio::test(flavor = "current_thread")]
async fn connector_handshakes_are_independent_and_first_turn_has_healthy_tools() {
    tokio::task::LocalSet::new()
        .run_until(async {
            let (_root, workspace, home, config, state) = fixture();
            let agent = connect_agent(&workspace, &config, &home).await;
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let address = listener.local_addr().unwrap();
            let (arrived, pending) = std::sync::mpsc::channel();
            std::thread::spawn(move || {
                for mut stream in listener.incoming().flatten() {
                    let arrived = arrived.clone();
                    std::thread::spawn(move || {
                        stream.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
                        let Some(body) = read_http_body(&mut stream) else {
                            return;
                        };
                        let Ok(request) = serde_json::from_str::<serde_json::Value>(&body) else {
                            return;
                        };
                        match request["method"].as_str() {
                            Some("initialize") if arrived.send(stream.try_clone().unwrap()).is_ok() => {}
                            _ => {}
                        }
                    });
                }
            });
            let healthy = TcpListener::bind("127.0.0.1:0").unwrap();
            let healthy_address = healthy.local_addr().unwrap();
            std::thread::spawn(move || {
                for mut stream in healthy.incoming().flatten() {
                    stream.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
                    let Some(body) = read_http_body(&mut stream) else {
                        continue;
                    };
                    let Ok(request) = serde_json::from_str::<serde_json::Value>(&body) else {
                        continue;
                    };
                    let payload = match request["method"].as_str() {
                        Some("initialize") => serde_json::json!({
                            "protocolVersion": request["params"]["protocolVersion"],
                            "capabilities": {"tools": {}},
                            "serverInfo": {"name":"healthy", "version":"1"}
                        }),
                        Some("tools/list") => serde_json::json!({
                            "tools": [{"name":"probe", "description":"Test connection", "inputSchema":{"type":"object"}}]
                        }),
                        _ => {
                            let _ = stream.write_all(b"HTTP/1.1 202 Accepted\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
                            continue;
                        }
                    };
                    let reply = serde_json::json!({"jsonrpc":"2.0","id":request["id"],"result":payload});
                    let _ = write_http(&mut stream, &reply.to_string());
                }
            });
            let connector = |name: &str, address: SocketAddr| {
                acp::McpServer::Http(acp::McpServerHttp::new(name, format!("http://{address}/mcp")))
            };
            let unused = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let rejected = acp::NewSessionRequest::new(workspace.clone())
                .mcp_servers(vec![connector("rejected", unused.local_addr().unwrap())])
                .meta(Some([("asterHarness".into(), serde_json::json!({"components":["INVALID-FIXTURE"]}))].into_iter().collect()));
            tokio::time::timeout(Duration::from_secs(3), acp::Agent::new_session(agent.conn.as_ref(), rejected))
                .await.unwrap().expect_err("invalid harness must be rejected before connecting");
            assert!(tokio::time::timeout(Duration::from_millis(100), unused.accept()).await.is_err());
            let request = acp::NewSessionRequest::new(workspace.clone()).mcp_servers(vec![
                connector("slow-a", address),
                connector("slow-b", address),
                connector("healthy", healthy_address),
            ]);
            let mut opening = Box::pin(acp::Agent::new_session(agent.conn.as_ref(), request));
            let both = tokio::task::spawn_blocking(move || {
                (0..2)
                    .map(|_| pending.recv_timeout(Duration::from_secs(3)).unwrap())
                    .collect::<Vec<_>>()
            });
            let stalled = tokio::select! {
                result = &mut opening => panic!("session finished without handshakes: {result:?}"),
                both = both => both.unwrap(),
            };
            let independent = tokio::time::timeout(Duration::from_secs(3), open(&agent, &workspace))
                .await
                .expect("unrelated session starts with both connectors held");
            let conflict = acp::NewSessionRequest::new(workspace.clone())
                .mcp_servers(vec![connector("slow-a", healthy_address)]);
            let collision = tokio::time::timeout(Duration::from_secs(3), acp::Agent::new_session(agent.conn.as_ref(), conflict))
                .await.unwrap().expect_err("opening sessions reserve connector definitions");
            assert!(collision.data.unwrap().to_string().contains("slow-a"));
            for mut stream in stalled {
                let _ = stream.write_all(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
            }
            let opened = tokio::time::timeout(Duration::from_secs(5), &mut opening)
                .await.unwrap().unwrap().session_id;
            assert_ne!(opened, independent);
            slash(&agent, &opened, "FIRST-CONNECTOR-TURN").await;
            slash(&agent, &independent, "INDEPENDENT-CONNECTOR-TURN").await;
            assert!(state.lock().unwrap().bodies.iter().any(|body|
                body.contains("FIRST-CONNECTOR-TURN") && body.contains("mcp__healthy__probe")
            ), "healthy MCP tool was missing from the first model request");
            assert!(state.lock().unwrap().bodies.iter().any(|body|
                body.contains("INDEPENDENT-CONNECTOR-TURN") && !body.contains("mcp__healthy__probe")
            ), "independent session must never see another session's MCP tool");
            drop(opening);
            stop_agent(agent).await;
        })
        .await;
}
