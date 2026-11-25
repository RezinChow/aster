use super::*;

#[derive(Default)]
pub(super) struct FreshReviewScript {
    pub(super) held: Option<std::sync::mpsc::Sender<TcpStream>>,
    calls: u64,
}

pub(super) fn reply(
    body: &serde_json::Value,
    script: &mut FreshReviewScript,
    streaming: bool,
) -> Option<String> {
    script.held.as_ref()?;
    if !body["tools"]
        .as_array()
        .is_some_and(|tools| tools.iter().any(|tool| tool["function"]["name"] == "write"))
    {
        return None;
    }
    if body["messages"]
        .as_array()
        .and_then(|messages| messages.last())
        .is_none_or(|message| message["role"] != "user")
    {
        return Some(reply_text("Local fixture response.", streaming));
    }
    script.calls += 1;
    let (tool, args) = if script.calls == 1 {
        (
            "write",
            serde_json::json!({"file_path":"answer.txt", "content":"42\n"}),
        )
    } else {
        (
            "read",
            serde_json::json!({"file_path":format!("source-{}.txt", script.calls)}),
        )
    };
    Some(reply_tool(tool, args, script.calls, streaming))
}

#[tokio::test(flavor = "current_thread")]
async fn review_compaction_cannot_hold_the_unattended_result_past_the_deadline() {
    tokio::task::LocalSet::new()
        .run_until(async {
            let root = tempfile::tempdir().unwrap();
            let workspace = root.path().join("workspace");
            let home = root.path().join("home");
            let tmp = root.path().join("private");
            for path in [&workspace, &home, &tmp] {
                std::fs::create_dir(path).unwrap();
            }
            for index in 2..15 {
                std::fs::write(
                    workspace.join(format!("source-{index}.txt")),
                    format!("Synthetic source {index}\n"),
                )
                .unwrap();
            }
            let (addr, script) = spawn_mock();
            let (held, provider) = std::sync::mpsc::channel();
            script.lock().unwrap().fresh_review.held = Some(held);
            let config = write_acl(root.path(), &format!("http://{addr}/v1"));
            let mut source = std::fs::read_to_string(&config).unwrap();
            source.push_str("\nmemory { llm_extraction = false }\n");
            std::fs::write(&config, source).unwrap();
            let result_file = root.path().join("result.json");
            let agent = spawn_agent(
                &workspace,
                &config,
                &home,
                &tmp,
                &[
                    "--unattended",
                    "--no-goal-continuation",
                    "--max-execution-ms",
                    "5000",
                    "--result-file",
                    result_file.to_str().unwrap(),
                ],
            )
            .await;
            let session = open(&agent, &workspace).await;
            let started = std::time::Instant::now();
            let turn = say(
                &agent,
                &session,
                "UNATTENDED-TASK Write answer.txt and read the fixture sources.",
            );
            let pending = tokio::task::spawn_blocking(move || {
                provider.recv_timeout(Duration::from_secs(6)).unwrap()
            });
            let (response, provider_socket) = tokio::time::timeout(Duration::from_secs(6), async {
                tokio::join!(turn, pending)
            })
            .await
            .expect("the host returned while the fresh review provider was still held");
            assert_eq!(response.unwrap().stop_reason, acp::StopReason::EndTurn);
            let report: serde_json::Value =
                serde_json::from_slice(&std::fs::read(result_file).unwrap()).unwrap();
            assert_eq!(report["outcome"], "timed_out");
            assert_eq!(report["reason"], "deadline_exceeded");
            assert_eq!(
                std::fs::read(workspace.join("answer.txt")).unwrap(),
                b"42\n"
            );
            assert!(started.elapsed() < Duration::from_secs(6));
            drop(provider_socket.unwrap());
            assert!(!private_fixture_facts(&tmp)
                .iter()
                .any(|fact| fact["type"] == "compaction.done"));
        })
        .await;
}
