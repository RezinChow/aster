//! Drive one admitted Core Run for either interactive or unattended attendance.
//! Admission, host retries and response mapping stay with the caller.

use super::*;

pub(super) struct AttemptCompletion {
    pub(super) state: TurnState,
    pub(super) join_failure: Option<String>,
    pub(super) turn_permit: OwnedMutexGuard<()>,
    pub(super) events_drained: std::time::Duration,
    pub(super) drain_started: std::time::Instant,
}

pub(super) enum AttemptDrive {
    Ended(AttemptCompletion),
    Cancelled(acp::Result<acp::PromptResponse>),
    DeadlineExceeded,
}

impl AsterCodeAgent {
    /// Drain and join an already admitted Run. The synchronous event hook is
    /// for attendance-specific accounting; event delivery itself stays shared.
    #[allow(clippy::too_many_arguments)]
    pub(super) async fn drive_attempt<F>(
        &self,
        session_id: &acp::SessionId,
        session: &AgentSession,
        stream: aster_core::AgentRunStream,
        generation: u64,
        turn_permit: OwnedMutexGuard<()>,
        observation: Option<&crate::run_observation::Binding>,
        remaining: Option<std::time::Duration>,
        mut note_event: F,
    ) -> AttemptDrive
    where
        F: FnMut(&AgentEvent),
    {
        let run = stream.run;
        let mut state = TurnState {
            observer: run.clone().and_then(|run| {
                observation.map(|binding| {
                    crate::run_observation::Observer::new(run, session_id.0.to_string(), binding)
                })
            }),
            ..TurnState::default()
        };
        let mut rx = stream.events;
        let mut join = stream.worker;
        let session_key = session_id.0.to_string();
        let drain_started = std::time::Instant::now();
        let deadline = remaining.map(|duration| tokio::time::Instant::now() + duration);
        let drain = async {
            self.emit_run_observation(
                state
                    .observer
                    .as_mut()
                    .and_then(|observer| observer.opened()),
            )
            .await;
            loop {
                tokio::select! {
                    biased;
                    event = rx.recv() => match event {
                        Some(event) => {
                            note_event(&event);
                            self.handle_event(session_id, session, &mut state, event).await;
                            // A question handler can cancel this generation
                            // before this drain yields back to select.
                            if self.turn_was_cancelled(&session_key, generation).await {
                                return None;
                            }
                        }
                        None => {
                            let events_drained = drain_started.elapsed();
                            return Some(((&mut join).await, events_drained));
                        }
                    },
                    result = &mut join => return Some((result, drain_started.elapsed())),
                }
            }
        };
        let result = tokio::select! {
            biased;
            _ = self.wait_for_turn_cancel(&session_key, generation) => None,
            _ = async {
                match deadline {
                    Some(deadline) if deadline > tokio::time::Instant::now() => {
                        tokio::time::sleep_until(deadline).await;
                    }
                    Some(_) => {}
                    None => std::future::pending::<()>().await,
                }
            } => {
                tracing::warn!("unattended deadline reached; cancelling the original run");
                if let Some(run) = run.clone() {
                    // The exact Run can finish its cooperative cleanup after the
                    // host publishes the deadline, with the turn permit still held.
                    tokio::spawn(async move { run.cancel().await });
                } else {
                    let _ = tokio::time::timeout(
                        crate::turn_cancel::CANCEL_ABORT_GRACE,
                        session.cancel(),
                    )
                    .await;
                }
                self.settle_public_join(join, turn_permit).await;
                return AttemptDrive::DeadlineExceeded;
            }
            result = drain => result,
        };
        let Some((joined, events_drained)) = result else {
            if let Some(run) = &run {
                run.cancel().await;
            }
            return AttemptDrive::Cancelled(
                self.leave_cancelled_turn(session_id, session, &mut state, rx, join, turn_permit)
                    .await,
            );
        };
        let join_failure = joined.err().map(worker_join_failure);
        if let (Some(message), None) = (&join_failure, &state.turn_failure) {
            tracing::error!(
                session = %session_id.0,
                detail = %message,
                "turn worker died without a terminal event"
            );
        }
        settle_attempt_state(&mut state, join_failure.as_deref());
        if !state.subagent_started_ms.is_empty() {
            let tracked_session = self
                .sessions
                .lock()
                .await
                .get(&session_key)
                .map(|live| Arc::clone(&live.session));
            if let Some(session) = tracked_session {
                let child_state = TurnState {
                    subagent_started_ms: std::mem::take(&mut state.subagent_started_ms),
                    child_progress: std::mem::take(&mut state.child_progress),
                    subagent_parent_tool: std::mem::take(&mut state.subagent_parent_tool),
                    ..TurnState::default()
                };
                self.continue_subagent_events(session_id.clone(), session, child_state, rx);
            }
        }
        AttemptDrive::Ended(AttemptCompletion {
            state,
            join_failure,
            turn_permit,
            events_drained,
            drain_started,
        })
    }

    /// Publish the terminal payload at the caller's existing ordering point.
    pub(super) async fn publish_attempt_outcome(
        &self,
        session_id: &acp::SessionId,
        state: &mut TurnState,
    ) {
        if let Some(outcome) = state.end_outcome.take() {
            self.emit_turn_outcome(session_id, outcome).await;
        }
    }
}

/// Settle EOF and worker failure without treating either as a clean EndTurn.
/// An explicit Core error remains more specific than the subsequent join error.
pub(super) fn settle_attempt_state(state: &mut TurnState, join_failure: Option<&str>) {
    if let (Some(message), None) = (join_failure, &state.turn_failure) {
        state.turn_failure = Some(message.to_owned());
    }
    if state.turn_failure.is_none() && state.end_text.is_none() {
        state.turn_failure = Some("turn worker exited without a terminal event".into());
    }
}
