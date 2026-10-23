//! Bounded source windows shared by ranked workspace search tools.

use crate::text::truncate_utf8;
use crate::workspace::retrieval::lexical::{query_terms, tokenize};
use crate::workspace::{escape_control_chars_for_display, WorkspaceChunk};
use regex::{Regex, RegexBuilder};
use std::cmp::Reverse;
use std::collections::HashSet;

const MAX_LINES: usize = 16;
const MAX_LINE_BYTES: usize = 500;
pub(super) const MAX_OUTPUT_BYTES: usize = 24 * 1024;

pub(super) struct SourceSnippet {
    pub text: String,
    pub start_line: usize,
    pub end_line: usize,
    pub truncated: bool,
}

pub(super) fn source_snippet(chunk: &WorkspaceChunk, query: &str) -> SourceSnippet {
    let terms = query_terms(query, 32);
    let term_set = terms.iter().map(String::as_str).collect::<HashSet<_>>();
    let literal = literal_pattern(&regex::escape(query));
    let term_pattern = literal_pattern(
        &terms
            .iter()
            .map(|term| regex::escape(term))
            .collect::<Vec<_>>()
            .join("|"),
    );
    let lines = chunk.text.lines().collect::<Vec<_>>();
    let best = lines
        .iter()
        .enumerate()
        .max_by_key(|(index, line)| {
            (
                literal
                    .as_ref()
                    .is_some_and(|pattern| pattern.is_match(line)),
                tokenize(line)
                    .iter()
                    .filter(|term| term_set.contains(term.as_str()))
                    .count(),
                Reverse(*index),
            )
        })
        .map_or(0, |(index, _)| index);
    let start = best
        .saturating_sub(3)
        .min(lines.len().saturating_sub(MAX_LINES));
    let end = (start + MAX_LINES).min(lines.len());
    let mut text = String::new();
    let mut truncated = start > 0 || end < lines.len();
    if start > 0 {
        text.push_str("\n       | ...");
    }
    for (offset, line) in lines[start..end].iter().enumerate() {
        let matched = literal
            .as_ref()
            .and_then(|pattern| pattern.find(line))
            .or_else(|| term_pattern.as_ref().and_then(|pattern| pattern.find(line)));
        let mut byte_start = matched.map_or(0, |matched| {
            matched.start().saturating_sub(MAX_LINE_BYTES / 4)
        });
        while byte_start > 0 && !line.is_char_boundary(byte_start) {
            byte_start -= 1;
        }
        // Escape only after choosing source offsets; display escapes change byte lengths.
        let safe = escape_control_chars_for_display(&line[byte_start..]);
        let rendered = truncate_utf8(&safe, MAX_LINE_BYTES);
        let suffix = rendered.len() < safe.len();
        truncated |= byte_start > 0 || suffix;
        text.push_str(&format!(
            "\n{:>6} | {}{rendered}{}",
            chunk.start_line.saturating_add(start + offset),
            if byte_start > 0 { "..." } else { "" },
            if suffix { "..." } else { "" },
        ));
    }
    if end < lines.len() {
        text.push_str("\n       | ...");
    }
    SourceSnippet {
        text,
        start_line: chunk.start_line.saturating_add(start),
        end_line: chunk.start_line.saturating_add(end.saturating_sub(1)),
        truncated,
    }
}

fn literal_pattern(pattern: &str) -> Option<Regex> {
    if pattern.is_empty() {
        return None;
    }
    RegexBuilder::new(pattern)
        .case_insensitive(true)
        .build()
        .ok()
}

pub(super) fn bounded_results(
    title: &str,
    results: impl IntoIterator<Item = String>,
) -> (String, usize, bool) {
    let mut content = format!("{title}\n\n");
    let mut count = 0;
    for result in results {
        // Reserve bounded space for the count and channel-fallback footer.
        if content
            .len()
            .saturating_add(result.len())
            .saturating_add(512)
            > MAX_OUTPUT_BYTES
        {
            content.push_str(
                "\nOutput budget reached; narrow the query or path for remaining results.\n",
            );
            return (content, count, true);
        }
        if count > 0 {
            content.push_str("\n\n");
        }
        content.push_str(&result);
        count += 1;
    }
    (content, count, false)
}

#[cfg(test)]
#[path = "search_snippet_tests.rs"]
mod tests;
