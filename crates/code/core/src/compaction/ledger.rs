//! Named compaction lifecycle ledger.
//!
//! One compact attempt exposes assertable pre/post budget fields so tests and
//! hosts can oracle trigger, reclaim, and standing carry without reading
//! rendered summaries.

use super::should_auto_compact;

/// Lifecycle phase of a single compact attempt.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum CompactionLedgerPhase {
    /// Budget snapshot taken; compact not started.
    Open,
    /// Compact started; `tokens_after` still unknown.
    Started,
    /// Compact finished; `tokens_after` and carry counts are set.
    Completed,
}

/// Assertable pre/post budget fields for one compact attempt.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct CompactionLedger {
    phase: CompactionLedgerPhase,
    context_window: u64,
    tokens_used: u64,
    tokens_after: Option<u64>,
    target_context_tokens: u64,
    /// Trigger threshold in basis points (8500 = 0.85) so `Eq` stays stable.
    trigger_threshold_bps: u16,
    carried_standing_lines: usize,
}

impl CompactionLedger {
    /// Open a ledger from the live budget snapshot before compact runs.
    pub(crate) fn open(
        context_window: u64,
        tokens_used: u64,
        target_context_tokens: u64,
        trigger_threshold: f32,
    ) -> Self {
        let trigger_threshold_bps = if trigger_threshold.is_finite() {
            (trigger_threshold.clamp(0.05, 1.0) * 10_000.0).round() as u16
        } else {
            8_500
        };
        Self {
            phase: CompactionLedgerPhase::Open,
            context_window,
            tokens_used,
            tokens_after: None,
            target_context_tokens,
            trigger_threshold_bps,
            carried_standing_lines: 0,
        }
    }

    /// Whether usage crossed the auto-compact trigger for this snapshot.
    pub(crate) fn should_trigger(&self) -> bool {
        let threshold = f32::from(self.trigger_threshold_bps) / 10_000.0;
        should_auto_compact(
            self.tokens_used as usize,
            self.context_window as usize,
            threshold,
        )
    }

    pub(crate) fn mark_started(&mut self) {
        self.phase = CompactionLedgerPhase::Started;
        self.tokens_after = None;
    }

    /// Record post-compact estimate and how many standing lines were carried.
    pub(crate) fn mark_completed(&mut self, tokens_after: u64, carried_standing_lines: usize) {
        self.phase = CompactionLedgerPhase::Completed;
        self.tokens_after = Some(tokens_after);
        self.carried_standing_lines = carried_standing_lines;
    }

    pub(crate) fn phase(&self) -> CompactionLedgerPhase {
        self.phase
    }

    pub(crate) fn context_window(&self) -> u64 {
        self.context_window
    }

    pub(crate) fn tokens_used(&self) -> u64 {
        self.tokens_used
    }

    pub(crate) fn tokens_after(&self) -> Option<u64> {
        self.tokens_after
    }

    pub(crate) fn target_context_tokens(&self) -> u64 {
        self.target_context_tokens
    }

    pub(crate) fn carried_standing_lines(&self) -> usize {
        self.carried_standing_lines
    }

    /// Wire fields for [`crate::agent::AgentEvent::AutoCompact`].
    ///
    /// `tokens_after` is `0` while the compact is still running.
    pub(crate) fn auto_compact_fields(&self) -> Option<(&'static str, u64, u64, u64)> {
        match self.phase {
            CompactionLedgerPhase::Open => None,
            CompactionLedgerPhase::Started => {
                Some(("started", self.tokens_used, self.context_window, 0))
            }
            CompactionLedgerPhase::Completed => Some((
                "completed",
                self.tokens_used,
                self.context_window,
                self.tokens_after.unwrap_or(0),
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compaction_carry::{obligations_from_folded, seal_summary};
    use crate::llm::Message;

    #[test]
    fn over_budget_opens_as_trigger_under_budget_does_not() {
        let over = CompactionLedger::open(10_000, 9_000, 8_000, 0.85);
        assert_eq!(over.phase(), CompactionLedgerPhase::Open);
        assert!(over.should_trigger());
        assert_eq!(over.tokens_used(), 9_000);
        assert_eq!(over.context_window(), 10_000);
        assert_eq!(over.target_context_tokens(), 8_000);
        assert!(over.tokens_after().is_none());
        assert!(over.auto_compact_fields().is_none());

        let under = CompactionLedger::open(10_000, 1_000, 8_000, 0.85);
        assert!(!under.should_trigger());
    }

    #[test]
    fn pre_post_fields_are_assertable_across_lifecycle() {
        let mut ledger = CompactionLedger::open(4_096, 3_600, 3_000, 0.8);
        assert!(ledger.should_trigger());
        ledger.mark_started();
        assert_eq!(ledger.phase(), CompactionLedgerPhase::Started);
        assert_eq!(
            ledger.auto_compact_fields(),
            Some(("started", 3_600, 4_096, 0))
        );

        ledger.mark_completed(2_100, 2);
        assert_eq!(ledger.phase(), CompactionLedgerPhase::Completed);
        assert_eq!(ledger.tokens_after(), Some(2_100));
        assert_eq!(ledger.carried_standing_lines(), 2);
        assert!(
            ledger.tokens_after().unwrap() < ledger.tokens_used(),
            "oracle: compact must reclaim below pre-compact usage"
        );
        assert_eq!(
            ledger.auto_compact_fields(),
            Some(("completed", 3_600, 4_096, 2_100))
        );
    }

    #[test]
    fn over_budget_compact_retains_standing_carry_in_ledger() {
        let standing = "\
# Instructions (personal + project AGENTS.md chain)
Always keep the red gate closed.
<!-- /standing -->";
        let folded = vec![
            format!("user\n{standing}"),
            "assistant\nObserved many opaque values.".repeat(40),
            "user\nContinue the red gate work.".to_string(),
        ];
        let carried = obligations_from_folded(&folded);
        assert!(
            !carried.standing.is_empty(),
            "fixture must extract standing lines"
        );

        let mut ledger = CompactionLedger::open(2_048, 2_000, 1_500, 0.8);
        assert!(ledger.should_trigger());
        ledger.mark_started();

        let handoff = seal_summary("Short handoff of observed values.", &carried);
        assert!(
            handoff.contains("Always keep the red gate closed."),
            "standing text must survive seal_summary"
        );
        // Standing block is present as messages after compact path.
        let summary_message = format!("{}{}", crate::prompts::CONTEXT_SUMMARY_PREFIX, handoff);
        let next = [
            Message::user(standing),
            Message::user(summary_message.as_str()),
        ];
        let retained = crate::compaction_carry::obligations_from_messages(&next);
        assert!(
            retained
                .standing
                .iter()
                .any(|line| line.contains("red gate")),
            "carry must remain after compact handoff"
        );

        ledger.mark_completed(900, carried.standing.len());
        assert_eq!(ledger.carried_standing_lines(), carried.standing.len());
        assert!(ledger.tokens_after().unwrap() < ledger.tokens_used());
        assert_eq!(ledger.phase(), CompactionLedgerPhase::Completed);
    }
}
