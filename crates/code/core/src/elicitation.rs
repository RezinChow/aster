//! Unified elicitation state surface (P2-10).
//!
//! Covers the three existing host channels without collapsing them into one
//! UI skin:
//! - [`ElicitationChannel::Permission`] — `session/request_permission`
//! - [`ElicitationChannel::AskUser`] — `ask_user`
//! - [`ElicitationChannel::Form`] — `ask_user_form` / `aster/form/request`
//!
//! Concurrent pending requests are keyed by id so two in-flight elicitations
//! do not cross-deliver results. Cancel removes the pending entry.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

/// Host channel that can pause a run for user input.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ElicitationChannel {
    Permission,
    AskUser,
    Form,
}

/// Lifecycle of one elicitation request.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ElicitationPhase {
    Pending,
    Resolved,
    Cancelled,
}

/// One pending or finished elicitation.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ElicitationRecord {
    pub id: String,
    pub channel: ElicitationChannel,
    pub phase: ElicitationPhase,
    pub answer: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ElicitationError {
    DuplicateId,
    NotFound,
    AlreadyTerminal,
}

fn table() -> &'static Mutex<HashMap<String, ElicitationRecord>> {
    static TABLE: OnceLock<Mutex<HashMap<String, ElicitationRecord>>> = OnceLock::new();
    TABLE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Stable ledger id for an ACP `session/request_permission` tool ask.
pub fn permission_id(session_id: &str, tool_id: &str) -> String {
    format!("permission:{session_id}:{tool_id}")
}

/// Open a pending elicitation. A second pending id fails closed; a terminal
/// record may be replaced so the same tool id can ask again in one process.
pub fn begin(
    id: impl Into<String>,
    channel: ElicitationChannel,
) -> Result<ElicitationRecord, ElicitationError> {
    let id = id.into();
    let mut guard = table().lock().expect("elicitation table");
    if let Some(existing) = guard.get(&id) {
        if existing.phase == ElicitationPhase::Pending {
            return Err(ElicitationError::DuplicateId);
        }
    }
    let record = ElicitationRecord {
        id: id.clone(),
        channel,
        phase: ElicitationPhase::Pending,
        answer: None,
    };
    guard.insert(id, record.clone());
    Ok(record)
}

/// Resolve a pending elicitation with an answer.
pub fn resolve(id: &str, answer: impl Into<String>) -> Result<ElicitationRecord, ElicitationError> {
    let mut guard = table().lock().expect("elicitation table");
    let Some(record) = guard.get_mut(id) else {
        return Err(ElicitationError::NotFound);
    };
    if record.phase != ElicitationPhase::Pending {
        return Err(ElicitationError::AlreadyTerminal);
    }
    record.phase = ElicitationPhase::Resolved;
    record.answer = Some(answer.into());
    Ok(record.clone())
}

/// Cancel a pending elicitation.
pub fn cancel(id: &str) -> Result<ElicitationRecord, ElicitationError> {
    let mut guard = table().lock().expect("elicitation table");
    let Some(record) = guard.get_mut(id) else {
        return Err(ElicitationError::NotFound);
    };
    if record.phase != ElicitationPhase::Pending {
        return Err(ElicitationError::AlreadyTerminal);
    }
    record.phase = ElicitationPhase::Cancelled;
    Ok(record.clone())
}

/// Snapshot one record.
pub fn get(id: &str) -> Option<ElicitationRecord> {
    table().lock().expect("elicitation table").get(id).cloned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::thread;

    fn unique(prefix: &str) -> String {
        static NEXT: AtomicU64 = AtomicU64::new(1);
        format!(
            "{prefix}-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::SeqCst)
        )
    }

    #[test]
    fn channels_cover_permission_ask_user_and_form() {
        for channel in [
            ElicitationChannel::Permission,
            ElicitationChannel::AskUser,
            ElicitationChannel::Form,
        ] {
            let id = unique(&format!("ch-{:?}", channel));
            let opened = begin(&id, channel).unwrap();
            assert_eq!(opened.phase, ElicitationPhase::Pending);
            assert_eq!(opened.channel, channel);
        }
    }

    #[test]
    fn concurrent_requests_do_not_cross_deliver() {
        let id_a = unique("a");
        let id_b = unique("b");
        begin(&id_a, ElicitationChannel::AskUser).unwrap();
        begin(&id_b, ElicitationChannel::Form).unwrap();

        let id_a2 = id_a.clone();
        let id_b2 = id_b.clone();
        let handle_a = thread::spawn(move || resolve(&id_a2, "answer-a").unwrap());
        let handle_b = thread::spawn(move || resolve(&id_b2, "answer-b").unwrap());
        let a = handle_a.join().unwrap();
        let b = handle_b.join().unwrap();

        assert_eq!(a.answer.as_deref(), Some("answer-a"));
        assert_eq!(b.answer.as_deref(), Some("answer-b"));
        assert_eq!(get(&id_a).unwrap().answer.as_deref(), Some("answer-a"));
        assert_eq!(get(&id_b).unwrap().answer.as_deref(), Some("answer-b"));
        assert_ne!(a.answer, b.answer);
    }

    #[test]
    fn cancel_path_marks_pending_cancelled() {
        let id = unique("c1");
        begin(&id, ElicitationChannel::Permission).unwrap();
        let cancelled = cancel(&id).unwrap();
        assert_eq!(cancelled.phase, ElicitationPhase::Cancelled);
        assert!(resolve(&id, "late").is_err());
    }

    #[test]
    fn terminal_permission_id_may_reopen_for_a_later_ask() {
        let id = permission_id("s1", "tool-1");
        begin(&id, ElicitationChannel::Permission).unwrap();
        resolve(&id, "allow-once").unwrap();
        let reopened = begin(&id, ElicitationChannel::Permission).unwrap();
        assert_eq!(reopened.phase, ElicitationPhase::Pending);
        assert_eq!(reopened.answer, None);
        assert!(begin(&id, ElicitationChannel::Permission).is_err());
    }
}
