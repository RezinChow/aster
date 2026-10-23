//! Bounded deterministic second-stage ranking for fused workspace evidence.

use super::hybrid_rank::compare_fused;
use super::{
    WorkspaceHybridSearchHit, WorkspaceRerankAlgorithm, WorkspaceRerankFallbackReason,
    WorkspaceRerankMode, WorkspaceRerankOptions, WorkspaceRerankStatus, WorkspaceRetrievalError,
    WorkspaceRetrievalResult,
};
use std::cmp::Ordering;
use std::collections::HashMap;
use std::sync::Arc;

mod features;
use features::{CandidateFeatures, candidate_features, scratch_bytes};

const MAX_CANDIDATES: usize = 100;
const MAX_FEATURE_BYTES_PER_CANDIDATE: usize = 4 * 1024;
const MAX_FINGERPRINTS_PER_CANDIDATE: usize = 128;
const MAX_SCRATCH_BYTES: usize = 4 * 1024 * 1024;
const MAX_RESULTS_PER_FILE: usize = 2;
const NEAR_DUPLICATE_THRESHOLD: f64 = 0.85;
const RELEVANCE_WEIGHT: f64 = 0.70;
const CHANNEL_AGREEMENT_WEIGHT: f64 = 0.10;
const DIVERSITY_WEIGHT: f64 = 0.20;
const NEAR_DUPLICATE_PENALTY: f64 = 0.50;
const MAX_CHANNELS: usize = 4;
const FNV_OFFSET: u64 = 0xcbf29ce484222325;
const FNV_PRIME: u64 = 0x100000001b3;

pub(super) struct RerankOutcome {
    pub hits: Vec<WorkspaceHybridSearchHit>,
    pub status: WorkspaceRerankStatus,
}

pub(super) fn rerank_status_not_run(requested_mode: WorkspaceRerankMode) -> WorkspaceRerankStatus {
    WorkspaceRerankStatus {
        requested_mode,
        applied_mode: WorkspaceRerankMode::RrfOnly,
        algorithm: WorkspaceRerankAlgorithm::RrfK60,
        input_candidates: 0,
        evaluated_candidates: 0,
        selected_candidates: 0,
        near_duplicate_candidates: 0,
        selected_near_duplicates: 0,
        feature_bytes: 0,
        accounted_scratch_bytes: 0,
        candidate_truncated: false,
        fallback: None,
    }
}

impl WorkspaceRerankOptions {
    /// Validate the hard candidate, feature, fingerprint, and scratch bounds.
    ///
    /// Hosts and language bindings can call this before catalog work or
    /// provider execution so invalid settings cause no source egress.
    pub fn validate(&self) -> WorkspaceRetrievalResult<()> {
        validate_range(
            self.max_candidates,
            1,
            MAX_CANDIDATES,
            "rerank.max_candidates",
        )?;
        validate_range(
            self.max_feature_bytes_per_candidate,
            4,
            MAX_FEATURE_BYTES_PER_CANDIDATE,
            "rerank.max_feature_bytes_per_candidate",
        )?;
        validate_range(
            self.max_fingerprints_per_candidate,
            1,
            MAX_FINGERPRINTS_PER_CANDIDATE,
            "rerank.max_fingerprints_per_candidate",
        )?;
        validate_range(
            self.max_scratch_bytes,
            1,
            MAX_SCRATCH_BYTES,
            "rerank.max_scratch_bytes",
        )?;
        Ok(())
    }
}

fn validate_range(
    value: usize,
    minimum: usize,
    maximum: usize,
    field: &'static str,
) -> WorkspaceRetrievalResult<()> {
    if !(minimum..=maximum).contains(&value) {
        return Err(WorkspaceRetrievalError::InvalidConfiguration {
            field,
            reason: "is outside the supported bounded range",
        });
    }
    Ok(())
}

pub(super) fn rerank_fused_candidates(
    mut candidates: Vec<WorkspaceHybridSearchHit>,
    limit: usize,
    options: WorkspaceRerankOptions,
) -> RerankOutcome {
    candidates.sort_by(compare_fused);
    let input_candidates = candidates.len();
    // Phase 4 priors (specs/013): apply only when the mode re-ranks; the
    // RrfOnly contract preserves deterministic fused ordering.
    if options.mode != WorkspaceRerankMode::RrfOnly {
        if let Some(query) = options.query.as_deref() {
            let shape = classify_query(query);
            for hit in candidates.iter_mut() {
                apply_noise_penalty(hit, query);
                apply_definition_boost(hit, query);
                let lexical = channel_lean(shape, "lexical");
                let semantic = channel_lean(shape, "semantic");
                let structural = channel_lean(shape, "structural");
                let lean = 1.0 + (lexical - 1.0) + (semantic - 1.0) + (structural - 1.0);
                hit.rerank_score *= lean.max(0.5);
            }
        }
    }
    if options.mode == WorkspaceRerankMode::RrfOnly {
        return rrf_only(
            candidates,
            limit,
            input_candidates,
            options.mode,
            0,
            false,
            None,
        );
    }
    if options.validate().is_err() {
        return rrf_only(
            candidates,
            limit,
            input_candidates,
            options.mode,
            0,
            false,
            Some(WorkspaceRerankFallbackReason::InvalidConfiguration),
        );
    }

    let candidate_truncated = candidates.len() > options.max_candidates;
    let evaluated_candidates = candidates.len().min(options.max_candidates);
    let accounted_scratch_bytes = scratch_bytes(evaluated_candidates, &options);
    if accounted_scratch_bytes > options.max_scratch_bytes {
        return rrf_only(
            candidates,
            limit,
            input_candidates,
            options.mode,
            accounted_scratch_bytes,
            candidate_truncated,
            Some(WorkspaceRerankFallbackReason::ScratchBudgetExceeded),
        );
    }
    candidates = bounded_candidate_pool(candidates, options.max_candidates);

    let features = candidates
        .iter()
        .map(|candidate| candidate_features(&candidate.chunk.text, &options))
        .collect::<Vec<_>>();
    let feature_bytes = features.iter().fold(0usize, |total, features| {
        total.saturating_add(features.feature_bytes)
    });
    let near_duplicate_candidates = count_near_duplicates(&candidates, &features);
    let (hits, selected_near_duplicates) = select_mmr(candidates, &features, limit);
    let selected_candidates = hits.len();

    RerankOutcome {
        hits,
        status: WorkspaceRerankStatus {
            requested_mode: options.mode,
            applied_mode: WorkspaceRerankMode::Deterministic,
            algorithm: WorkspaceRerankAlgorithm::RrfK60DeterministicMmrV1,
            input_candidates,
            evaluated_candidates: features.len(),
            selected_candidates,
            near_duplicate_candidates,
            selected_near_duplicates,
            feature_bytes,
            accounted_scratch_bytes,
            candidate_truncated,
            fallback: None,
        },
    }
}

fn bounded_candidate_pool(
    candidates: Vec<WorkspaceHybridSearchHit>,
    maximum: usize,
) -> Vec<WorkspaceHybridSearchHit> {
    if candidates.len() <= maximum {
        return candidates;
    }

    let mut selected = Vec::<usize>::with_capacity(maximum);
    for per_file_quota in 1..=MAX_RESULTS_PER_FILE {
        for (index, candidate) in candidates.iter().enumerate() {
            if selected.len() == maximum {
                break;
            }
            if selected.contains(&index) {
                continue;
            }
            let selected_for_file = selected
                .iter()
                .filter(|selected_index| {
                    candidates[**selected_index].chunk.path == candidate.chunk.path
                })
                .count();
            if selected_for_file < per_file_quota {
                selected.push(index);
            }
        }
    }
    for index in 0..candidates.len() {
        if selected.len() == maximum {
            break;
        }
        if !selected.contains(&index) {
            selected.push(index);
        }
    }
    selected.sort_unstable();

    let mut selected = selected.into_iter().peekable();
    candidates
        .into_iter()
        .enumerate()
        .filter_map(|(index, candidate)| {
            if selected.next_if_eq(&index).is_some() {
                Some(candidate)
            } else {
                None
            }
        })
        .collect()
}

fn rrf_only(
    candidates: Vec<WorkspaceHybridSearchHit>,
    limit: usize,
    input_candidates: usize,
    requested_mode: WorkspaceRerankMode,
    accounted_scratch_bytes: usize,
    candidate_truncated: bool,
    fallback: Option<WorkspaceRerankFallbackReason>,
) -> RerankOutcome {
    let mut per_file = HashMap::<Arc<str>, usize>::new();
    let hits = candidates
        .into_iter()
        .filter_map(|mut candidate| {
            let count = per_file
                .entry(Arc::clone(&candidate.chunk.path))
                .or_default();
            if *count >= MAX_RESULTS_PER_FILE {
                return None;
            }
            *count += 1;
            candidate.rerank_score = candidate.fused_score;
            candidate.redundancy_score = 0.0;
            Some(candidate)
        })
        .take(limit)
        .collect::<Vec<_>>();
    let selected_candidates = hits.len();
    RerankOutcome {
        hits,
        status: WorkspaceRerankStatus {
            requested_mode,
            applied_mode: WorkspaceRerankMode::RrfOnly,
            algorithm: WorkspaceRerankAlgorithm::RrfK60,
            input_candidates,
            evaluated_candidates: 0,
            selected_candidates,
            near_duplicate_candidates: 0,
            selected_near_duplicates: 0,
            feature_bytes: 0,
            accounted_scratch_bytes,
            candidate_truncated,
            fallback,
        },
    }
}

fn select_mmr(
    candidates: Vec<WorkspaceHybridSearchHit>,
    features: &[CandidateFeatures],
    limit: usize,
) -> (Vec<WorkspaceHybridSearchHit>, usize) {
    let exact_max = maximum_fused_score(&candidates, true);
    let non_exact_max = maximum_fused_score(&candidates, false);
    let mut selected = Vec::<usize>::with_capacity(limit.min(candidates.len()));
    let mut selected_scores = Vec::<(f64, f64)>::with_capacity(selected.capacity());
    let mut selected_flags = vec![false; candidates.len()];
    let mut per_file = HashMap::<Arc<str>, usize>::new();
    let mut selected_near_duplicates = 0usize;

    while selected.len() < limit {
        let select_exact = candidates.iter().enumerate().any(|(index, candidate)| {
            !selected_flags[index]
                && candidate.exact_identifier
                && per_file.get(&candidate.chunk.path).copied().unwrap_or(0) < MAX_RESULTS_PER_FILE
        });
        let maximum = if select_exact {
            exact_max
        } else {
            non_exact_max
        };
        let mut best = None::<(usize, f64, f64)>;
        for (index, candidate) in candidates.iter().enumerate() {
            if selected_flags[index]
                || candidate.exact_identifier != select_exact
                || per_file.get(&candidate.chunk.path).copied().unwrap_or(0) >= MAX_RESULTS_PER_FILE
            {
                continue;
            }
            let redundancy = selected.iter().fold(0.0_f64, |maximum, selected_index| {
                maximum.max(candidate_similarity(
                    candidate,
                    &features[index],
                    &candidates[*selected_index],
                    &features[*selected_index],
                ))
            });
            let score = selection_score(candidate, maximum, redundancy);
            let replace = best.is_none_or(|(best_index, best_score, _)| {
                score
                    .total_cmp(&best_score)
                    .then_with(|| best_index.cmp(&index))
                    == Ordering::Greater
            });
            if replace {
                best = Some((index, score, redundancy));
            }
        }
        let Some((index, score, redundancy)) = best else {
            break;
        };
        selected_flags[index] = true;
        *per_file
            .entry(Arc::clone(&candidates[index].chunk.path))
            .or_default() += 1;
        if redundancy >= NEAR_DUPLICATE_THRESHOLD {
            selected_near_duplicates = selected_near_duplicates.saturating_add(1);
        }
        selected.push(index);
        selected_scores.push((score, redundancy));
    }

    let hits = selected
        .into_iter()
        .zip(selected_scores)
        .map(|(index, (score, redundancy))| {
            let mut candidate = candidates[index].clone();
            candidate.rerank_score = score;
            candidate.redundancy_score = redundancy;
            candidate
        })
        .collect();
    (hits, selected_near_duplicates)
}

fn maximum_fused_score(candidates: &[WorkspaceHybridSearchHit], exact: bool) -> f64 {
    candidates
        .iter()
        .filter(|candidate| candidate.exact_identifier == exact)
        .map(|candidate| candidate.fused_score)
        .filter(|score| score.is_finite() && *score > 0.0)
        .max_by(f64::total_cmp)
        .unwrap_or(1.0)
}

fn selection_score(
    candidate: &WorkspaceHybridSearchHit,
    maximum_fused_score: f64,
    redundancy: f64,
) -> f64 {
    let relevance = (candidate.fused_score / maximum_fused_score).clamp(0.0, 1.0);
    let agreement = (candidate.channels.len() as f64 / MAX_CHANNELS as f64).clamp(0.0, 1.0);
    let duplicate_penalty = if redundancy >= NEAR_DUPLICATE_THRESHOLD {
        NEAR_DUPLICATE_PENALTY * redundancy
    } else {
        0.0
    };
    RELEVANCE_WEIGHT * relevance
        + CHANNEL_AGREEMENT_WEIGHT * agreement
        + DIVERSITY_WEIGHT * (1.0 - redundancy)
        - duplicate_penalty
}

fn count_near_duplicates(
    candidates: &[WorkspaceHybridSearchHit],
    features: &[CandidateFeatures],
) -> usize {
    candidates
        .iter()
        .enumerate()
        .filter(|(index, candidate)| {
            (0..*index).any(|prior| {
                candidate_similarity(
                    candidate,
                    &features[*index],
                    &candidates[prior],
                    &features[prior],
                ) >= NEAR_DUPLICATE_THRESHOLD
            })
        })
        .count()
}

fn candidate_similarity(
    left: &WorkspaceHybridSearchHit,
    left_features: &CandidateFeatures,
    right: &WorkspaceHybridSearchHit,
    right_features: &CandidateFeatures,
) -> f64 {
    interval_overlap(left, right).max(fingerprint_jaccard(
        &left_features.fingerprints,
        &right_features.fingerprints,
    ))
}

fn interval_overlap(left: &WorkspaceHybridSearchHit, right: &WorkspaceHybridSearchHit) -> f64 {
    if left.chunk.path != right.chunk.path {
        return 0.0;
    }
    let intersection = left
        .chunk
        .end_byte
        .min(right.chunk.end_byte)
        .saturating_sub(left.chunk.start_byte.max(right.chunk.start_byte));
    let denominator = left
        .chunk
        .end_byte
        .saturating_sub(left.chunk.start_byte)
        .min(right.chunk.end_byte.saturating_sub(right.chunk.start_byte));
    if denominator == 0 {
        0.0
    } else {
        intersection as f64 / denominator as f64
    }
}

fn fingerprint_jaccard(left: &[u64], right: &[u64]) -> f64 {
    if left.is_empty() || right.is_empty() {
        return 0.0;
    }
    let mut left_index = 0usize;
    let mut right_index = 0usize;
    let mut intersection = 0usize;
    while left_index < left.len() && right_index < right.len() {
        match left[left_index].cmp(&right[right_index]) {
            Ordering::Less => left_index += 1,
            Ordering::Greater => right_index += 1,
            Ordering::Equal => {
                intersection += 1;
                left_index += 1;
                right_index += 1;
            }
        }
    }
    let union = left
        .len()
        .saturating_add(right.len())
        .saturating_sub(intersection);
    intersection as f64 / union as f64
}

/// Phase 4 noise penalty: path-classified down-weight for non-product
/// trees. An explicit path include in the query neutralizes the penalty
/// (fail-closed: the class guess never overrides a user's explicit ask).
pub(crate) const NOISE_PENALTY: f64 = 0.25;

pub(crate) fn noise_class(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    let segments: Vec<&str> = lower.split('/').collect();
    segments.iter().any(|segment| {
        matches!(
            *segment,
            "tests"
                | "test"
                | "examples"
                | "example"
                | "compat"
                | "fixtures"
                | "benches"
                | "benchmark"
        )
    }) || lower.ends_with(".d.ts")
        || lower.ends_with("_test.go")
        || lower.ends_with(".test.ts")
        || lower.ends_with(".test.tsx")
        || lower.ends_with(".spec.ts")
}

/// True when the query names the path or a path segment explicitly — the
/// neutralizer for the noise penalty.
pub(crate) fn query_names_path(query: &str, path: &str) -> bool {
    let needle = path.rsplit('/').next().unwrap_or(path);
    let stem = needle.split('.').next().unwrap_or(needle);
    stem.len() >= 3
        && query
            .to_ascii_lowercase()
            .contains(&stem.to_ascii_lowercase())
}

/// Apply the noise penalty to one hit's rerank score. A query that names
/// the file leaves the score untouched.
pub(crate) fn apply_noise_penalty(hit: &mut WorkspaceHybridSearchHit, query: &str) {
    if noise_class(&hit.chunk.path) && !query_names_path(query, &hit.chunk.path) {
        hit.rerank_score *= 1.0 - NOISE_PENALTY;
    }
}

#[cfg(test)]
mod phase4_tests {
    use super::*;
    use crate::workspace::retrieval::{WorkspaceChunk, WorkspaceChunkId};

    #[test]
    fn test_and_compat_paths_classify_as_noise() {
        assert!(noise_class("src/tests/unit.rs"));
        assert!(noise_class("examples/demo.ts"));
        assert!(noise_class("packages/compat/shim.js"));
        assert!(noise_class("src/types/global.d.ts"));
        assert!(!noise_class("src/main.rs"));
        assert!(!noise_class("src/lib.rs"));
    }

    #[test]
    fn a_query_naming_the_file_neutralizes_the_penalty() {
        assert!(query_names_path("how does demo work", "examples/demo.ts"));
        assert!(!query_names_path("parse the config", "examples/demo.ts"));
        // Short stems (e.g. "a.ts") never neutralize — too easy to match.
        assert!(!query_names_path("parse a file", "tests/a.rs"));
    }

    #[test]
    fn noise_hits_drop_a_quarter_unless_named() {
        let chunk = Arc::new(fixture_chunk("examples/demo.ts"));
        let mut noisy = WorkspaceHybridSearchHit {
            chunk: Arc::clone(&chunk),
            fused_score: 1.0,
            rerank_score: 1.0,
            redundancy_score: 0.0,
            exact_identifier: false,
            channels: Vec::new(),
        };
        apply_noise_penalty(&mut noisy, "unrelated query");
        assert!((noisy.rerank_score - 0.75).abs() < 1e-9);
        let mut named = WorkspaceHybridSearchHit {
            chunk,
            fused_score: 1.0,
            rerank_score: 1.0,
            redundancy_score: 0.0,
            exact_identifier: false,
            channels: Vec::new(),
        };
        apply_noise_penalty(&mut named, "how does demo work");
        assert!((named.rerank_score - 1.0).abs() < 1e-9);
    }

    fn fixture_chunk(path: &str) -> WorkspaceChunk {
        WorkspaceChunk {
            id: WorkspaceChunkId::new(format!("{path}:1")),
            path: Arc::from(path),
            language: Some(Arc::from("ts")),
            start_line: 1,
            end_line: 1,
            start_byte: 0,
            end_byte: 1,
            content_digest: Arc::from("d"),
            source_revision: 1,
            text: Arc::from("x"),
        }
    }
}

/// Phase 4 definition boost: a chunk whose text contains the definition of
/// the queried symbol (a `def`/`fn`/`struct`/`class` keyword adjacent to the
/// identifier) outranks chunks that merely reference it. The structural
/// channel's exact_identifier gate already segments symbol-like queries; this
/// prior refines within that tier.
pub(crate) const DEFINITION_BOOST: f64 = 0.15;

const DEFINITION_KEYWORDS: [&str; 10] = [
    "fn ",
    "func ",
    "def ",
    "struct ",
    "class ",
    "interface ",
    "type ",
    "enum ",
    "impl ",
    "const ",
];

/// True when the chunk text contains a definition-site pattern for the
/// identifier — a definition keyword immediately before it on the same line,
/// after zero or more common visibility/qualifier words.
pub(crate) fn defines_identifier(text: &str, identifier: &str) -> bool {
    if identifier.is_empty() {
        return false;
    }
    for line in text.lines() {
        let mut rest = line.trim_start();
        // Strip visibility/qualifier words repeatedly — "pub", "pub(crate)",
        // "async", "unsafe", "export", "public", "static", "final", ...
        loop {
            let stripped = QUALIFIER_WORDS.iter().find_map(|word| {
                rest.strip_prefix(word)
                    .filter(|tail| tail.starts_with(char::is_whitespace) || tail.starts_with('('))
                    .map(|tail| tail.trim_start_matches(|c: char| c.is_whitespace() || c == '('))
            });
            match stripped {
                Some(tail) => rest = tail,
                None => break,
            }
        }
        for keyword in DEFINITION_KEYWORDS {
            if let Some(after_kw) = rest.strip_prefix(keyword) {
                let rest = after_kw
                    .trim_start_matches(|c: char| c.is_whitespace() || c == ':' || c == '(');
                if rest.starts_with(identifier) {
                    let after = &rest[identifier.len()..];
                    if after.is_empty()
                        || after.starts_with(|c: char| !c.is_alphanumeric() && c != '_')
                    {
                        return true;
                    }
                }
            }
        }
    }
    false
}

const QUALIFIER_WORDS: [&str; 10] = [
    "pub",
    "pub(crate)",
    "pub(super)",
    "async",
    "unsafe",
    "extern",
    "static",
    "export",
    "public",
    "final",
];

/// Apply the definition boost to one hit. Only exact-identifier hits are
/// eligible — a fuzzy match never gets definition credit.
pub(crate) fn apply_definition_boost(hit: &mut WorkspaceHybridSearchHit, query: &str) {
    if hit.exact_identifier && defines_identifier(&hit.chunk.text, query) {
        hit.rerank_score += DEFINITION_BOOST;
    }
}

#[cfg(test)]
mod definition_boost_tests {
    use super::*;
    use crate::workspace::retrieval::{WorkspaceChunk, WorkspaceChunkId};

    #[test]
    fn definition_patterns_match_across_languages() {
        assert!(defines_identifier(
            "pub fn apply_boost(x: i32) {}",
            "apply_boost"
        ));
        assert!(defines_identifier("def apply_boost(self):", "apply_boost"));
        assert!(defines_identifier("struct Widget {", "Widget"));
        assert!(defines_identifier("class Foo::Bar", "Foo"));
        assert!(defines_identifier("interface Handler {", "Handler"));
        assert!(defines_identifier("  fn helper()", "helper"));
    }

    #[test]
    fn references_do_not_match() {
        assert!(!defines_identifier(
            "let result = apply_boost(1);",
            "apply_boost"
        ));
        assert!(!defines_identifier(
            "// TODO: call apply_boost later",
            "apply_boost"
        ));
        assert!(!defines_identifier("fn apply_boost_v2() {}", "apply_boost"));
        assert!(!defines_identifier("the widget struct is here", "Widget"));
    }

    #[test]
    fn only_exact_identifier_hits_get_the_boost() {
        let mut definition = fixture_hit("src/lib.rs", "fn target() {}", true);
        let mut reference = fixture_hit("src/call.rs", "target();", true);
        apply_definition_boost(&mut definition, "target");
        apply_definition_boost(&mut reference, "target");
        assert!((definition.rerank_score - 1.15).abs() < 1e-9);
        assert!((reference.rerank_score - 1.0).abs() < 1e-9);
    }

    fn fixture_hit(path: &str, text: &'static str, exact: bool) -> WorkspaceHybridSearchHit {
        WorkspaceHybridSearchHit {
            chunk: Arc::new(WorkspaceChunk {
                id: WorkspaceChunkId::new(format!("{path}:1")),
                path: Arc::from(path),
                language: Some(Arc::from("rs")),
                start_line: 1,
                end_line: 1,
                start_byte: 0,
                end_byte: text.len(),
                content_digest: Arc::from("d"),
                source_revision: 1,
                text: Arc::from(text),
            }),
            fused_score: 1.0,
            rerank_score: 1.0,
            redundancy_score: 0.0,
            exact_identifier: exact,
            channels: Vec::new(),
        }
    }
}

/// Phase 4 adaptive query weighting: symbol-like queries lean lexical,
/// natural-language queries lean semantic. The classifier picks between two
/// FIXED weight vectors — it never invents weights. Applied as a channel
/// multiplier on the rerank score, bounded by the existing compare_fused
/// ordering: exact_identifier still gates first.
pub(crate) const SYMBOL_LEAN: f64 = 1.25;
pub(crate) const NATURAL_LEAN: f64 = 1.15;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum QueryShape {
    Symbol,
    NaturalLanguage,
}

/// Classify the query shape. A single ASCII identifier (snake_case,
/// camelCase, PascalCase, or dotted path segment) is symbol-like;
/// anything with whitespace or multiple words is natural language.
pub(crate) fn classify_query(query: &str) -> QueryShape {
    let trimmed = query.trim();
    if trimmed.is_empty() || trimmed.contains(char::is_whitespace) {
        return QueryShape::NaturalLanguage;
    }
    let mut chars = trimmed.chars();
    let first_ok = chars
        .next()
        .is_some_and(|c| c == '_' || c == '.' || c.is_ascii_alphabetic());
    let rest_ok = trimmed
        .chars()
        .skip(1)
        .all(|c| c == '_' || c == '.' || c == ':' || c.is_ascii_alphanumeric());
    if first_ok && rest_ok {
        QueryShape::Symbol
    } else {
        QueryShape::NaturalLanguage
    }
}

/// Apply the lean to a channel multiplier. Symbol queries multiply the
/// lexical/structural channel bonus; natural queries multiply the semantic
/// channel bonus. Returns the multiplier for the given channel name.
pub(crate) fn channel_lean(shape: QueryShape, channel: &str) -> f64 {
    match (shape, channel) {
        (QueryShape::Symbol, "lexical") | (QueryShape::Symbol, "structural") => SYMBOL_LEAN,
        (QueryShape::NaturalLanguage, "semantic") => NATURAL_LEAN,
        _ => 1.0,
    }
}

#[cfg(test)]
mod adaptive_weighting_tests {
    use super::*;

    #[test]
    fn single_identifiers_are_symbol_queries() {
        assert_eq!(classify_query("apply_boost"), QueryShape::Symbol);
        assert_eq!(classify_query("Widget::new"), QueryShape::Symbol);
        assert_eq!(classify_query("_private"), QueryShape::Symbol);
        assert_eq!(classify_query("path.to::Thing"), QueryShape::Symbol);
    }

    #[test]
    fn sentences_and_mixed_are_natural() {
        assert_eq!(
            classify_query("how does rendering work"),
            QueryShape::NaturalLanguage
        );
        assert_eq!(classify_query("Widget new"), QueryShape::NaturalLanguage);
        assert_eq!(classify_query(""), QueryShape::NaturalLanguage);
        assert_eq!(classify_query("with spaces "), QueryShape::NaturalLanguage);
    }

    #[test]
    fn the_lean_picks_between_two_fixed_vectors() {
        assert!((channel_lean(QueryShape::Symbol, "lexical") - 1.25).abs() < 1e-9);
        assert!((channel_lean(QueryShape::Symbol, "structural") - 1.25).abs() < 1e-9);
        assert!((channel_lean(QueryShape::NaturalLanguage, "semantic") - 1.15).abs() < 1e-9);
        // Cross-shape and unlisted channels stay neutral — the classifier
        // never penalizes a channel it did not classify.
        assert!((channel_lean(QueryShape::Symbol, "semantic") - 1.0).abs() < 1e-9);
        assert!((channel_lean(QueryShape::NaturalLanguage, "lexical") - 1.0).abs() < 1e-9);
        assert!((channel_lean(QueryShape::Symbol, "exact") - 1.0).abs() < 1e-9);
    }
}
