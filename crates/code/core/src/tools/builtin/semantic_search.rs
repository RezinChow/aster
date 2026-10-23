//! Session-scoped semantic workspace search rendering.

use super::search_snippet::{bounded_results, source_snippet, SourceSnippet, MAX_OUTPUT_BYTES};
use crate::tools::types::{Tool, ToolCapabilities, ToolContext, ToolOutput};
use crate::workspace::{
    escape_control_chars_for_display, WorkspaceRetrievalError, WorkspaceSemanticFallbackReason,
    WorkspaceSemanticSearchHit, WorkspaceSemanticSearchRequest, WorkspaceSemanticSearchResult,
};
use anyhow::Result;
use async_trait::async_trait;
use std::collections::HashSet;

const DEFAULT_LIMIT: usize = 10;
const MAX_LIMIT: usize = 25;
const MAX_QUERY_BYTES: usize = 2_048;

pub(super) struct SemanticSearchTool;

#[async_trait]
impl Tool for SemanticSearchTool {
    fn name(&self) -> &str {
        "semantic"
    }

    fn description(&self) -> &str {
        "Rank verified workspace chunks by semantic similarity using the session-owned ephemeral index."
    }

    fn parameters(&self) -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "additionalProperties": false,
            "properties": {
                "query": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": MAX_QUERY_BYTES
                },
                "path": { "type": "string" },
                "include": { "type": "string" },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": MAX_LIMIT
                }
            },
            "required": ["query"]
        })
    }

    fn capabilities(&self, _args: &serde_json::Value) -> ToolCapabilities {
        ToolCapabilities::parallel_safe_read(2)
    }

    async fn execute(&self, args: &serde_json::Value, ctx: &ToolContext) -> Result<ToolOutput> {
        let query = match args.get("query").and_then(serde_json::Value::as_str) {
            Some(query) if !query.trim().is_empty() => query.trim(),
            _ => return Ok(ToolOutput::error("query parameter is required")),
        };
        if query.len() > MAX_QUERY_BYTES {
            return Ok(ToolOutput::error(format!(
                "query exceeds the {MAX_QUERY_BYTES}-byte limit"
            )));
        }
        let limit = match bounded_limit(args) {
            Ok(limit) => limit,
            Err(error) => return Ok(ToolOutput::error(error)),
        };
        let mut request = WorkspaceSemanticSearchRequest::new(query).with_limit(limit);
        if let Some(path) = args
            .get("path")
            .and_then(serde_json::Value::as_str)
            .filter(|path| !path.trim().is_empty())
        {
            request.path = Some(path.to_owned());
        }
        if let Some(include) = args
            .get("include")
            .and_then(serde_json::Value::as_str)
            .filter(|include| !include.trim().is_empty())
        {
            request.include = Some(include.to_owned());
        }

        match ctx
            .workspace_services
            .semantic_search(request, ctx.cancellation_token())
            .await
        {
            Ok(result) => Ok(render_result(result, query)),
            Err(WorkspaceRetrievalError::Cancelled) => {
                Ok(ToolOutput::error("semantic search was cancelled"))
            }
            Err(error) => Ok(ToolOutput::error(format!(
                "semantic search failed: {error}"
            ))),
        }
    }
}

fn bounded_limit(args: &serde_json::Value) -> std::result::Result<usize, String> {
    let Some(value) = args.get("limit") else {
        return Ok(DEFAULT_LIMIT);
    };
    let Some(value) = value.as_u64().and_then(|value| usize::try_from(value).ok()) else {
        return Err(format!("limit must be an integer from 1 to {MAX_LIMIT}"));
    };
    if !(1..=MAX_LIMIT).contains(&value) {
        return Err(format!("limit must be from 1 to {MAX_LIMIT}"));
    }
    Ok(value)
}

fn render_result(mut result: WorkspaceSemanticSearchResult, query: &str) -> ToolOutput {
    if result.hits.is_empty() {
        let mut content = "Semantic search returned no verified matches.".to_owned();
        if let Some(fallback) = result.fallback {
            content.push('\n');
            content.push_str(fallback_message(fallback));
        }
        return ToolOutput::success(content).with_metadata(result_metadata(&result, &[], false));
    }

    let mut snippets = result
        .hits
        .iter()
        .map(|hit| source_snippet(&hit.chunk, query))
        .collect::<Vec<_>>();
    let (mut content, count, budget_reached) = bounded_results(
        "Semantic results",
        result
            .hits
            .iter()
            .zip(&snippets)
            .enumerate()
            .map(|(rank, (hit, snippet))| render_hit(rank + 1, hit, snippet)),
    );
    result.hits.truncate(count);
    snippets.truncate(count);
    result.truncated |= budget_reached;
    content.push_str(&format!(
        "\n\n{} verified result(s); {} vector record(s) searched",
        result.hits.len(),
        result.searched_records
    ));
    if let Some(fallback) = result.fallback {
        content.push_str("\nWarning: ");
        content.push_str(fallback_message(fallback));
    }
    ToolOutput::success(content).with_metadata(result_metadata(&result, &snippets, budget_reached))
}

fn render_hit(rank: usize, hit: &WorkspaceSemanticSearchHit, snippet: &SourceSnippet) -> String {
    let chunk = &hit.chunk;
    let safe_path = escape_control_chars_for_display(chunk.path.as_ref());
    let mut content = format!(
        "{rank}. {safe_path}:{}-{} (score {:.4})",
        snippet.start_line, snippet.end_line, hit.score
    );
    content.push_str(&snippet.text);
    content
}

fn result_metadata(
    result: &WorkspaceSemanticSearchResult,
    snippets: &[SourceSnippet],
    budget_reached: bool,
) -> serde_json::Value {
    let mut seen_paths = HashSet::new();
    let source_anchors = result
        .hits
        .iter()
        .filter(|hit| seen_paths.insert(hit.chunk.path.to_string()))
        .map(|hit| hit.chunk.path.as_ref())
        .collect::<Vec<_>>();
    let results = result
        .hits
        .iter()
        .zip(snippets)
        .map(|(hit, snippet)| {
            serde_json::json!({
                "chunk_id": hit.chunk.id.as_str(),
                "path": hit.chunk.path.as_ref(),
                "start_line": snippet.start_line,
                "end_line": snippet.end_line,
                "chunk_start_line": hit.chunk.start_line,
                "chunk_end_line": hit.chunk.end_line,
                "snippet_truncated": snippet.truncated,
                "source_revision": hit.chunk.source_revision,
                "score": hit.score,
                "digest_verified": true,
            })
        })
        .collect::<Vec<_>>();
    serde_json::json!({
        "algorithm": "exact_cosine",
        "status": &result.status,
        "fallback": &result.fallback,
        "searched_records": result.searched_records,
        "truncated": result.truncated,
        "output_budget_reached": budget_reached,
        "output_byte_limit": MAX_OUTPUT_BYTES,
        "source_anchors": source_anchors,
        "results": results,
        "returned_results": results.len(),
    })
}

fn fallback_message(reason: WorkspaceSemanticFallbackReason) -> &'static str {
    match reason {
        WorkspaceSemanticFallbackReason::Building => {
            "the semantic index is still building; use bm25 or grep for complete coverage."
        }
        WorkspaceSemanticFallbackReason::Degraded => {
            "semantic coverage is degraded; use bm25 or grep to cover unindexed files."
        }
        WorkspaceSemanticFallbackReason::Closed => {
            "the session semantic index is closed; use bm25 or grep."
        }
        WorkspaceSemanticFallbackReason::QueryEmbeddingFailed => {
            "query embedding failed; use bm25 or grep."
        }
        WorkspaceSemanticFallbackReason::VectorSearchFailed => {
            "vector search failed; use bm25 or grep."
        }
        WorkspaceSemanticFallbackReason::RevisionChanged => {
            "the workspace changed during this query; retry or use bm25/grep."
        }
        WorkspaceSemanticFallbackReason::FilteredStaleHits => {
            "stale or unreadable candidates were removed; use bm25 or grep for full coverage."
        }
    }
}
