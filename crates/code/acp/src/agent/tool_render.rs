//! How a core tool call renders as an ACP tool call.

use super::*;

/// Map aster planning tasks onto ACP `PlanEntry` so the pager plan strip updates.
pub(super) fn task_to_plan_entry(task: &aster_core::planning::Task) -> acp::PlanEntry {
    use aster_core::planning::{TaskPriority, TaskStatus};
    let priority = match task.priority {
        TaskPriority::High => acp::PlanEntryPriority::High,
        TaskPriority::Medium => acp::PlanEntryPriority::Medium,
        TaskPriority::Low => acp::PlanEntryPriority::Low,
    };
    // Failed/Skipped/Cancelled collapse to Completed so the strip stays within ACP's status set.
    let status = match task.status {
        TaskStatus::Pending => acp::PlanEntryStatus::Pending,
        TaskStatus::InProgress => acp::PlanEntryStatus::InProgress,
        TaskStatus::Completed
        | TaskStatus::Failed
        | TaskStatus::Skipped
        | TaskStatus::Cancelled => acp::PlanEntryStatus::Completed,
    };
    let mut entry = acp::PlanEntry::new(task.content.clone(), priority, status);
    let mut meta = acp::Meta::new();
    meta.insert("id".into(), serde_json::Value::String(task.id.clone()));
    if matches!(
        task.status,
        TaskStatus::Failed | TaskStatus::Skipped | TaskStatus::Cancelled
    ) {
        meta.insert(
            "asterStatus".into(),
            serde_json::Value::String(task.status.to_string()),
        );
    }
    entry = entry.meta(Some(meta));
    entry
}

/// ACP `ToolKind` the pager uses to pick Execute / Read / Edit / Search / Fetch cards.
pub(super) fn tool_kind_for(name: &str) -> acp::ToolKind {
    match name {
        "bash" | "shell" | "execute" | "git" => acp::ToolKind::Execute,
        "read" | "office_read" => acp::ToolKind::Read,
        "write" | "edit" | "patch" | "office_file" => acp::ToolKind::Edit,
        "grep" | "glob" | "search" | "semantic" | "hybrid" | "bm25" | "code_symbols"
        | "code_navigation" | "code_diagnostics" | "web_search" | "search_wiki"
        | "search_memory" => acp::ToolKind::Search,
        "web_fetch" | "download" | "open_workspace_browser" => acp::ToolKind::Fetch,
        _ => acp::ToolKind::Other,
    }
}

pub(super) fn tool_title(name: &str) -> String {
    match name {
        "update_plan" => "Updating plan".to_string(),
        other => other.to_string(),
    }
}

/// Copy aster argument names onto the fields the pager card renderer reads.
pub(super) fn prepared_raw_input(
    name: &str,
    args: &serde_json::Value,
) -> Option<serde_json::Value> {
    if args.is_null() {
        return None;
    }
    // Identity tools: one clone, no object mutate.
    let needs_remap = matches!(
        name,
        "ls" | "write"
            | "update_plan"
            | "web_search"
            | "task"
            | "search"
            | "semantic"
            | "hybrid"
            | "bm25"
    );
    if !needs_remap {
        return Some(args.clone());
    }
    let mut input = args.clone();
    let Some(obj) = input.as_object_mut() else {
        return Some(input);
    };
    match name {
        "ls" => {
            if let Some(path) = obj.get("path").cloned() {
                obj.entry("target_directory".to_string()).or_insert(path);
            }
        }
        "write" => {
            obj.insert("variant".into(), serde_json::json!("Write"));
        }
        "update_plan" => {
            obj.insert("variant".into(), serde_json::json!("TodoWrite"));
        }
        "web_search" => {
            obj.insert("variant".into(), serde_json::json!("WebSearch"));
        }
        "task" => {
            obj.insert("variant".into(), serde_json::json!("Task"));
        }
        "search" | "semantic" | "hybrid" | "bm25" => {
            // A let-chain form needs Rust 2024; keep the guard pair flat.
            #[allow(clippy::collapsible_if, clippy::single_match)]
            match (obj.get("pattern").is_none(), obj.get("query").cloned()) {
                (true, Some(query)) => {
                    obj.insert("pattern".into(), query);
                }
                _ => {}
            }
        }
        _ => {}
    }
    Some(input)
}

pub(super) fn tool_call_content(
    name: &str,
    args: Option<&serde_json::Value>,
    output: &str,
) -> Vec<acp::ToolCallContent> {
    if let Some(diff) = edit_diff(name, args) {
        return vec![acp::ToolCallContent::from(diff)];
    }
    if output.is_empty() {
        return Vec::new();
    }
    vec![acp::ToolCallContent::from(acp::ContentBlock::Text(
        acp::TextContent::new(preview_text(output, 4_000)),
    ))]
}

/// Cap preview text to `max_chars` scalars. ASCII/short payloads skip the
/// char-walk when `s.len() ≤ max_chars` (byte len bounds char count).
pub(super) fn preview_text(s: &str, max_chars: usize) -> String {
    if s.len() <= max_chars {
        s.to_owned()
    } else {
        s.chars().take(max_chars).collect()
    }
}

/// Move short owned payloads; only truncate when over the char budget.
pub(super) fn preview_text_owned(s: String, max_chars: usize) -> String {
    if s.len() <= max_chars {
        s
    } else {
        s.chars().take(max_chars).collect()
    }
}

pub(super) fn edit_diff(name: &str, args: Option<&serde_json::Value>) -> Option<acp::Diff> {
    let args = args?;
    let path = args
        .get("file_path")
        .or_else(|| args.get("path"))
        .and_then(|v| v.as_str())?;
    match name {
        "edit" | "patch" => {
            // A batched `edit` carries its hunks in `edits`. The approval card still needs a
            // preview, so show every removed line against every added line of the batch.
            if let Some(edits) = args.get("edits").and_then(|value| value.as_array()) {
                let old_text = edits
                    .iter()
                    .filter_map(|edit| edit.get("old_string").and_then(|v| v.as_str()))
                    .collect::<Vec<_>>()
                    .join("\n");
                let new_text = edits
                    .iter()
                    .filter_map(|edit| edit.get("new_string").and_then(|v| v.as_str()))
                    .collect::<Vec<_>>()
                    .join("\n");
                return Some(acp::Diff::new(path, new_text).old_text(old_text));
            }
            let old_text = args.get("old_string").and_then(|v| v.as_str());
            let new_text = args
                .get("new_string")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let mut diff = acp::Diff::new(path, new_text);
            if let Some(old_text) = old_text {
                diff = diff.old_text(old_text.to_string());
            }
            Some(diff)
        }
        "write" => args
            .get("content")
            .and_then(|v| v.as_str())
            .map(|content| acp::Diff::new(path, content)),
        _ => None,
    }
}

/// Bash cards only show stdout when `raw_output` deserializes as `ToolOutput::Bash`.
/// Output fields are strings: a byte array costs a JSON number per byte.
/// Incremental stdout: pager appends `output_delta` (BashOutput defaults fill the rest).
pub(super) fn streaming_bash_delta(delta: &str) -> serde_json::Value {
    serde_json::json!({
        "type": "Bash",
        "total_bytes": delta.len(),
        "output_delta": delta,
    })
}

/// Structured publications survive the model-facing text budget.
pub(super) fn tool_publication_output(
    name: &str,
    metadata: Option<&serde_json::Value>,
    exit_code: i32,
) -> Option<serde_json::Value> {
    if name == "search_wiki" && exit_code == 0 {
        return metadata?
            .get("wiki_result")
            .filter(|value| value.is_object())
            .cloned();
    }
    if name != "office_file" || exit_code != 0 {
        return None;
    }
    let metadata = metadata?;
    if metadata.get("validated")?.as_bool()? != true
        || metadata.get("artifact_relative_path")?.as_str()?.is_empty()
    {
        return None;
    }
    let mut publication = serde_json::Map::new();
    for key in [
        "artifact_relative_path",
        "artifact_requested_path",
        "artifact_content_digest",
        "file_path",
        "files",
        "kind",
        "bytes",
        "validated",
    ] {
        if let Some(value) = metadata.get(key) {
            publication.insert(key.to_owned(), value.clone());
        }
    }
    Some(serde_json::Value::Object(publication))
}

pub(super) fn tool_raw_output(
    name: &str,
    args: Option<&serde_json::Value>,
    output: &str,
    exit_code: i32,
    metadata: Option<&serde_json::Value>,
) -> Option<serde_json::Value> {
    // P8: permission denials carry a stable code (not reason text alone).
    if let Some(coded) = permission_denial_raw(output, exit_code, metadata) {
        return Some(coded);
    }
    // Search cards use rawOutput for their expandable details. Keep the bounded
    // ACP content preview for other clients, but do not discard the actual result.
    if exit_code == 0
        && !output.is_empty()
        && matches!(
            name,
            "grep"
                | "web_search"
                | "search_wiki"
                | "search_memory"
                | "glob"
                | "search"
                | "semantic"
                | "hybrid"
                | "bm25"
                | "code_symbols"
                | "code_navigation"
                | "code_diagnostics"
        )
    {
        return Some(serde_json::Value::String(output.to_owned()));
    }
    if !matches!(name, "bash" | "shell" | "execute") {
        // P1-7: typed edit/patch failure codes ride metadata into ACP rawOutput.
        if let Some(coded) = edit_or_patch_failure_raw(name, output, exit_code, metadata) {
            return Some(coded);
        }
        // A failed Skill (and any other non-shell tool) keeps its error text.
        // An empty failure and a successful read stay without a raw payload.
        if exit_code != 0 && !output.is_empty() {
            return Some(serde_json::Value::String(output.to_owned()));
        }
        return None;
    }
    let command = args
        .and_then(|args| args.get("command"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    // E9: surface Core capture truncation / timeout into ACP rawOutput so hosts
    // do not read a hard-coded `truncated: false` as "complete output".
    let output_meta = metadata.and_then(|meta| meta.get("output"));
    let truncated = output_meta
        .and_then(|meta| meta.get("truncated"))
        .or_else(|| metadata.and_then(|meta| meta.get("truncated")))
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    let timed_out = output_meta
        .and_then(|meta| meta.get("timed_out"))
        .or_else(|| metadata.and_then(|meta| meta.get("timed_out")))
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    let total_bytes = output_meta
        .and_then(|meta| meta.get("total_bytes"))
        .and_then(|value| value.as_u64())
        .unwrap_or(output.len() as u64);
    let discarded_bytes = output_meta
        .and_then(|meta| meta.get("discarded_bytes"))
        .and_then(|value| value.as_u64())
        .unwrap_or_else(|| total_bytes.saturating_sub(output.len() as u64));
    // One owned output string, then clone the Value — avoids serde_json::json!
    // allocating the same stdout twice for output + output_for_prompt.
    let output_value = serde_json::Value::String(output.to_owned());
    let mut raw = serde_json::json!({
        "type": "Bash",
        "output": output_value.clone(),
        "output_for_prompt": output_value,
        "exit_code": exit_code,
        "command": command,
        "truncated": truncated,
        "signal": null,
        "timed_out": timed_out,
        "description": null,
        "current_dir": "",
        "output_file": "",
        "total_bytes": total_bytes,
        "discarded_bytes": discarded_bytes,
    });
    // P0-3: stable sandbox.violation.* codes ride tool metadata into ACP rawOutput
    // so hosts observe the same code Core recorded without parsing message text.
    if let Some(code) = metadata
        .and_then(|meta| meta.get("sandbox_violation"))
        .and_then(|violation| violation.get("code"))
        .filter(|code| code.is_string())
    {
        raw["sandbox_violation"] = serde_json::json!({ "code": code.clone() });
    }
    Some(raw)
}

/// Structured permission denial for hosts (stable `permission.denied`, not reason text).
fn permission_denial_raw(
    output: &str,
    exit_code: i32,
    metadata: Option<&serde_json::Value>,
) -> Option<serde_json::Value> {
    if exit_code == 0 {
        return None;
    }
    let code = metadata?.get("permission_denial")?.get("code")?.as_str()?;
    if code.is_empty() {
        return None;
    }
    Some(serde_json::json!({
        "type": "PermissionDenial",
        "output": output,
        "permission_denial": { "code": code },
    }))
}

/// Structured edit/patch failure for hosts (stable `*.code`, not message text).
fn edit_or_patch_failure_raw(
    name: &str,
    output: &str,
    exit_code: i32,
    metadata: Option<&serde_json::Value>,
) -> Option<serde_json::Value> {
    if exit_code == 0 {
        return None;
    }
    let metadata = metadata?;
    let (kind, key) = match name {
        "edit" | "str_replace" => ("Edit", "edit"),
        "patch" | "apply_patch" => ("Patch", "patch"),
        _ => return None,
    };
    let code = metadata.get(key)?.get("code")?.as_str()?;
    if code.is_empty() {
        return None;
    }
    let mut raw = serde_json::Map::new();
    raw.insert("type".into(), serde_json::Value::String(kind.into()));
    raw.insert("output".into(), serde_json::Value::String(output.into()));
    raw.insert(key.into(), serde_json::json!({ "code": code }));
    Some(serde_json::Value::Object(raw))
}

#[cfg(test)]
mod permission_denial_tests {
    use super::*;

    #[test]
    fn permission_denial_raw_output_carries_stable_code() {
        let meta = serde_json::json!({
            "permission_denial": { "code": "permission.denied" }
        });
        let raw = tool_raw_output(
            "write",
            Some(&serde_json::json!({"file_path": "x"})),
            "rejected via ACP request_permission",
            1,
            Some(&meta),
        )
        .expect("raw output");
        assert_eq!(raw["type"], "PermissionDenial");
        assert_eq!(raw["permission_denial"]["code"], "permission.denied");
        assert!(raw["output"].as_str().unwrap().contains("rejected"));
    }
}

#[cfg(test)]
mod plan_tests {
    use super::*;
    use aster_core::planning::{Task, TaskStatus};

    #[test]
    fn plan_entries_keep_identity_and_all_six_core_statuses() {
        for status in [
            TaskStatus::Pending,
            TaskStatus::InProgress,
            TaskStatus::Completed,
            TaskStatus::Failed,
            TaskStatus::Skipped,
            TaskStatus::Cancelled,
        ] {
            let task = Task::new("step-id", "Step title").with_status(status);
            let entry = task_to_plan_entry(&task);
            assert_eq!(entry.content, "Step title");
            assert_eq!(entry.meta.as_ref().unwrap()["id"], "step-id");
            let expected_acp = match status {
                TaskStatus::Pending => acp::PlanEntryStatus::Pending,
                TaskStatus::InProgress => acp::PlanEntryStatus::InProgress,
                _ => acp::PlanEntryStatus::Completed,
            };
            assert_eq!(entry.status, expected_acp);
            let terminal = entry.meta.as_ref().unwrap().get("asterStatus");
            if matches!(
                status,
                TaskStatus::Failed | TaskStatus::Skipped | TaskStatus::Cancelled
            ) {
                assert_eq!(terminal.unwrap(), status.to_string().as_str());
            } else {
                assert!(terminal.is_none());
            }
        }
    }
}
