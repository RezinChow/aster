//! Shared byte-budget vocabulary for tool capture, observation, and effect
//! persistence (P2-12 / E3).
//!
//! Tool output capture (`MAX_OUTPUT_SIZE`), porcelain observation hashing
//! (`OBSERVATION_BYTE_CAP`), and effect JSONL records
//! (`aster_effect::MAX_RECORD_BYTES`) remain separate ceilings, but discard
//! accounting and the named triple live here so hosts can assert one policy
//! surface without inventing a second truncation engine.

use crate::porcelain::OBSERVATION_BYTE_CAP;
use crate::tools::MAX_OUTPUT_SIZE;

/// Named triple of the product's primary byte ceilings.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SharedByteBudgets {
    /// In-memory process / tool output retention cap.
    pub tool_output_max: usize,
    /// Porcelain baseline / observation hash budget.
    pub observation_max: usize,
    /// Single effect log record persistence cap.
    pub effect_record_max: usize,
}

/// Current shared ceilings (tool capture + observation + effect record).
pub fn shared_byte_budgets() -> SharedByteBudgets {
    SharedByteBudgets {
        tool_output_max: MAX_OUTPUT_SIZE,
        observation_max: OBSERVATION_BYTE_CAP as usize,
        effect_record_max: aster_effect::MAX_RECORD_BYTES,
    }
}

/// Bytes observed but not retained after truncation.
pub fn discarded_bytes(total_bytes: usize, retained_bytes: usize) -> usize {
    total_bytes.saturating_sub(retained_bytes)
}

/// Serialized JSON byte length without allocating the encoded `Vec`.
///
/// Budget gates that only need `to_vec(...).len()` should use this so the
/// hot path does not retain a throwaway buffer.
pub fn json_serialized_len<T: serde::Serialize + ?Sized>(value: &T) -> serde_json::Result<usize> {
    struct Counter(usize);
    impl std::io::Write for Counter {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            self.0 = self.0.saturating_add(buf.len());
            Ok(buf.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    let mut counter = Counter(0);
    serde_json::to_writer(&mut counter, value)?;
    Ok(counter.0)
}

/// Feed canonical JSON bytes into a digest without retaining a throwaway `Vec`.
///
/// Serialize failures propagate — digests must not silently hash a truncated
/// write.
pub fn json_update_sha256(
    digest: &mut sha2::Sha256,
    value: &(impl serde::Serialize + ?Sized),
) -> serde_json::Result<()> {
    use sha2::Digest;
    struct Writer<'a>(&'a mut sha2::Sha256);
    impl std::io::Write for Writer<'_> {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            self.0.update(buf);
            Ok(buf.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    serde_json::to_writer(Writer(digest), value)
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
        assert_eq!(budgets.observation_max, OBSERVATION_BYTE_CAP as usize);
        assert_eq!(budgets.effect_record_max, aster_effect::MAX_RECORD_BYTES);
        assert!(budgets.tool_output_max > 0);
        assert!(budgets.effect_record_max > budgets.tool_output_max);
        // E3: observation hashing must not outrun a persistable effect record.
        assert!(
            budgets.observation_max <= budgets.effect_record_max,
            "observation_max {} must be ≤ effect_record_max {}",
            budgets.observation_max,
            budgets.effect_record_max
        );

        assert_eq!(discarded_bytes(100, 40), 60);
        assert_eq!(discarded_bytes(40, 40), 0);
        assert_eq!(discarded_bytes(10, 40), 0);
    }

    #[test]
    fn hg2_json_serialized_len_matches_to_vec() {
        let value = serde_json::json!({
            "title": "x".repeat(64),
            "items": [1, 2, 3],
            "ok": true,
        });
        let via_writer = json_serialized_len(&value).expect("count");
        let via_vec = serde_json::to_vec(&value).expect("encode").len();
        assert_eq!(via_writer, via_vec);
        assert!(via_writer > 64);
    }

    #[test]
    fn hg2_json_update_sha256_matches_to_vec() {
        use sha2::{Digest, Sha256};
        let value = serde_json::json!({
            "title": "x".repeat(64),
            "items": [1, 2, 3],
            "ok": true,
        });
        let mut streamed = Sha256::new();
        json_update_sha256(&mut streamed, &value).expect("stream");
        let mut buffered = Sha256::new();
        buffered.update(serde_json::to_vec(&value).expect("encode"));
        assert_eq!(
            format!("{:x}", streamed.finalize()),
            format!("{:x}", buffered.finalize())
        );
    }

    /// HG2 discard freeze grader: fixed total/retained → exact discarded_bytes.
    /// Measurable **waste** surface for near-term hard goal 高效; not product Pass.
    #[test]
    fn hg2_discard_freeze_grader_total_minus_retained() {
        let budgets = shared_byte_budgets();
        // Bash-style wire vocabulary used by ACP tool_raw_output tests.
        assert_eq!(discarded_bytes(4_096, 8), 4_088);
        assert_eq!(
            discarded_bytes(budgets.tool_output_max, budgets.tool_output_max),
            0
        );
        assert_eq!(
            discarded_bytes(
                budgets.tool_output_max.saturating_add(1),
                budgets.tool_output_max
            ),
            1
        );
        assert!(budgets.observation_max <= budgets.effect_record_max);
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
