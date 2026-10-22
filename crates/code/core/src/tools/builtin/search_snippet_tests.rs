#![cfg(test)]

use super::*;
use crate::workspace::{ChunkCatalogLimits, ChunkingConfig, WorkspaceChunkCatalog, WorkspacePath};
use std::sync::Arc;

fn chunk(text: &str) -> Arc<WorkspaceChunk> {
    let catalog = WorkspaceChunkCatalog::new_with_engine(
        ChunkingConfig::default(),
        ChunkCatalogLimits::default(),
        crate::workspace::WorkspaceLexicalEngine::Portable,
    )
    .unwrap();
    catalog
        .replace_file(
            &WorkspacePath::from_normalized("src/source.rs"),
            None,
            1,
            text,
        )
        .unwrap();
    catalog.snapshot().unwrap().chunks()[0].clone()
}

#[test]
fn late_match_is_visible_with_exact_display_anchors() {
    let mut lines = vec!["// unrelated prefix"; 79];
    lines[63] = "pub fn release_workspace_vectors() {}";
    let source = chunk(&lines.join("\n"));
    let snippet = source_snippet(&source, "release_workspace_vectors");
    assert!(snippet
        .text
        .contains("    64 | pub fn release_workspace_vectors() {}"));
    assert_eq!((snippet.start_line, snippet.end_line), (61, 76));
    assert!(!snippet.text.contains("     1 |"));
    assert!(snippet.truncated);
    assert_eq!((source.start_line, source.end_line), (1, 79));
}

#[test]
fn canonical_terms_and_cjk_rank_the_matching_line() {
    let mut lines = vec!["// unrelated"; 70];
    lines[55] = "// 关闭会话后释放临时向量";
    let snippet = source_snippet(&chunk(&lines.join("\n")), "释放 向量");
    assert!(snippet.text.contains("    56 | // 关闭会话后释放临时向量"));
}

#[test]
fn long_utf8_line_retains_the_case_insensitive_literal_and_escapes_controls() {
    let text = format!("{}LATE_MATCH\x1b[31m{}", "界".repeat(400), "尾".repeat(400));
    let snippet = source_snippet(&chunk(&text), "late_match");
    assert!(snippet.text.contains("LATE_MATCH"));
    assert!(!snippet.text.contains('\x1b'));
    assert!(snippet.text.len() < MAX_LINE_BYTES + 64);
    assert!(snippet.truncated);
    assert_eq!((snippet.start_line, snippet.end_line), (1, 1));
}

#[test]
fn no_lexical_overlap_preserves_the_semantic_chunk_prefix() {
    let snippet = source_snippet(&chunk("pub fn cleanup() {}\n"), "free session vectors");
    assert_eq!(snippet.text, "\n     1 | pub fn cleanup() {}");
    assert!(!snippet.truncated);
}

#[test]
fn total_response_budget_preserves_complete_results_and_names_truncation() {
    let results = (0..25).map(|index| format!("result-{index}\n{}", "界".repeat(2000)));
    let (text, count, truncated) = bounded_results("Hybrid results", results);
    assert!(truncated);
    assert_eq!(count, 4);
    assert!(text.len() <= MAX_OUTPUT_BYTES);
    assert!(text.contains("Output budget reached"));
    assert!(!text.contains("result-4"));
}
