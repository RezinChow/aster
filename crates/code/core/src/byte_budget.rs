//! Shared byte-budget vocabulary for tool capture and effect persistence (P2-12).
//!
//! Tool output capture (`MAX_OUTPUT_SIZE`) and effect JSONL records
//! (`aster_effect::MAX_RECORD_BYTES`) remain separate ceilings, but discard
//! accounting and the named pair live here so hosts can assert one policy
//! surface without inventing a second truncation engine.

use crate::tools::MAX_OUTPUT_SIZE;

/// Named pair of the product's two primary byte ceilings.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SharedByteBudgets {
    /// In-memory process / tool output retention cap.
    pub tool_output_max: usize,
    /// Single effect log record persistence cap.
    pub effect_record_max: usize,
}

/// Current shared ceilings (tool capture + effect record).
pub fn shared_byte_budgets() -> SharedByteBudgets {
    SharedByteBudgets {
        tool_output_max: MAX_OUTPUT_SIZE,
        effect_record_max: aster_effect::MAX_RECORD_BYTES,
    }
}

/// Bytes observed but not retained after truncation.
pub fn discarded_bytes(total_bytes: usize, retained_bytes: usize) -> usize {
    total_bytes.saturating_sub(retained_bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tools::process::BoundedCapture;
    use crate::tools::process::OutputStream;

    #[test]
    fn shared_budgets_expose_positive_caps_and_discard_oracle() {
        let budgets = shared_byte_budgets();
        assert_eq!(budgets.tool_output_max, MAX_OUTPUT_SIZE);
        assert_eq!(budgets.effect_record_max, aster_effect::MAX_RECORD_BYTES);
        assert!(budgets.tool_output_max > 0);
        assert!(budgets.effect_record_max > budgets.tool_output_max);

        assert_eq!(discarded_bytes(100, 40), 60);
        assert_eq!(discarded_bytes(40, 40), 0);
        assert_eq!(discarded_bytes(10, 40), 0);
    }

    #[test]
    fn tool_capture_discard_count_is_measurable_when_over_budget() {
        let mut capture = BoundedCapture::new();
        let chunk = vec![b'x'; MAX_OUTPUT_SIZE / 2];
        capture.push(OutputStream::Stdout, &chunk);
        capture.push(OutputStream::Stdout, &chunk);
        capture.push(OutputStream::Stdout, &chunk);
        let summary = capture.summary(false);
        assert!(summary.truncated);
        let discarded = discarded_bytes(summary.total_bytes, summary.captured_bytes);
        assert!(discarded > 0, "expected discard when over tool_output_max");
        assert_eq!(
            summary.total_bytes,
            summary.captured_bytes.saturating_add(discarded)
        );
    }

    #[test]
    fn effect_record_budget_is_an_upper_bound_constant() {
        let budgets = shared_byte_budgets();
        assert!(
            budgets.effect_record_max >= 4 * 1024 * 1024,
            "persistence ceiling unexpectedly small"
        );
        // A synthetic record at the cap is not discarded by the policy helper;
        // oversize would be refused by FileLog (covered in aster-effect).
        assert_eq!(
            discarded_bytes(budgets.effect_record_max, budgets.effect_record_max),
            0
        );
        assert_eq!(
            discarded_bytes(
                budgets.effect_record_max.saturating_add(1),
                budgets.effect_record_max
            ),
            1
        );
    }
}
