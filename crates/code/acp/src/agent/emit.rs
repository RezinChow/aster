//! `session/update` notifications for one ACP session.

use super::*;

impl AsterCodeAgent {
    pub(super) fn announce_session_usage(&self, session_id: &str, session: &AgentSession) {
        let Some(client) = self.client.borrow().as_ref().map(Rc::downgrade) else {
            return;
        };
        // &str → Arc<str> without an intermediate String.
        let session_id = acp::SessionId::new(session_id);
        let mut usage = session.subscribe_usage();
        let cancellation = session.session_cancel_token();
        tokio::task::spawn_local(async move {
            tokio::task::yield_now().await;
            loop {
                let tokens = usage.borrow_and_update().total_tokens as u64;
                let Some(connection) = client.upgrade() else {
                    return;
                };
                let update =
                    serde_json::json!({"sessionUpdate":"model_info","sessionTotalTokens":tokens});
                send_session_update(&connection, &session_id, acp::Meta::new(), update).await;
                drop(connection);
                tokio::select! {
                    biased;
                    _ = cancellation.cancelled() => return,
                    changed = usage.changed() => if changed.is_err() { return },
                }
            }
        });
    }

    pub(super) async fn emit_permission_mode(
        &self,
        id: acp::SessionId,
        posture: PermissionPosture,
    ) {
        self.emit(acp::SessionNotification::new(
            id,
            acp::SessionUpdate::CurrentModeUpdate(acp::CurrentModeUpdate::new(posture.as_str())),
        ))
        .await;
    }

    /// Emit a meta-only thought chunk so hosts stamp `streamStartMs` / Thinking chrome
    /// before the LLM returns headers (which can take up to ~120s by default).
    pub(super) async fn emit_turn_started_chrome(&self, session_id: &acp::SessionId) {
        self.emit(acp::SessionNotification::new(
            session_id.clone(),
            acp::SessionUpdate::AgentThoughtChunk(acp::ContentChunk::new(acp::ContentBlock::Text(
                acp::TextContent::new(String::new()),
            ))),
        ))
        .await;
    }

    pub(super) async fn emit(&self, notification: acp::SessionNotification) {
        let client = self.client.borrow().clone();
        if let Some(client) = client {
            let mut notification = notification;
            // Echo the in-flight turn's client prompt id on every
            // notification (the ACP prompt-ack contract: the pager disarms
            // its ack watch on the first update naming the prompt).
            if notification.meta.is_none() {
                let meta = self.notification_meta(&notification.session_id);
                if !meta.is_empty() {
                    notification.meta = Some(meta);
                }
            }
            let _ = client.session_notification(notification).await;
        }
    }

    fn notification_meta(&self, session_id: &acp::SessionId) -> acp::Meta {
        let mut meta = acp::Meta::new();
        // Pager uses these for Thinking pre-create and turn-duration chrome.
        // Without them the Code path stays blank until the first model chunk.
        let now_ms = unix_now_ms() as i64;
        meta.insert("agentTimestampMs".into(), now_ms.into());
        if let Some(prompt_id) = self.prompt_id_for_session(session_id) {
            meta.insert("promptId".into(), prompt_id.into());
        }
        let (language, turn_started_ms) = self
            .sessions
            .try_lock()
            .ok()
            .and_then(|sessions| {
                let live = sessions.get(session_id.0.as_ref())?;
                let language = live.session.reply_language();
                let turn_started_ms = *live
                    .turn_started_ms
                    .lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner);
                Some((language, turn_started_ms))
            })
            .unwrap_or((None, None));
        if let Some(language) = language {
            meta.insert("outputLanguage".into(), language.into());
        }
        if let Some(turn_ms) = turn_started_ms {
            meta.insert("turnStartMs".into(), turn_ms.into());
            // Turn-level stream anchor: Code does not yet mint a fresh stream id
            // per tool→model hop; a stable stamp still unlocks first-token chrome.
            meta.insert("streamStartMs".into(), turn_ms.into());
        }
        // Surface the stream-headers bound so hosts can show a real deadline
        // during Thinking instead of an unexplained multi-minute blank wait.
        // `0` means the env override disabled the bound (same as Core).
        let headers_ms = aster_core::llm::http::stream_headers_timeout_ms();
        meta.insert("streamHeadersTimeoutMs".into(), headers_ms.into());
        meta
    }

    pub(super) async fn emit_run_observation(
        &self,
        observation: Option<crate::run_observation::Observation>,
    ) {
        let Some(observation) = observation else {
            return;
        };
        let Some(client) = self.client.borrow().clone() else {
            return;
        };
        let params = match serde_json::value::to_raw_value(&observation) {
            Ok(params) => params,
            Err(error) => {
                tracing::warn!(%error, "Run observation serialization refused");
                return;
            }
        };
        if let Err(error) = client
            .ext_notification(acp::ExtNotification::new(
                crate::run_observation::METHOD,
                params.into(),
            ))
            .await
        {
            tracing::warn!(%error, "Run observation transport unavailable");
        }
    }

    pub(super) async fn close_run_observation(&self, state: &mut TurnState) {
        let observation = match state.observer.as_mut() {
            Some(observer) => observer.closed().await,
            None => None,
        };
        self.emit_run_observation(observation).await;
    }

    pub(super) async fn emit_text(
        &self,
        session_id: &acp::SessionId,
        text: impl Into<String>,
        generation_delta: bool,
    ) {
        let text = text.into();
        if text.is_empty() {
            return;
        }
        // Eager preview allocs on every chunk even when the target is off —
        // gate the field build (高效 / ACP streaming).
        if tracing::enabled!(target: "perf_probe", tracing::Level::INFO) {
            tracing::info!(
                target: "perf_probe",
                len = text.len(),
                preview = %text.chars().take(60).collect::<String>(),
                "chunk_emit"
            );
        }
        // Move owned Core delta bytes onto the wire (no second heap copy).
        self.emit(acp::SessionNotification::new(
            session_id.clone(),
            acp::SessionUpdate::AgentMessageChunk(
                acp::ContentChunk::new(acp::ContentBlock::Text(acp::TextContent::new(text))).meta(
                    Some(
                        [("asterGenerationDelta".into(), generation_delta.into())]
                            .into_iter()
                            .collect(),
                    ),
                ),
            ),
        ))
        .await;
    }

    pub(super) async fn emit_tool_call(
        &self,
        session_id: &acp::SessionId,
        id: &str,
        name: &str,
        args: Option<&serde_json::Value>,
    ) {
        let mut call = acp::ToolCall::new(acp::ToolCallId::new(id), tool_title(name))
            .kind(tool_kind_for(name))
            .status(acp::ToolCallStatus::InProgress);
        if let Some(raw_input) = args.and_then(|args| prepared_raw_input(name, args)) {
            call = call.raw_input(raw_input);
        }
        self.emit(acp::SessionNotification::new(
            session_id.clone(),
            acp::SessionUpdate::ToolCall(call),
        ))
        .await;
    }

    /// Attach aster tool arguments once execution starts so the pager can render
    /// the Execute / Read / Edit / Search / Fetch card instead of a generic row.
    pub(super) async fn emit_tool_call_started(
        &self,
        session_id: &acp::SessionId,
        id: &str,
        name: &str,
        args: &serde_json::Value,
    ) {
        let mut fields = acp::ToolCallUpdateFields::new()
            .title(tool_title(name))
            .kind(tool_kind_for(name))
            .status(acp::ToolCallStatus::InProgress);
        if let Some(raw_input) = prepared_raw_input(name, args) {
            fields = fields.raw_input(raw_input);
        }
        self.emit(acp::SessionNotification::new(
            session_id.clone(),
            acp::SessionUpdate::ToolCallUpdate(acp::ToolCallUpdate::new(
                acp::ToolCallId::new(id),
                fields,
            )),
        ))
        .await;
    }

    pub(super) async fn emit_tool_call_completed(
        &self,
        session_id: &acp::SessionId,
        id: &str,
        name: &str,
        args: Option<&serde_json::Value>,
        output: &str,
        exit_code: i32,
        metadata: Option<&serde_json::Value>,
    ) {
        let status = if exit_code == 0 {
            acp::ToolCallStatus::Completed
        } else {
            acp::ToolCallStatus::Failed
        };
        // Start/started already published title/kind/rawInput — omit them on
        // completion to avoid another prepared_raw_input args.clone() + JSON.
        let mut fields = acp::ToolCallUpdateFields::new()
            .status(status)
            .content(tool_call_content(name, args, output));
        if let Some(raw_output) = tool_publication_output(name, metadata, exit_code)
            .or_else(|| tool_raw_output(name, args, output, exit_code, metadata))
        {
            fields = fields.raw_output(raw_output);
        }
        self.emit(acp::SessionNotification::new(
            session_id.clone(),
            acp::SessionUpdate::ToolCallUpdate(acp::ToolCallUpdate::new(
                acp::ToolCallId::new(id),
                fields,
            )),
        ))
        .await;
    }

    pub(super) async fn emit_tool_call_output_delta(
        &self,
        session_id: &acp::SessionId,
        id: &str,
        name: &str,
        delta: impl Into<String>,
    ) {
        let delta = delta.into();
        if delta.is_empty() {
            return;
        }
        // Coalesce already owns the flush; move short payloads into the preview.
        let preview = preview_text_owned(delta, 4_000);
        // Incremental deltas already have title/kind from the start/started
        // notifications — omit them to cut per-chunk String + JSON work.
        let mut fields = acp::ToolCallUpdateFields::new().status(acp::ToolCallStatus::InProgress);
        if matches!(name, "bash" | "shell" | "execute") {
            // Build raw_output from the same owned preview, then move it into
            // content — avoids a second 4k String clone on every delta.
            fields = fields.raw_output(streaming_bash_delta(&preview));
        }
        fields = fields.content(vec![acp::ToolCallContent::from(acp::ContentBlock::Text(
            acp::TextContent::new(preview),
        ))]);
        self.emit(acp::SessionNotification::new(
            session_id.clone(),
            acp::SessionUpdate::ToolCallUpdate(acp::ToolCallUpdate::new(
                acp::ToolCallId::new(id),
                fields,
            )),
        ))
        .await;
    }

    pub(super) async fn emit_thought(&self, session_id: &acp::SessionId, text: impl Into<String>) {
        let text = text.into();
        if text.is_empty() {
            return;
        }
        self.emit(acp::SessionNotification::new(
            session_id.clone(),
            acp::SessionUpdate::AgentThoughtChunk(acp::ContentChunk::new(acp::ContentBlock::Text(
                acp::TextContent::new(text),
            ))),
        ))
        .await;
    }

    pub(super) async fn emit_plan(
        &self,
        session_id: &acp::SessionId,
        tasks: &[aster_core::planning::Task],
    ) {
        if tasks.is_empty() {
            return;
        }
        let entries = tasks.iter().map(task_to_plan_entry).collect::<Vec<_>>();
        self.emit(acp::SessionNotification::new(
            session_id.clone(),
            acp::SessionUpdate::Plan(acp::Plan::new(entries)),
        ))
        .await;
    }

    /// Forward xAI-shaped session updates the pager already understands
    /// (`SubagentSpawned` / `SubagentProgress` / `SubagentFinished`).
    pub(super) async fn emit_xai_session_update(
        &self,
        session_id: &acp::SessionId,
        update: serde_json::Value,
    ) {
        let client = self.client.borrow().clone();
        let Some(client) = client else {
            return;
        };
        send_session_update(
            &client,
            session_id,
            self.notification_meta(session_id),
            update,
        )
        .await;
    }

    pub(super) async fn replay_terminal_subagents(
        &self,
        session_id: &acp::SessionId,
        session: &AgentSession,
    ) {
        use aster_core::subagent_task_tracker::SubagentStatus;
        let Some(client) = self.client.borrow().clone() else {
            return;
        };
        for task in session.subagent_tasks().await {
            // Running snapshots have no restored worker; replay only observed terminal lifecycles.
            if !matches!(
                task.status,
                SubagentStatus::Completed | SubagentStatus::Failed | SubagentStatus::Cancelled
            ) {
                continue;
            }
            let Some(finished) = task.finished_ms else {
                continue;
            };
            let mut state = TurnState::default();
            state
                .subagent_started_ms
                .insert(task.task_id.clone(), task.started_ms);
            let mut progress = ChildProgress::default();
            for entry in &task.progress {
                note_child_progress(&mut progress, &entry.status, &entry.metadata);
            }
            let background = task.progress.iter().rev().find_map(|entry| {
                entry
                    .metadata
                    .get("background")
                    .and_then(serde_json::Value::as_bool)
            });
            let (window, percentage) =
                context_usage(session.context_window_tokens() as u64, progress.tokens_used);
            let updates = [
                serde_json::json!({
                    "sessionUpdate":"subagent_spawned", "subagent_id":task.task_id,
                    "parent_session_id":session_id.0.as_ref(), "child_session_id":task.child_session_id,
                    "subagent_type":task.agent, "description":task.description, "startedAt":task.started_ms,
                }),
                serde_json::json!({
                    "sessionUpdate":"subagent_progress", "subagent_id":task.task_id,
                    "parent_session_id":session_id.0.as_ref(), "child_session_id":task.child_session_id,
                    "duration_ms":finished.saturating_sub(task.started_ms), "turn_count":progress.turn_count,
                    "tool_call_count":progress.tool_call_count, "tokens_used":progress.tokens_used,
                    "context_window_tokens":window,"context_usage_pct":percentage,
                    "tools_used":progress.tools_used,"error_count":progress.error_count,
                }),
                project_subagent_end(
                    &state,
                    Some(&task),
                    &task.task_id,
                    &task.child_session_id,
                    task.status == SubagentStatus::Completed,
                    task.output.as_deref().unwrap_or_default(),
                    finished,
                ),
            ];
            for update in updates {
                let mut meta = acp::Meta::new();
                meta.insert("isReplay".into(), serde_json::json!(true));
                meta.insert("origin".into(), serde_json::json!("core.subagent_tasks"));
                meta.insert(
                    "entryId".into(),
                    serde_json::json!(format!(
                        "subagent:{}:{}:{}:{}",
                        task.task_id,
                        task.started_ms,
                        finished,
                        update["sessionUpdate"].as_str().unwrap_or_default()
                    )),
                );
                if let Some(background) = background {
                    meta.insert("subagentBackground".into(), serde_json::json!(background));
                }
                send_session_update(&client, session_id, meta, update).await;
            }
        }
    }

    pub(super) fn continue_subagent_events(
        &self,
        session_id: acp::SessionId,
        session: Arc<AgentSession>,
        mut state: TurnState,
        mut events: tokio::sync::mpsc::Receiver<AgentEvent>,
    ) {
        let Some(client) = self.client.borrow().clone() else {
            return;
        };
        // The cancelled prompt returns promptly; its children still own their cleanup
        // and may publish their real terminal event after the foreground drain.
        tokio::task::spawn_local(async move {
            while let Some(event) = events.recv().await {
                match event {
                    AgentEvent::SubagentProgress {
                        task_id,
                        status,
                        metadata,
                        ..
                    } => {
                        let progress = state.child_progress.entry(task_id).or_default();
                        note_child_progress(progress, &status, &metadata);
                    }
                    AgentEvent::SubagentEnd {
                        task_id,
                        session_id: child_id,
                        success,
                        output,
                        finished_ms,
                        ..
                    } => {
                        let update = observed_subagent_end(
                            &session,
                            &state,
                            &task_id,
                            &child_id,
                            success,
                            &output,
                            finished_ms,
                        )
                        .await;
                        send_session_update(&client, &session_id, acp::Meta::new(), update).await;
                        state.subagent_started_ms.remove(&task_id);
                        state.child_progress.remove(&task_id);
                    }
                    _ => {}
                }
            }
            // Detached children can finish after the parent's event forwarder closes.
            // A10: bound the poll so a stuck Running / missing finished_ms cannot
            // spin a spawn_local task for the whole session (100ms × forever).
            let drain_deadline = tokio::time::Instant::now() + subagent_post_turn_drain_ttl();
            let mut tick = tokio::time::interval(std::time::Duration::from_millis(100));
            while !state.subagent_started_ms.is_empty() && !session.is_closed() {
                if subagent_post_turn_drain_timed_out(drain_deadline, tokio::time::Instant::now()) {
                    tracing::warn!(
                        remaining = state.subagent_started_ms.len(),
                        "ACP subagent post-turn drain timed out; dropping unfinished ids"
                    );
                    state.subagent_started_ms.clear();
                    state.child_progress.clear();
                    break;
                }
                tick.tick().await;
                let pending: Vec<_> = state.subagent_started_ms.keys().cloned().collect();
                for task_id in pending {
                    let Some(task) = session.subagent_task(&task_id).await else {
                        continue;
                    };
                    let Some(finished_ms) = task.finished_ms else {
                        continue;
                    };
                    let update = observed_subagent_end(
                        &session,
                        &state,
                        &task_id,
                        &task.child_session_id,
                        task.success.unwrap_or(false),
                        task.output.as_deref().unwrap_or_default(),
                        finished_ms,
                    )
                    .await;
                    send_session_update(&client, &session_id, acp::Meta::new(), update).await;
                    state.subagent_started_ms.remove(&task_id);
                    state.child_progress.remove(&task_id);
                }
            }
        });
    }

    /// Notify the client how the run closed at the completion gate, on a
    /// dedicated method so it needs no ACP enum variant. Emitted before the
    /// prompt response resolves (same FIFO wire ⇒ it precedes the marker).
    pub(super) async fn emit_turn_outcome(
        &self,
        session_id: &acp::SessionId,
        outcome: serde_json::Value,
    ) {
        let prompt_id = self
            .turn_generation
            .lock()
            .await
            .get(session_id.0.as_ref())
            .and_then(|turn| turn.prompt_id.clone());
        let payload = serde_json::json!({
            "sessionId": session_id.0.as_ref(),
            "promptId": prompt_id,
            "outcome": outcome,
        });
        let Ok(raw) = serde_json::value::to_raw_value(&payload) else {
            return;
        };
        let client = self.client.borrow().clone();
        let Some(client) = client else {
            return;
        };
        let _ = client
            .ext_notification(acp::ExtNotification::new("aster/turn/outcome", raw.into()))
            .await;
    }

    #[allow(clippy::too_many_arguments)] // event surface arity is the ACP wire shape
    pub(super) async fn emit_subagent_start(
        &self,
        session_id: &acp::SessionId,
        task_id: &str,
        child_session_id: &str,
        parent_session_id: &str,
        agent: &str,
        description: &str,
        started_ms: u64,
        tool_call_id: Option<&str>,
    ) {
        let mut update = serde_json::json!({
            "sessionUpdate": "subagent_spawned",
            "subagent_id": task_id,
            "parent_session_id": parent_session_id,
            "child_session_id": child_session_id,
            "subagent_type": agent,
            "description": description,
            "startedAt": started_ms,
        });
        if let Some(tool_call_id) = tool_call_id.filter(|id| !id.is_empty()) {
            update["toolCallId"] = serde_json::Value::String(tool_call_id.to_owned());
        }
        self.emit_xai_session_update(session_id, update).await;
    }

    #[allow(clippy::too_many_arguments)] // event surface arity is the ACP wire shape
    pub(super) async fn emit_subagent_progress(
        &self,
        session_id: &acp::SessionId,
        task_id: &str,
        child_session_id: &str,
        window_tokens: u64,
        metadata: &serde_json::Value,
        started_ms: u64,
        progress: &ChildProgress,
        tool_call_id: Option<&str>,
    ) {
        let tokens_used = progress_tokens_used(metadata);
        let (context_window_tokens, context_usage_pct) = context_usage(window_tokens, tokens_used);
        let mut update = serde_json::json!({
            "sessionUpdate": "subagent_progress",
            "subagent_id": task_id,
            "parent_session_id": session_id.0.as_ref(),
            "child_session_id": child_session_id,
            "duration_ms": progress_duration_ms(started_ms, unix_now_ms()),
            "turn_count": progress.turn_count,
            "tool_call_count": progress.tool_call_count,
            "tokens_used": tokens_used,
            "context_window_tokens": context_window_tokens,
            "context_usage_pct": context_usage_pct,
            "tools_used": progress.tools_used,
            "error_count": progress.error_count,
        });
        if let Some(tool_call_id) = tool_call_id.filter(|id| !id.is_empty()) {
            update["toolCallId"] = serde_json::Value::String(tool_call_id.to_owned());
        }
        for key in ["command", "disposition", "exitCode"] {
            if let Some(value) = metadata.get(key) {
                update[key] = value.clone();
            }
        }
        let mut meta = self.notification_meta(session_id);
        if let Some(background) = metadata.get("background").and_then(|value| value.as_bool()) {
            meta.insert("subagentBackground".into(), serde_json::json!(background));
        }
        let client = self.client.borrow().clone();
        if let Some(client) = client {
            send_session_update(&client, session_id, meta, update).await;
        }
    }
}

async fn send_session_update(
    client: &acp::AgentSideConnection,
    session_id: &acp::SessionId,
    meta: acp::Meta,
    update: serde_json::Value,
) {
    let payload = serde_json::json!({
        "sessionId": session_id.0.as_ref(),
        "update": update,
        "_meta": meta,
    });
    let Ok(raw) = serde_json::value::to_raw_value(&payload) else {
        return;
    };
    let _ = client
        .ext_notification(acp::ExtNotification::new(
            "aster/session_notification",
            raw.into(),
        ))
        .await;
}

pub(super) async fn observed_subagent_end(
    session: &AgentSession,
    state: &TurnState,
    task_id: &str,
    child_session_id: &str,
    success: bool,
    output: &str,
    finished_ms: u64,
) -> serde_json::Value {
    let task = session.subagent_task(task_id).await;
    project_subagent_end(
        state,
        task.as_ref(),
        task_id,
        child_session_id,
        success,
        output,
        finished_ms,
    )
}

fn project_subagent_end(
    state: &TurnState,
    task: Option<&aster_core::subagent_task_tracker::SubagentTaskSnapshot>,
    task_id: &str,
    child_session_id: &str,
    success: bool,
    output: &str,
    finished_ms: u64,
) -> serde_json::Value {
    let started_ms = state
        .subagent_started_ms
        .get(task_id)
        .copied()
        .unwrap_or(finished_ms);
    let mut progress = ChildProgress::default();
    if let Some(task) = task {
        for entry in &task.progress {
            note_child_progress(&mut progress, &entry.status, &entry.metadata);
        }
    }
    let progress = if task.is_some_and(|task| !task.progress.is_empty()) {
        progress
    } else {
        state
            .child_progress
            .get(task_id)
            .cloned()
            .unwrap_or(progress)
    };
    let mut update = subagent_finished_update(
        task_id,
        child_session_id,
        success,
        output,
        finished_ms.saturating_sub(started_ms),
        progress,
    );
    update["completedAt"] = serde_json::json!(finished_ms);
    if let Some(tool_call_id) = state.subagent_parent_tool.get(task_id) {
        if !tool_call_id.is_empty() {
            update["toolCallId"] = serde_json::Value::String(tool_call_id.clone());
        }
    }
    if task.is_some_and(|task| {
        task.status == aster_core::subagent_task_tracker::SubagentStatus::Cancelled
    }) {
        update["status"] = "stopped".into();
        update["error"] = serde_json::Value::Null;
    }
    update
}

pub(super) fn note_child_progress(
    progress: &mut ChildProgress,
    status: &str,
    metadata: &serde_json::Value,
) {
    let tokens = progress_tokens_used(metadata);
    if tokens > progress.tokens_used {
        progress.tokens_used = tokens;
    }
    if let Some(command) = metadata.get("command").and_then(|value| value.as_str()) {
        if progress.command.as_deref() != Some(command) {
            progress.command = Some(command.to_string());
        }
    }
    if let Some(disposition) = metadata.get("disposition").and_then(|value| value.as_str()) {
        if progress.disposition.as_deref() != Some(disposition) {
            progress.disposition = Some(disposition.to_string());
        }
    }
    if let Some(exit_code) = metadata.get("exitCode").and_then(|value| value.as_i64()) {
        progress.exit_code = Some(exit_code);
    }
    if status == "tool_completed" {
        progress.tool_call_count = progress.tool_call_count.saturating_add(1);
        if let Some(name) = metadata.get("tool").and_then(|value| value.as_str()) {
            if !progress.tools_used.iter().any(|existing| existing == name) {
                progress.tools_used.push(name.to_string());
            }
        }
        let exit_code = metadata
            .get("exit_code")
            .and_then(|value| value.as_i64())
            .unwrap_or(0);
        if exit_code != 0 || metadata.get("error_kind").is_some() {
            progress.error_count = progress.error_count.saturating_add(1);
        }
    } else if status == "turn_completed" {
        if let Some(turn) = metadata.get("turn").and_then(|value| value.as_u64()) {
            progress.turn_count = progress.turn_count.max(turn as u32);
        }
    }
}

pub(super) fn subagent_finished_update(
    task_id: &str,
    child_session_id: &str,
    success: bool,
    output: &str,
    duration_ms: u64,
    progress: ChildProgress,
) -> serde_json::Value {
    let status = match progress.disposition.as_deref() {
        Some("cancelled") => "stopped",
        Some("failed" | "timed_out" | "unknown") => "error",
        _ if success => "completed",
        _ => "error",
    };
    let error = if status == "completed" {
        None
    } else if output.trim().is_empty() {
        Some("subagent failed".to_string())
    } else {
        Some(output.chars().take(2_000).collect::<String>())
    };
    let mut update = serde_json::json!({
        "sessionUpdate": "subagent_finished",
        "subagent_id": task_id,
        "child_session_id": child_session_id,
        "status": status,
        "tool_calls": progress.tool_call_count,
        "turns": progress.turn_count,
        "duration_ms": duration_ms,
        "tokens_used": progress.tokens_used,
        "will_wake": false,
    });
    // Move owned command/disposition into the wire object — no second String clone.
    if let Some(command) = progress.command {
        update["command"] = serde_json::Value::String(command);
    }
    if let Some(disposition) = progress.disposition {
        update["disposition"] = serde_json::Value::String(disposition);
    }
    if let Some(exit_code) = progress.exit_code {
        update["exitCode"] = serde_json::json!(exit_code);
    }
    if let Some(error) = error {
        update["error"] = serde_json::Value::String(error);
    }
    if !output.is_empty() {
        update["output"] = serde_json::Value::String(output.chars().take(4_000).collect());
    }
    update
}

pub(super) fn progress_duration_ms(started_ms: u64, now_ms: u64) -> u64 {
    if started_ms == 0 {
        return 0;
    }
    now_ms.saturating_sub(started_ms)
}

pub(super) fn unix_now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

pub(super) fn progress_tokens_used(metadata: &serde_json::Value) -> u64 {
    metadata
        .get("prompt_tokens")
        .or_else(|| metadata.get("total_tokens"))
        .and_then(|value| value.as_u64())
        .unwrap_or(0)
}

pub(super) fn context_usage(window_tokens: u64, tokens_used: u64) -> (u64, u8) {
    if window_tokens == 0 {
        return (0, 0);
    }
    let pct = tokens_used.saturating_mul(100) / window_tokens;
    (window_tokens, pct.min(100) as u8)
}

/// A10: upper bound for post-turn subagent drain polling.
pub(super) fn subagent_post_turn_drain_ttl() -> std::time::Duration {
    std::time::Duration::from_secs(30)
}

pub(super) fn subagent_post_turn_drain_timed_out(
    deadline: tokio::time::Instant,
    now: tokio::time::Instant,
) -> bool {
    now >= deadline
}

#[cfg(test)]
#[path = "emit_tests.rs"]
mod tests;
