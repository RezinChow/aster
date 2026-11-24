//! Structured question that parks a run without a write, a permission grant,
//! or a host steer.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

pub const USER_QUESTION_SCHEMA: &str = "aster.code.user-question.v1";
pub const USER_ANSWER_SCHEMA: &str = "aster.code.user-answer.v1";
pub const USER_FORM_ERROR_SCHEMA: &str = "aster.code.user-form-error.v1";
const MAX_QUESTIONS_PER_RUN: u32 = 3;
const MAX_OPTIONS: usize = 8;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UserQuestionV1 {
    pub schema: String,
    pub question_id: String,
    pub question: String,
    pub options: Vec<String>,
    pub allow_free_text: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AskUserResume {
    Answered { text: String },
    Unanswered,
}

fn counts() -> &'static Mutex<HashMap<String, u32>> {
    static COUNTS: OnceLock<Mutex<HashMap<String, u32>>> = OnceLock::new();
    COUNTS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Debug)]
pub enum AskUserError {
    CapExceeded,
    Invalid(&'static str),
    /// A pending elicitation with this id already owns the host channel.
    ElicitationBusy,
}

/// Admit one question for `run_id` before a question fact is appended.
///
/// The fourth question in a run is rejected here. An answer is a
/// `question.answered` fact, not an in-process wait.
pub fn begin(
    run_id: &str,
    question_id: &str,
    question: &str,
    options: &[String],
    allow_free_text: bool,
) -> Result<UserQuestionV1, AskUserError> {
    begin_on_channel(
        run_id,
        question_id,
        question,
        options,
        allow_free_text,
        crate::elicitation::ElicitationChannel::AskUser,
    )
}

/// Same as [`begin`], tagging the elicitation ledger with an explicit channel
/// (AskUser vs Form) so concurrent host surfaces do not cross-label.
pub fn begin_on_channel(
    run_id: &str,
    question_id: &str,
    question: &str,
    options: &[String],
    allow_free_text: bool,
    channel: crate::elicitation::ElicitationChannel,
) -> Result<UserQuestionV1, AskUserError> {
    if question.trim().is_empty() {
        return Err(AskUserError::Invalid("question is required"));
    }
    if options.len() > MAX_OPTIONS {
        return Err(AskUserError::Invalid("too many options"));
    }
    let mut slots = counts().lock().expect("ask-user counts");
    let count = slots.entry(run_id.to_string()).or_insert(0);
    if *count >= MAX_QUESTIONS_PER_RUN {
        return Err(AskUserError::CapExceeded);
    }
    *count += 1;
    let sequence = *count;
    drop(slots);
    let question = UserQuestionV1 {
        schema: USER_QUESTION_SCHEMA.to_string(),
        question_id: format!("{question_id}-{sequence}"),
        question: question.to_string(),
        options: options.to_vec(),
        allow_free_text,
    };
    if let Err(error) = crate::elicitation::begin(&question.question_id, channel) {
        let mut slots = counts().lock().expect("ask-user counts");
        if let Some(count) = slots.get_mut(run_id) {
            *count = count.saturating_sub(1);
            if *count == 0 {
                slots.remove(run_id);
            }
        }
        drop(slots);
        match error {
            crate::elicitation::ElicitationError::DuplicateId => {
                return Err(AskUserError::ElicitationBusy);
            }
            crate::elicitation::ElicitationError::NotFound
            | crate::elicitation::ElicitationError::AlreadyTerminal => {
                return Err(AskUserError::Invalid("elicitation ledger refused begin"));
            }
        }
    }
    Ok(question)
}

fn pending_answers() -> &'static Mutex<HashMap<String, String>> {
    static ANSWERS: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    ANSWERS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn answer_notify() -> &'static tokio::sync::Notify {
    static NOTIFY: OnceLock<tokio::sync::Notify> = OnceLock::new();
    NOTIFY.get_or_init(tokio::sync::Notify::new)
}

/// Record a host answer for a later `question.answered` fact.
///
/// Returns false. The call does not settle the run; the fact log does.
pub fn answer(question_id: &str, text: &str) -> bool {
    if question_id.trim().is_empty() || text.trim().is_empty() {
        return false;
    }
    pending_answers()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .insert(question_id.to_string(), text.to_string());
    let _ = crate::elicitation::resolve(question_id, text);
    answer_notify().notify_waiters();
    false
}

/// Wait until [`answer`] stores text for `question_id`, or the run is cancelled.
pub async fn wait_for_answer(
    question_id: &str,
    cancel: &tokio_util::sync::CancellationToken,
) -> Option<String> {
    loop {
        let notified = answer_notify().notified();
        tokio::pin!(notified);
        notified.as_mut().enable();
        if let Some(text) = pending_answers()
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .remove(question_id)
        {
            return Some(text);
        }
        if cancel.is_cancelled() {
            let _ = crate::elicitation::cancel(question_id);
            return None;
        }
        tokio::select! {
            _ = &mut notified => {}
            _ = cancel.cancelled() => {
                let _ = crate::elicitation::cancel(question_id);
                return None;
            }
        }
    }
}

/// Cancellation no longer synthesizes an unanswered result.
pub fn cancel(question_id: &str) -> bool {
    let _ = crate::elicitation::cancel(question_id);
    false
}

pub fn resume_message(question_id: &str, resume: &AskUserResume) -> String {
    let value = match resume {
        AskUserResume::Answered { text } => serde_json::json!({
            "schema": USER_ANSWER_SCHEMA,
            "question_id": question_id,
            "status": "answered",
            "answer": text,
            "permission_grant": false,
        }),
        AskUserResume::Unanswered => serde_json::json!({
            "schema": USER_ANSWER_SCHEMA,
            "question_id": question_id,
            "status": "unanswered",
            "permission_grant": false,
        }),
    };
    value.to_string()
}

pub fn is_permission_grant(metadata: &Value) -> bool {
    metadata
        .get("permission_grant")
        .and_then(Value::as_bool)
        .unwrap_or(false)
        || metadata
            .get("approved")
            .and_then(Value::as_bool)
            .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn begin_keeps_allow_free_text_and_does_not_answer_in_process() {
        let question = begin("run-1", "q-1", "Which file?", &["a.rs".into()], true).unwrap();
        assert_eq!(question.schema, USER_QUESTION_SCHEMA);
        assert!(question.allow_free_text);
        assert_eq!(question.options, vec!["a.rs".to_string()]);
        assert!(!answer(&question.question_id, "a.rs"));
        assert!(!cancel(&question.question_id));
        let message = resume_message(
            &question.question_id,
            &AskUserResume::Answered {
                text: "a.rs".into(),
            },
        );
        let value: Value = serde_json::from_str(&message).unwrap();
        assert_eq!(value["status"], "answered");
        assert!(!is_permission_grant(&value));
    }

    #[test]
    fn question_cap_rejects_a_fourth_question() {
        for index in 0..MAX_QUESTIONS_PER_RUN {
            begin("run-cap", &format!("q-{index}"), "again?", &[], false).unwrap();
        }
        assert!(matches!(
            begin("run-cap", "q-over", "again?", &[], false),
            Err(AskUserError::CapExceeded)
        ));
    }

    #[test]
    fn begin_rejects_empty_question_and_option_overflow() {
        assert!(matches!(
            begin("run-invalid", "q-empty", "   ", &[], false),
            Err(AskUserError::Invalid(_))
        ));
        let options: Vec<String> = (0..=MAX_OPTIONS)
            .map(|index| format!("opt-{index}"))
            .collect();
        assert!(matches!(
            begin("run-invalid", "q-options", "pick one?", &options, false),
            Err(AskUserError::Invalid(_))
        ));
    }

    #[test]
    fn begin_fails_closed_when_elicitation_id_already_pending() {
        // First ask on this run would mint `q-busy-1`. Occupy that ledger id first.
        crate::elicitation::begin("q-busy-1", crate::elicitation::ElicitationChannel::AskUser)
            .expect("seed pending");
        assert!(matches!(
            begin("run-busy", "q-busy", "already open?", &[], false),
            Err(AskUserError::ElicitationBusy)
        ));
        // Cap slot must be released so a later ask can proceed after cancel.
        crate::elicitation::cancel("q-busy-1").expect("clear seed");
        begin("run-busy", "q-busy", "now free?", &[], false).expect("retry after cancel");
    }

    #[tokio::test]
    async fn wait_for_answer_reads_the_stored_host_text() {
        let cancel = tokio_util::sync::CancellationToken::new();
        let question_id = format!("wait-{}", std::process::id());
        let cancel_for_answer = cancel.clone();
        let id = question_id.clone();
        tokio::spawn(async move {
            let _ = cancel_for_answer;
            assert!(!answer(&id, "host-token"));
        });
        let text = tokio::time::timeout(
            std::time::Duration::from_secs(2),
            wait_for_answer(&question_id, &cancel),
        )
        .await
        .expect("host answer")
        .expect("stored answer");
        assert_eq!(text, "host-token");
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn wait_for_answer_never_misses_concurrent_answers() {
        for iter in 0..100 {
            let cancel = tokio_util::sync::CancellationToken::new();
            let question_id = format!("wait-race-{}-{iter}", std::process::id());
            let id = question_id.clone();
            let poster = tokio::spawn(async move {
                assert!(!answer(&id, "ok"));
            });
            let text = tokio::time::timeout(
                std::time::Duration::from_secs(2),
                wait_for_answer(&question_id, &cancel),
            )
            .await
            .expect("wait_for_answer must not miss concurrent notify_waiters")
            .expect("stored answer");
            poster.await.unwrap();
            assert_eq!(text, "ok");
        }
    }

    #[test]
    fn answer_and_cancel_return_false_for_unknown_question_ids() {
        assert!(!answer("missing-question", "nope"));
        assert!(!cancel("missing-question"));
    }

    #[test]
    fn is_permission_grant_honors_legacy_approved_field() {
        let metadata = serde_json::json!({"approved": true});
        assert!(is_permission_grant(&metadata));
        assert!(!is_permission_grant(
            &serde_json::json!({"permission_grant": false})
        ));
    }
}
