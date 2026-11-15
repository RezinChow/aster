//! Expose only the presented Aster tools through Cursor's native MCP schema.

use super::super::types::{ContentBlock, ToolDefinition};
use anyhow::{anyhow, Result};
use serde_json::{json, Value};

const PROVIDER: &str = "aster";

#[derive(Debug, thiserror::Error)]
enum CallRejection {
    #[error("missing_tool_name")]
    MissingName,
    #[error("provider_mismatch")]
    ProviderMismatch,
    #[error("approval_only")]
    ApprovalOnly,
    #[error("server_mismatch")]
    ServerMismatch,
    #[error("tool_unavailable")]
    ToolUnavailable,
    #[error("arguments_not_object")]
    InvalidArguments,
}

fn reject(reason: CallRejection) -> anyhow::Error {
    tracing::warn!(%reason, "Cursor tool request rejected");
    anyhow!(super::super::NonRetryableLlmError::new(format!(
        "Cursor tool request rejected: {reason}"
    )))
}

pub(super) fn definitions(tools: &[ToolDefinition]) -> Vec<Value> {
    tools
        .iter()
        .map(|tool| {
            json!({
                "name": tool.name,
                "providerIdentifier": PROVIDER,
                "toolName": tool.name,
                "description": tool.description,
                "inputSchemaJson": tool.parameters.to_string(),
            })
        })
        .collect()
}

pub(super) fn state_reply(value: &Value, tools: &[ToolDefinition]) -> Result<Option<Vec<u8>>> {
    let Some(request) = request(value, "mcpStateExecArgs")? else {
        return Ok(None);
    };
    let Some(args) = request.get("mcpStateExecArgs") else {
        return Ok(None);
    };
    let invalid = || anyhow!("Cursor sent an invalid Aster tool catalog request");
    if !args.is_object()
        || args.get("serverIdentifiers").is_some_and(|servers| {
            servers.as_array().is_none_or(|servers| {
                servers
                    .iter()
                    .any(|server| server.as_str() != Some(PROVIDER))
            })
        })
    {
        return Err(invalid());
    }
    let id = match request.get("id") {
        None => 0,
        Some(value) => value
            .as_u64()
            .filter(|id| *id <= u32::MAX as u64)
            .ok_or_else(invalid)?,
    };
    let exec_id = match request.get("execId") {
        None => "",
        Some(value) => value
            .as_str()
            .filter(|id| id.len() <= 1024)
            .ok_or_else(invalid)?,
    };
    Ok(Some(serde_json::to_vec(&json!({"execClientMessage":{
        "id":id, "execId":exec_id,
        "mcpStateExecResult":{"success":{"servers":[{
            "serverName":PROVIDER, "serverIdentifier":PROVIDER, "tools":definitions(tools)
        }]}}
    }}))?))
}

pub(super) fn tool_call(value: &Value, tools: &[ToolDefinition]) -> Result<Option<ContentBlock>> {
    let Some(request) = request(value, "mcpArgs")? else {
        return Ok(None);
    };
    let args = &request["mcpArgs"];
    let name = args
        .get("toolName")
        .and_then(Value::as_str)
        .ok_or_else(|| reject(CallRejection::MissingName))?;
    if args.get("providerIdentifier").and_then(Value::as_str) != Some(PROVIDER) {
        return Err(reject(CallRejection::ProviderMismatch));
    }
    if args
        .get("smartModeApprovalOnly")
        .is_some_and(|approval| approval.as_bool() != Some(false))
    {
        return Err(reject(CallRejection::ApprovalOnly));
    }
    if args
        .get("serverIdentifier")
        .is_some_and(|server| server.as_str() != Some(PROVIDER))
    {
        return Err(reject(CallRejection::ServerMismatch));
    }
    let input = if !tools.iter().any(|tool| tool.name == name) {
        let reason = CallRejection::ToolUnavailable;
        let catalog: Vec<&str> = tools.iter().map(|tool| tool.name.as_str()).collect();
        tracing::warn!(
            %reason,
            requested_tool_chars = name.chars().count(),
            catalog = ?catalog,
            "Cursor tool request requires correction; tool was not executed"
        );
        // Identity and protocol are valid; feed a non-executing correction
        // through the existing __parse_error path. Do not alias onto a catalog name.
        json!({
            "__parse_error": format!(
                "{reason}: tool was not executed; choose an exact name from this turn's catalog ({})",
                catalog.join(", ")
            )
        })
    } else {
        match args.get("args") {
            None => json!({}),
            Some(input) if input.is_object() => input.clone(),
            _ => {
                let reason = CallRejection::InvalidArguments;
                tracing::warn!(%reason, "Cursor tool arguments require correction");
                // The existing parse guard returns an error result without executing the tool.
                json!({"__parse_error": reason.to_string()})
            }
        }
    };
    Ok(Some(ContentBlock::ToolUse {
        id: super::next_id(),
        name: name.to_string(),
        input,
    }))
}

fn request<'a>(value: &'a Value, field: &str) -> Result<Option<&'a Value>> {
    let Some(request) = value
        .get("execServerMessage")
        .filter(|request| request.get(field).is_some())
    else {
        return Ok(None);
    };
    if request.as_object().is_none_or(|request| {
        request.keys().any(|key| {
            key != field
                && !matches!(
                    key.as_str(),
                    "id" | "execId" | "machineId" | "spanContext" | "acceptHookAdditionalContexts"
                )
        })
    }) {
        return Err(anyhow!(super::super::NonRetryableLlmError::new(
            "Cursor sent an invalid Aster tool protocol request"
        )));
    }
    Ok(Some(request))
}

#[cfg(test)]
mod tests;
