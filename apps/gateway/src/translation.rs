//! OpenAI ↔ Anthropic chat request translation (PT0/PT1).
//!
//! Pure value-to-value translation over the frozen corpus in
//! `tests/fixtures/translation/`; the loss ledger
//! (`docs/translation-loss-ledger.md`) names every field that cannot
//! survive. Unknown shapes refuse with a stable error naming the field —
//! a partially translated body is never returned. Published as library
//! API for embedded hosts; managed dispatch wiring lands with PT1.

use serde_json::{Map, Value};

/// Translation refusal. The message names the offending field so callers
/// can surface a stable error instead of a partial body.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranslationError(pub String);

impl TranslationError {
    pub fn field(field: &str, reason: &str) -> Self {
        Self(format!("cannot translate {field}: {reason}"))
    }
}

pub type TranslationResult = Result<Value, TranslationError>;

/// Translate an OpenAI chat-completions request body into an Anthropic
/// messages request body.
pub fn openai_request_to_anthropic(request: &Value) -> TranslationResult {
    let object = request.as_object().ok_or_else(|| {
        TranslationError::field("request", "the OpenAI request must be a JSON object")
    })?;
    let mut out = Map::new();

    if let Some(model) = object.get("model") {
        out.insert("model".into(), model.clone());
    }
    let max_tokens = object.get("max_tokens").cloned().unwrap_or_else(|| {
        // The Anthropic dialect requires a completion bound; pin the same
        // fail-closed default the gateway's reservation estimator uses.
        Value::from(1_024_u64)
    });
    out.insert("max_tokens".into(), max_tokens);
    for field in ["temperature", "top_p"] {
        if let Some(value) = object.get(field) {
            out.insert(field.into(), value.clone());
        }
    }
    if object.get("stream") == Some(&Value::Bool(true)) {
        out.insert("stream".into(), Value::Bool(true));
    }
    if let Some(stop) = object.get("stop") {
        let sequences = match stop {
            Value::String(single) => vec![Value::String(single.clone())],
            Value::Array(list) => list.clone(),
            other => {
                return Err(TranslationError::field(
                    "stop",
                    &format!("expected a string or a list, got {other}"),
                ))
            }
        };
        out.insert("stop_sequences".into(), Value::Array(sequences));
    }

    let mut messages: &[Value] = object
        .get("messages")
        .and_then(Value::as_array)
        .ok_or_else(|| TranslationError::field("messages", "required and must be a list"))?;
    // Leading OpenAI system messages hoist into the top-level system field.
    let mut system = Vec::new();
    let mut cursor = 0;
    while let Some(message) = messages.get(cursor) {
        if message.get("role") == Some(&Value::String("system".into())) {
            system.push(string_content(message, "system")?);
            cursor += 1;
        } else {
            break;
        }
    }
    if !system.is_empty() {
        out.insert("system".into(), Value::String(system.join("\n\n")));
    }
    messages = &messages[cursor..];
    if messages.is_empty() {
        return Err(TranslationError::field(
            "messages",
            "no non-system messages remain to translate",
        ));
    }
    out.insert(
        "messages".into(),
        Value::Array(openai_messages_to_anthropic(messages)?),
    );

    if let Some(tools) = object.get("tools") {
        out.insert("tools".into(), openai_tools_to_anthropic(tools)?);
    }
    if let Some(choice) = object.get("tool_choice") {
        out.insert(
            "tool_choice".into(),
            openai_tool_choice_to_anthropic(choice)?,
        );
    }
    Ok(Value::Object(out))
}

/// Translate an Anthropic messages request body into an OpenAI
/// chat-completions request body.
pub fn anthropic_request_to_openai(request: &Value) -> TranslationResult {
    let object = request.as_object().ok_or_else(|| {
        TranslationError::field("request", "the Anthropic request must be a JSON object")
    })?;
    let mut out = Map::new();

    if let Some(model) = object.get("model") {
        out.insert("model".into(), model.clone());
    }
    if let Some(max_tokens) = object.get("max_tokens") {
        out.insert("max_tokens".into(), max_tokens.clone());
    }
    for field in ["temperature", "top_p"] {
        if let Some(value) = object.get(field) {
            out.insert(field.into(), value.clone());
        }
    }
    if let Some(sequences) = object.get("stop_sequences").and_then(Value::as_array) {
        out.insert("stop".into(), Value::Array(sequences.clone()));
    }
    if object.get("stream") == Some(&Value::Bool(true)) {
        out.insert("stream".into(), Value::Bool(true));
    }

    let messages = object
        .get("messages")
        .and_then(Value::as_array)
        .ok_or_else(|| TranslationError::field("messages", "required and must be a list"))?;
    let mut openai_messages = Vec::new();
    if let Some(system) = object.get("system") {
        let text = system.as_str().ok_or_else(|| {
            TranslationError::field("system", "expected a string when translating back")
        })?;
        openai_messages.push(serde_json::json!({ "role": "system", "content": text }));
    }
    openai_messages.extend(anthropic_messages_to_openai(messages)?);
    if openai_messages.is_empty() {
        return Err(TranslationError::field(
            "messages",
            "no messages remain to translate",
        ));
    }
    out.insert("messages".into(), Value::Array(openai_messages));

    if let Some(tools) = object.get("tools") {
        out.insert("tools".into(), anthropic_tools_to_openai(tools)?);
    }
    if let Some(choice) = object.get("tool_choice") {
        out.insert(
            "tool_choice".into(),
            anthropic_tool_choice_to_openai(choice)?,
        );
    }
    Ok(Value::Object(out))
}

fn string_content(message: &Value, role: &str) -> Result<String, TranslationError> {
    match message.get("content") {
        Some(Value::String(text)) => Ok(text.clone()),
        Some(Value::Array(_)) => Err(TranslationError::field(
            &format!("{role} message content"),
            "structured content cannot hoist into a string field",
        )),
        Some(other) => Err(TranslationError::field(
            &format!("{role} message content"),
            &format!("expected a string, got {other}"),
        )),
        None => Err(TranslationError::field(
            &format!("{role} message content"),
            "required",
        )),
    }
}

fn openai_messages_to_anthropic(messages: &[Value]) -> Result<Vec<Value>, TranslationError> {
    let mut out = Vec::with_capacity(messages.len());
    for message in messages {
        let role = message
            .get("role")
            .and_then(Value::as_str)
            .ok_or_else(|| TranslationError::field("message.role", "required"))?;
        match role {
            "user" => out.push(serde_json::json!({
                "role": "user",
                "content": openai_content_to_anthropic(message.get("content"))?,
            })),
            "assistant" => out.push(serde_json::json!({
                "role": "assistant",
                "content": openai_assistant_content_to_anthropic(message)?,
            })),
            "tool" => {
                // An OpenAI tool turn becomes a user tool_result block. A
                // standalone tool turn (without a preceding tool_call) is a
                // broken chain and refuses.
                let tool_call_id = message
                    .get("tool_call_id")
                    .and_then(Value::as_str)
                    .ok_or_else(|| {
                        TranslationError::field("tool message.tool_call_id", "required")
                    })?;
                let last = out.last().ok_or_else(|| {
                    TranslationError::field(
                        "tool message",
                        "a tool turn must follow its assistant tool_call turn",
                    )
                })?;
                let has_matching_call = last["content"]
                    .as_array()
                    .is_some_and(|blocks| {
                        blocks.iter().any(|block| {
                            block["type"] == "tool_use" && block["id"] == tool_call_id
                        })
                    });
                if !has_matching_call {
                    return Err(TranslationError::field(
                        "tool message",
                        "no preceding assistant tool_call matches tool_call_id",
                    ));
                }
                out.push(serde_json::json!({
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": tool_call_id,
                        "content": string_content(message, "tool")?,
                    }],
                }));
            }
            "system" => {
                return Err(TranslationError::field(
                    "message.role",
                    "a system message after the conversation start cannot hoist; only leading system messages translate",
                ))
            }
            other => {
                return Err(TranslationError::field(
                    "message.role",
                    &format!("'{other}' is not one of user, assistant, tool, system"),
                ))
            }
        }
    }
    Ok(out)
}

fn anthropic_messages_to_openai(messages: &[Value]) -> Result<Vec<Value>, TranslationError> {
    let mut out = Vec::with_capacity(messages.len());
    for message in messages {
        let role = message
            .get("role")
            .and_then(Value::as_str)
            .ok_or_else(|| TranslationError::field("message.role", "required"))?;
        if role != "user" && role != "assistant" {
            return Err(TranslationError::field(
                "message.role",
                &format!("'{role}' is not one of user, assistant"),
            ));
        }
        let blocks = match message.get("content") {
            // Anthropic also accepts a bare string as one text block.
            Some(Value::String(text)) => {
                vec![serde_json::json!({ "type": "text", "text": text })]
            }
            Some(Value::Array(blocks)) => blocks.clone(),
            _ => {
                return Err(TranslationError::field(
                    "message.content",
                    "required as a block list or a text string",
                ))
            }
        };
        let mut text_parts = Vec::new();
        let mut image_parts = Vec::new();
        let mut tool_calls = Vec::new();
        let mut tool_results = Vec::new();
        for block in blocks {
            let block_type = block
                .get("type")
                .and_then(Value::as_str)
                .ok_or_else(|| TranslationError::field("content.type", "required"))?;
            match block_type {
                "text" => {
                    text_parts.push(
                        block
                            .get("text")
                            .and_then(Value::as_str)
                            .ok_or_else(|| TranslationError::field("text block.text", "required"))?
                            .to_string(),
                    );
                }
                "tool_use" => {
                    let input = block
                        .get("input")
                        .ok_or_else(|| TranslationError::field("tool_use.input", "required"))?;
                    if !input.is_object() {
                        return Err(TranslationError::field(
                            "tool_use.input",
                            "must be a JSON object",
                        ));
                    }
                    tool_calls.push(serde_json::json!({
                        "id": block.get("id").cloned().unwrap_or(Value::Null),
                        "type": "function",
                        "function": {
                            "name": block.get("name").cloned().unwrap_or(Value::Null),
                            "arguments": serde_json::to_string(input)
                                .map_err(|_| TranslationError::field("tool_use.input", "not serializable"))?,
                        },
                    }));
                }
                "tool_result" => {
                    tool_results.push(block.clone());
                }
                "image" => {
                    let source = block
                        .get("source")
                        .ok_or_else(|| TranslationError::field("image.source", "required"))?;
                    if source.get("type") != Some(&Value::String("base64".into())) {
                        return Err(TranslationError::field(
                            "image.source.type",
                            "only base64 sources translate",
                        ));
                    }
                    let media_type = source
                        .get("media_type")
                        .and_then(Value::as_str)
                        .unwrap_or("application/octet-stream");
                    let data = source
                        .get("data")
                        .and_then(Value::as_str)
                        .ok_or_else(|| TranslationError::field("image.source.data", "required"))?;
                    image_parts.push(serde_json::json!({
                        "type": "image_url",
                        "image_url": {
                            "url": format!("data:{media_type};base64,{data}"),
                        },
                    }));
                }
                other => {
                    return Err(TranslationError::field(
                        "content.type",
                        &format!("'{other}' is not one of text, tool_use, tool_result, image"),
                    ))
                }
            }
        }
        if !tool_calls.is_empty() {
            if !tool_results.is_empty() {
                return Err(TranslationError::field(
                    "message.content",
                    "tool_use and tool_result blocks cannot share one message",
                ));
            }
            if !image_parts.is_empty() {
                return Err(TranslationError::field(
                    "message.content",
                    "assistant tool_use messages cannot also carry images",
                ));
            }
            out.push(serde_json::json!({
                "role": "assistant",
                "content": if text_parts.is_empty() {
                    Value::Null
                } else {
                    Value::String(text_parts.join(""))
                },
                "tool_calls": tool_calls,
            }));
        } else if !tool_results.is_empty() {
            if role != "user" {
                return Err(TranslationError::field(
                    "message.role",
                    "tool_result blocks only translate from user messages",
                ));
            }
            for block in tool_results {
                let content = match block.get("content") {
                    Some(Value::String(text)) => text.clone(),
                    None => String::new(),
                    Some(other) => {
                        return Err(TranslationError::field(
                            "tool_result.content",
                            &format!("expected a string, got {other}"),
                        ))
                    }
                };
                out.push(serde_json::json!({
                    "role": "tool",
                    "tool_call_id": block.get("tool_use_id").cloned().unwrap_or(Value::Null),
                    "content": content,
                }));
            }
            if !text_parts.is_empty() {
                out.push(serde_json::json!({
                    "role": "user",
                    "content": text_parts.join(""),
                }));
            }
        } else if !image_parts.is_empty() {
            let mut content = Vec::new();
            if !text_parts.is_empty() {
                content.push(serde_json::json!({
                    "type": "text",
                    "text": text_parts.join(""),
                }));
            }
            content.extend(image_parts);
            out.push(serde_json::json!({
                "role": role,
                "content": content,
            }));
        } else {
            out.push(serde_json::json!({
                "role": role,
                "content": text_parts.join(""),
            }));
        }
    }
    Ok(out)
}

fn openai_content_to_anthropic(content: Option<&Value>) -> TranslationResult {
    let Some(content) = content else {
        return Err(TranslationError::field("user message.content", "required"));
    };
    match content {
        Value::String(text) => Ok(Value::Array(vec![serde_json::json!({
            "type": "text",
            "text": text,
        })])),
        Value::Array(parts) => {
            let mut blocks = Vec::with_capacity(parts.len());
            for part in parts {
                let part_type = part
                    .get("type")
                    .and_then(Value::as_str)
                    .ok_or_else(|| TranslationError::field("content part.type", "required"))?;
                match part_type {
                    "text" => blocks.push(serde_json::json!({
                        "type": "text",
                        "text": part.get("text").cloned().unwrap_or(Value::Null),
                    })),
                    "image_url" => {
                        let url = part
                            .get("image_url")
                            .and_then(|image| image.get("url"))
                            .and_then(Value::as_str)
                            .ok_or_else(|| {
                                TranslationError::field("image_url.url", "required for image parts")
                            })?;
                        let Some((media_type, data)) = url
                            .strip_prefix("data:")
                            .and_then(|rest| rest.split_once(","))
                        else {
                            return Err(TranslationError::field(
                                "image_url.url",
                                "only base64 data URLs translate",
                            ));
                        };
                        let media_type =
                            media_type.split(';').next().unwrap_or_default().to_string();
                        blocks.push(serde_json::json!({
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": data,
                            },
                        }));
                    }
                    other => {
                        return Err(TranslationError::field(
                            "content part.type",
                            &format!("'{other}' is not one of text, image_url"),
                        ))
                    }
                }
            }
            Ok(Value::Array(blocks))
        }
        other => Err(TranslationError::field(
            "user message.content",
            &format!("expected a string or a part list, got {other}"),
        )),
    }
}

fn openai_assistant_content_to_anthropic(message: &Value) -> TranslationResult {
    let text = message.get("content").and_then(Value::as_str);
    let tool_calls = message.get("tool_calls").and_then(Value::as_array);
    let mut blocks = Vec::new();
    if let Some(text) = text {
        blocks.push(serde_json::json!({ "type": "text", "text": text }));
    }
    if let Some(tool_calls) = tool_calls {
        for call in tool_calls {
            let function = call
                .get("function")
                .ok_or_else(|| TranslationError::field("tool_calls.function", "required"))?;
            let arguments = function
                .get("arguments")
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    TranslationError::field("tool_calls.function.arguments", "required")
                })?;
            let input: Value = serde_json::from_str(arguments).map_err(|_| {
                TranslationError::field(
                    "tool_calls.function.arguments",
                    "must be a JSON object encoded as a string",
                )
            })?;
            if !input.is_object() {
                return Err(TranslationError::field(
                    "tool_calls.function.arguments",
                    "must encode a JSON object",
                ));
            }
            blocks.push(serde_json::json!({
                "type": "tool_use",
                "id": call.get("id").cloned().unwrap_or(Value::Null),
                "name": function.get("name").cloned().unwrap_or(Value::Null),
                "input": input,
            }));
        }
    }
    if blocks.is_empty() {
        return Err(TranslationError::field(
            "assistant message",
            "content or tool_calls is required",
        ));
    }
    Ok(Value::Array(blocks))
}

fn openai_tools_to_anthropic(tools: &Value) -> TranslationResult {
    let list = tools
        .as_array()
        .ok_or_else(|| TranslationError::field("tools", "required and must be a list"))?;
    let mut out = Vec::with_capacity(list.len());
    for tool in list {
        let function = tool
            .get("function")
            .ok_or_else(|| TranslationError::field("tools.function", "required"))?;
        out.push(serde_json::json!({
            "name": function.get("name").cloned().unwrap_or(Value::Null),
            "description": function.get("description").cloned().unwrap_or(Value::Null),
            "input_schema": function.get("parameters").cloned().unwrap_or(Value::Null),
        }));
    }
    Ok(Value::Array(out))
}

fn anthropic_tools_to_openai(tools: &Value) -> TranslationResult {
    let list = tools
        .as_array()
        .ok_or_else(|| TranslationError::field("tools", "required and must be a list"))?;
    let mut out = Vec::with_capacity(list.len());
    for tool in list {
        out.push(serde_json::json!({
            "type": "function",
            "function": {
                "name": tool.get("name").cloned().unwrap_or(Value::Null),
                "description": tool.get("description").cloned().unwrap_or(Value::Null),
                "parameters": tool.get("input_schema").cloned().unwrap_or(Value::Null),
            },
        }));
    }
    Ok(Value::Array(out))
}

fn openai_tool_choice_to_anthropic(choice: &Value) -> TranslationResult {
    match choice {
        Value::String(mode) => match mode.as_str() {
            "auto" | "none" => Ok(serde_json::json!({ "type": mode })),
            "required" => Ok(serde_json::json!({ "type": "any" })),
            other => Err(TranslationError::field(
                "tool_choice",
                &format!("'{other}' is not one of auto, none, required"),
            )),
        },
        Value::Object(object) => {
            let function = object.get("function").ok_or_else(|| {
                TranslationError::field("tool_choice.function", "required for named choices")
            })?;
            Ok(serde_json::json!({
                "type": "tool",
                "name": function.get("name").cloned().unwrap_or(Value::Null),
            }))
        }
        other => Err(TranslationError::field(
            "tool_choice",
            &format!("expected a string or an object, got {other}"),
        )),
    }
}

fn anthropic_tool_choice_to_openai(choice: &Value) -> TranslationResult {
    let choice_type = choice
        .get("type")
        .and_then(Value::as_str)
        .ok_or_else(|| TranslationError::field("tool_choice.type", "required"))?;
    match choice_type {
        "auto" | "none" => Ok(Value::String(choice_type.into())),
        "any" => Ok(Value::String("required".into())),
        "tool" => Ok(serde_json::json!({
            "type": "function",
            "function": { "name": choice.get("name").cloned().unwrap_or(Value::Null) },
        })),
        other => Err(TranslationError::field(
            "tool_choice.type",
            &format!("'{other}' is not one of auto, none, any, tool"),
        )),
    }
}

#[cfg(test)]
#[path = "translation_contract_tests.rs"]
mod contract_tests;

/// Translate an Anthropic message response into an OpenAI chat-completion
/// response. `created_unix` is supplied by the caller — a pure function
/// never invents time.
pub fn anthropic_response_to_openai(response: &Value, created_unix: i64) -> TranslationResult {
    let object = response.as_object().ok_or_else(|| {
        TranslationError::field("response", "the Anthropic response must be a JSON object")
    })?;
    let mut message = Map::new();
    if let Some(id) = object.get("id") {
        message.insert("id".into(), id.clone());
    }
    message.insert("object".into(), Value::String("chat.completion".into()));
    message.insert("created".into(), Value::from(created_unix));
    if let Some(model) = object.get("model") {
        message.insert("model".into(), model.clone());
    }

    let content = object
        .get("content")
        .and_then(Value::as_array)
        .ok_or_else(|| TranslationError::field("content", "required and must be a block list"))?;
    let mut text_parts = Vec::new();
    let mut tool_calls = Vec::new();
    for block in content {
        let block_type = block
            .get("type")
            .and_then(Value::as_str)
            .ok_or_else(|| TranslationError::field("content.type", "required"))?;
        match block_type {
            "text" => text_parts.push(
                block
                    .get("text")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
            ),
            "tool_use" => {
                let input = block
                    .get("input")
                    .cloned()
                    .unwrap_or_else(|| Value::Object(Default::default()));
                if !input.is_object() {
                    return Err(TranslationError::field(
                        "tool_use.input",
                        "must be a JSON object",
                    ));
                }
                tool_calls.push(serde_json::json!({
                    "id": block.get("id").cloned().unwrap_or(Value::Null),
                    "type": "function",
                    "function": {
                        "name": block.get("name").cloned().unwrap_or(Value::Null),
                        "arguments": serde_json::to_string(&input).map_err(|_| {
                            TranslationError::field("tool_use.input", "not serializable")
                        })?,
                    },
                }));
            }
            other => {
                return Err(TranslationError::field(
                    "content.type",
                    &format!("'{other}' is not one of text, tool_use"),
                ))
            }
        }
    }
    let finish_reason =
        anthropic_stop_reason_to_openai(object.get("stop_reason").and_then(Value::as_str))?;
    let mut assistant = Map::new();
    assistant.insert("role".into(), Value::String("assistant".into()));
    assistant.insert(
        "content".into(),
        if text_parts.is_empty() && !tool_calls.is_empty() {
            Value::Null
        } else {
            Value::String(text_parts.join(""))
        },
    );
    if !tool_calls.is_empty() {
        assistant.insert("tool_calls".into(), Value::Array(tool_calls));
    }
    message.insert(
        "choices".into(),
        Value::Array(vec![serde_json::json!({
            "index": 0,
            "message": Value::Object(assistant),
            "finish_reason": finish_reason,
        })]),
    );
    if let Some(usage) = object.get("usage") {
        message.insert("usage".into(), anthropic_usage_to_openai(usage)?);
    }
    Ok(Value::Object(message))
}

/// Translate an OpenAI chat-completion response into an Anthropic message
/// response.
pub fn openai_response_to_anthropic(response: &Value) -> TranslationResult {
    let object = response.as_object().ok_or_else(|| {
        TranslationError::field("response", "the OpenAI response must be a JSON object")
    })?;
    let choice = object
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .ok_or_else(|| TranslationError::field("choices", "required and must be non-empty"))?;
    let message_body = choice
        .get("message")
        .ok_or_else(|| TranslationError::field("choices.message", "required"))?;

    let mut out = Map::new();
    if let Some(id) = object.get("id") {
        out.insert("id".into(), id.clone());
    }
    out.insert("type".into(), Value::String("message".into()));
    out.insert("role".into(), Value::String("assistant".into()));
    if let Some(model) = object.get("model") {
        out.insert("model".into(), model.clone());
    }

    let mut blocks = Vec::new();
    if let Some(text) = message_body.get("content").and_then(Value::as_str) {
        if !text.is_empty() {
            blocks.push(serde_json::json!({ "type": "text", "text": text }));
        }
    }
    if let Some(calls) = message_body.get("tool_calls").and_then(Value::as_array) {
        for call in calls {
            let function = call
                .get("function")
                .ok_or_else(|| TranslationError::field("tool_calls.function", "required"))?;
            let arguments = function
                .get("arguments")
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    TranslationError::field("tool_calls.function.arguments", "required")
                })?;
            let input: Value = serde_json::from_str(arguments).map_err(|_| {
                TranslationError::field(
                    "tool_calls.function.arguments",
                    "must be a JSON object encoded as a string",
                )
            })?;
            if !input.is_object() {
                return Err(TranslationError::field(
                    "tool_calls.function.arguments",
                    "must encode a JSON object",
                ));
            }
            blocks.push(serde_json::json!({
                "type": "tool_use",
                "id": call.get("id").cloned().unwrap_or(Value::Null),
                "name": function.get("name").cloned().unwrap_or(Value::Null),
                "input": input,
            }));
        }
    }
    if blocks.is_empty() {
        return Err(TranslationError::field(
            "choices.message",
            "content or tool_calls is required",
        ));
    }
    out.insert("content".into(), Value::Array(blocks));
    out.insert(
        "stop_reason".into(),
        openai_finish_reason_to_anthropic(choice.get("finish_reason").and_then(Value::as_str))?,
    );
    if let Some(usage) = object.get("usage") {
        out.insert("usage".into(), openai_usage_to_anthropic(usage)?);
    }
    Ok(Value::Object(out))
}

fn anthropic_stop_reason_to_openai(reason: Option<&str>) -> TranslationResult {
    let reason = reason.ok_or_else(|| TranslationError::field("stop_reason", "required"))?;
    match reason {
        "end_turn" | "stop_sequence" => Ok(Value::String("stop".into())),
        "tool_use" => Ok(Value::String("tool_calls".into())),
        "max_tokens" => Ok(Value::String("length".into())),
        other => Err(TranslationError::field(
            "stop_reason",
            &format!("'{other}' is not one of end_turn, stop_sequence, tool_use, max_tokens"),
        )),
    }
}

fn openai_finish_reason_to_anthropic(reason: Option<&str>) -> TranslationResult {
    let reason = reason.ok_or_else(|| TranslationError::field("finish_reason", "required"))?;
    match reason {
        "stop" => Ok(Value::String("end_turn".into())),
        "tool_calls" | "function_call" => Ok(Value::String("tool_use".into())),
        "length" => Ok(Value::String("max_tokens".into())),
        other => Err(TranslationError::field(
            "finish_reason",
            &format!("'{other}' is not one of stop, tool_calls, length"),
        )),
    }
}

fn anthropic_usage_to_openai(usage: &Value) -> TranslationResult {
    let object = usage
        .as_object()
        .ok_or_else(|| TranslationError::field("usage", "must be a JSON object"))?;
    let input = object
        .get("input_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let cache_read = object
        .get("cache_read_input_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let cache_creation = object
        .get("cache_creation_input_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let output = object
        .get("output_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let prompt = input
        .saturating_add(cache_read)
        .saturating_add(cache_creation);
    let mut out = Map::new();
    out.insert("prompt_tokens".into(), Value::from(prompt));
    out.insert("completion_tokens".into(), Value::from(output));
    out.insert(
        "total_tokens".into(),
        Value::from(prompt.saturating_add(output)),
    );
    if cache_read > 0 {
        out.insert(
            "prompt_tokens_details".into(),
            serde_json::json!({ "cached_tokens": cache_read }),
        );
    }
    Ok(Value::Object(out))
}

fn openai_usage_to_anthropic(usage: &Value) -> TranslationResult {
    let object = usage
        .as_object()
        .ok_or_else(|| TranslationError::field("usage", "must be a JSON object"))?;
    let prompt = object
        .get("prompt_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let cached = object
        .get("prompt_tokens_details")
        .and_then(|details| details.get("cached_tokens"))
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let output = object
        .get("completion_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let mut out = Map::new();
    out.insert(
        "input_tokens".into(),
        Value::from(prompt.saturating_sub(cached)),
    );
    if cached > 0 {
        out.insert("cache_read_input_tokens".into(), Value::from(cached));
    }
    out.insert("output_tokens".into(), Value::from(output));
    Ok(Value::Object(out))
}

/// Direction for translating a buffered upstream response back to the
/// endpoint dialect.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResponseTranslation {
    /// An Anthropic-protocol upstream answered an OpenAI-dialect endpoint.
    ToOpenai,
    /// An OpenAI-protocol upstream answered an Anthropic-dialect endpoint.
    ToAnthropic,
    /// A chat-completions upstream answered a responses-dialect endpoint
    /// (stateless translation).
    ResponsesFromChat,
}

impl ResponseTranslation {
    /// Translate one buffered JSON response body. `created_unix` is
    /// supplied by the caller; a pure function never invents time.
    pub fn translate_json_response(&self, body: &Value, created_unix: i64) -> TranslationResult {
        match self {
            Self::ToOpenai => anthropic_response_to_openai(body, created_unix),
            Self::ToAnthropic => openai_response_to_anthropic(body),
            Self::ResponsesFromChat => openai_response_to_responses(body),
        }
    }
}

/// Incremental SSE event translator: Anthropic message lifecycle events in,
/// OpenAI `chat.completion.chunk` frames out (plus a `"[DONE]"` string
/// sentinel after `message_stop`). Feed one parsed `data:` JSON value per
/// [`Self::push`]; the batch helper [`translate_anthropic_stream`] drives a
/// whole recorded sequence.
#[derive(Debug)]
pub struct AnthropicToOpenaiStream {
    id: Value,
    model: Value,
    created_unix: i64,
    started: bool,
    next_tool_index: u64,
    tool_index_by_block: std::collections::HashMap<u64, u64>,
    input_tokens: u64,
    output_tokens: u64,
    stop_reason: Option<String>,
    finished: bool,
}

impl AnthropicToOpenaiStream {
    pub fn new(created_unix: i64) -> Self {
        Self {
            id: Value::Null,
            model: Value::Null,
            created_unix,
            started: false,
            next_tool_index: 0,
            tool_index_by_block: std::collections::HashMap::new(),
            input_tokens: 0,
            output_tokens: 0,
            stop_reason: None,
            finished: false,
        }
    }

    fn chunk(&self, delta: Value, finish_reason: Option<&str>) -> Value {
        serde_json::json!({
            "id": self.id,
            "object": "chat.completion.chunk",
            "created": self.created_unix,
            "model": self.model,
            "choices": [{
                "index": 0,
                "delta": delta,
                "finish_reason": finish_reason,
            }],
        })
    }

    /// Feed one parsed Anthropic SSE data event; returns the translated
    /// OpenAI frames it produced (possibly none).
    pub fn push(&mut self, event: &Value) -> Result<Vec<Value>, TranslationError> {
        if self.finished {
            return Err(TranslationError::field(
                "stream event",
                "the message already stopped",
            ));
        }
        let event_type = event
            .get("type")
            .and_then(Value::as_str)
            .ok_or_else(|| TranslationError::field("stream event.type", "required"))?;
        match event_type {
            "message_start" => {
                let message = event.get("message").ok_or_else(|| {
                    TranslationError::field("message_start.message", "required")
                })?;
                if let Some(id) = message.get("id") {
                    self.id = id.clone();
                }
                if let Some(model) = message.get("model") {
                    self.model = model.clone();
                }
                if let Some(usage) = message.get("usage") {
                    self.input_tokens =
                        usage.get("input_tokens").and_then(Value::as_u64).unwrap_or(0);
                    self.output_tokens =
                        usage.get("output_tokens").and_then(Value::as_u64).unwrap_or(0);
                }
                self.started = true;
                Ok(vec![self.chunk(serde_json::json!({ "role": "assistant" }), None)])
            }
            "ping" => Ok(Vec::new()),
            "content_block_start" => {
                let index = block_index(event)?;
                let block = event.get("content_block").ok_or_else(|| {
                    TranslationError::field("content_block_start.content_block", "required")
                })?;
                match block.get("type").and_then(Value::as_str) {
                    Some("text") => Ok(Vec::new()),
                    Some("tool_use") => {
                        let tool_index = self.next_tool_index;
                        self.next_tool_index += 1;
                        self.tool_index_by_block.insert(index, tool_index);
                        Ok(vec![self.chunk(
                            serde_json::json!({
                                "tool_calls": [{
                                    "index": tool_index,
                                    "id": block.get("id").cloned().unwrap_or(Value::Null),
                                    "type": "function",
                                    "function": {
                                        "name": block.get("name").cloned().unwrap_or(Value::Null),
                                        "arguments": "",
                                    },
                                }],
                            }),
                            None,
                        )])
                    }
                    other => Err(TranslationError::field(
                        "content_block_start.content_block.type",
                        &format!("'{other:?}' is not one of text, tool_use"),
                    )),
                }
            }
            "content_block_delta" => {
                let index = block_index(event)?;
                let delta = event
                    .get("delta")
                    .ok_or_else(|| TranslationError::field("content_block_delta.delta", "required"))?;
                match delta.get("type").and_then(Value::as_str) {
                    Some("text_delta") => Ok(vec![self.chunk(
                        serde_json::json!({
                            "content": delta.get("text").cloned().unwrap_or(Value::Null),
                        }),
                        None,
                    )]),
                    Some("input_json_delta") => {
                        let tool_index = self.tool_index_by_block.get(&index).copied().ok_or_else(|| {
                            TranslationError::field(
                                "content_block_delta",
                                "input_json_delta arrived for a block that is not a tool_use",
                            )
                        })?;
                        Ok(vec![self.chunk(
                            serde_json::json!({
                                "tool_calls": [{
                                    "index": tool_index,
                                    "function": {
                                        "arguments": delta.get("partial_json").cloned().unwrap_or(Value::Null),
                                    },
                                }],
                            }),
                            None,
                        )])
                    }
                    other => Err(TranslationError::field(
                        "content_block_delta.delta.type",
                        &format!("'{other:?}' is not one of text_delta, input_json_delta"),
                    )),
                }
            }
            "content_block_stop" => Ok(Vec::new()),
            "message_delta" => {
                if let Some(delta) = event.get("delta") {
                    if let Some(reason) = delta.get("stop_reason").and_then(Value::as_str) {
                        // Validated at emission time by the shared mapper.
                        self.stop_reason = Some(reason.to_string());
                    }
                }
                if let Some(usage) = event.get("usage") {
                    if let Some(output) = usage.get("output_tokens").and_then(Value::as_u64) {
                        self.output_tokens = output;
                    }
                }
                Ok(Vec::new())
            }
            "message_stop" => {
                self.finished = true;
                let reason = self.stop_reason.as_deref().unwrap_or("end_turn");
                let finish = anthropic_stop_reason_to_openai(Some(reason))?;
                let finish_reason = finish.as_str().unwrap_or("stop").to_string();
                let usage = serde_json::json!({
                    "usage": {
                        "prompt_tokens": self.input_tokens,
                        "completion_tokens": self.output_tokens,
                        "total_tokens": self.input_tokens + self.output_tokens,
                    },
                });
                let terminal = serde_json::json!({
                    "id": self.id,
                    "object": "chat.completion.chunk",
                    "created": self.created_unix,
                    "model": self.model,
                    "choices": [{
                        "index": 0,
                        "delta": {},
                        "finish_reason": finish_reason,
                    }],
                    "usage": usage["usage"],
                });
                Ok(vec![terminal, Value::String("[DONE]".into())])
            }
            other => Err(TranslationError::field(
                "stream event.type",
                &format!("'{other}' is not one of message_start, ping, content_block_start, content_block_delta, content_block_stop, message_delta, message_stop"),
            )),
        }
    }

    /// True once `message_stop` was translated (the `[DONE]` sentinel was
    /// emitted).
    pub fn is_finished(&self) -> bool {
        self.finished
    }
}

fn block_index(event: &Value) -> Result<u64, TranslationError> {
    event
        .get("index")
        .and_then(Value::as_u64)
        .ok_or_else(|| TranslationError::field("content block.index", "required"))
}

/// Batch form of [`AnthropicToOpenaiStream`] for recorded sequences.
pub fn translate_anthropic_stream(
    events: &[Value],
    created_unix: i64,
) -> Result<Vec<Value>, TranslationError> {
    let mut machine = AnthropicToOpenaiStream::new(created_unix);
    let mut out = Vec::new();
    for event in events {
        out.extend(machine.push(event)?);
    }
    Ok(out)
}

/// Incremental SSE translator: OpenAI `chat.completion.chunk` frames in,
/// Anthropic message lifecycle events out. Terminal semantics aggregate:
/// the finish frame and the trailing usage frame (when present) merge into
/// one `message_delta` + `message_stop` sequence, so `message_start`'s
/// usage is provisional (zeroed) until the final event — the same
/// provisional/final split Anthropic's own streams use.
#[derive(Debug)]
pub struct OpenaiToAnthropicStream {
    started: bool,
    ended: bool,
    next_block_index: u64,
    text_block: Option<u64>,
    tool_block_by_index: std::collections::HashMap<u64, u64>,
    finish_reason: Option<String>,
    usage: Option<Value>,
}

impl OpenaiToAnthropicStream {
    pub fn new() -> Self {
        Self {
            started: false,
            ended: false,
            next_block_index: 0,
            text_block: None,
            tool_block_by_index: std::collections::HashMap::new(),
            finish_reason: None,
            usage: None,
        }
    }

    fn emit_terminal(&mut self) -> Result<Vec<Value>, TranslationError> {
        self.ended = true;
        let mut events = Vec::new();
        // The text block always opens first in this machine; tool blocks
        // follow in tool-call arrival order. Close in block-index order.
        let mut open: Vec<u64> = self.tool_block_by_index.values().copied().collect();
        if let Some(text) = self.text_block {
            open.push(text);
        }
        open.sort_unstable();
        open.dedup();
        for index in open {
            events.push(serde_json::json!({
                "type": "content_block_stop",
                "index": index,
            }));
        }
        let reason = self.finish_reason.as_deref().unwrap_or("stop");
        let stop_reason = openai_finish_reason_to_anthropic(Some(reason))?;
        let stop_reason = stop_reason.as_str().unwrap_or("end_turn").to_string();
        let mut message_delta = serde_json::json!({
            "type": "message_delta",
            "delta": { "stop_reason": stop_reason },
        });
        if let Some(usage) = self.usage.as_ref().and_then(|usage| usage.get("usage")) {
            let output = usage
                .get("completion_tokens")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            // Constructed above as a JSON object; the insert is
            // infallible by construction.
            message_delta
                .as_object_mut()
                .expect("message_delta object")
                .insert(
                    "usage".into(),
                    serde_json::json!({ "output_tokens": output }),
                );
        }
        events.push(message_delta);
        events.push(serde_json::json!({ "type": "message_stop" }));
        Ok(events)
    }

    /// Feed one parsed OpenAI chunk (or the `"[DONE]"` string sentinel);
    /// returns the translated Anthropic events it produced.
    pub fn push(&mut self, frame: &Value) -> Result<Vec<Value>, TranslationError> {
        if frame.is_string() {
            if frame == &Value::String("[DONE]".into()) {
                // The finish frame already emitted the terminal events;
                // the trailing sentinel is idempotent.
                if self.ended {
                    return Ok(Vec::new());
                }
                return self.emit_terminal();
            }
            return Err(TranslationError::field(
                "stream frame",
                "the only accepted string sentinel is \"[DONE]\"",
            ));
        }
        if self.ended {
            return Err(TranslationError::field(
                "stream frame",
                "the message already stopped",
            ));
        }
        let object = frame.as_object().ok_or_else(|| {
            TranslationError::field("stream frame", "must be a JSON object or \"[DONE]\"")
        })?;
        let Some(choices) = object.get("choices").and_then(Value::as_array) else {
            // The trailing usage-only frame carries no choices; hold the
            // usage for the terminal events.
            if object.get("usage").is_some() {
                self.usage = Some(frame.clone());
            }
            return Ok(Vec::new());
        };
        let choice = choices.first().ok_or_else(|| {
            TranslationError::field("stream frame.choices", "must be non-empty when present")
        })?;
        let mut events = Vec::new();
        if !self.started {
            self.started = true;
            events.push(serde_json::json!({
                "type": "message_start",
                "message": {
                    "id": object.get("id").cloned().unwrap_or(Value::Null),
                    "type": "message",
                    "role": "assistant",
                    "model": object.get("model").cloned().unwrap_or(Value::Null),
                    "content": [],
                    "usage": { "input_tokens": 0, "output_tokens": 0 },
                },
            }));
        }
        let delta = choice.get("delta");
        if let Some(finish) = choice.get("finish_reason").and_then(Value::as_str) {
            self.finish_reason = Some(finish.to_string());
            if object.get("usage").is_some() {
                self.usage = Some(frame.clone());
            }
            let terminal = self.emit_terminal()?;
            events.extend(terminal);
            return Ok(events);
        }
        let Some(delta) = delta else {
            return Ok(events);
        };
        if let Some(content) = delta.get("content").and_then(Value::as_str) {
            let block = match self.text_block {
                Some(index) => index,
                None => {
                    let index = self.next_block_index;
                    self.next_block_index += 1;
                    self.text_block = Some(index);
                    events.push(serde_json::json!({
                        "type": "content_block_start",
                        "index": index,
                        "content_block": { "type": "text", "text": "" },
                    }));
                    index
                }
            };
            events.push(serde_json::json!({
                "type": "content_block_delta",
                "index": block,
                "delta": { "type": "text_delta", "text": content },
            }));
        }
        if let Some(calls) = delta.get("tool_calls").and_then(Value::as_array) {
            for call in calls {
                let call_index = call
                    .get("index")
                    .and_then(Value::as_u64)
                    .ok_or_else(|| TranslationError::field("tool_calls.index", "required"))?;
                let block = match self.tool_block_by_index.get(&call_index) {
                    Some(block) => *block,
                    None => {
                        let block = self.next_block_index;
                        self.next_block_index += 1;
                        self.tool_block_by_index.insert(call_index, block);
                        let function = call.get("function");
                        events.push(serde_json::json!({
                            "type": "content_block_start",
                            "index": block,
                            "content_block": {
                                "type": "tool_use",
                                "id": call.get("id").cloned().unwrap_or(Value::Null),
                                "name": function
                                    .and_then(|function| function.get("name"))
                                    .cloned()
                                    .unwrap_or(Value::Null),
                                "input": {},
                            },
                        }));
                        block
                    }
                };
                let arguments = call
                    .get("function")
                    .and_then(|function| function.get("arguments"))
                    .and_then(Value::as_str)
                    .unwrap_or("");
                if !arguments.is_empty() {
                    events.push(serde_json::json!({
                        "type": "content_block_delta",
                        "index": block,
                        "delta": {
                            "type": "input_json_delta",
                            "partial_json": arguments,
                        },
                    }));
                }
            }
        }
        Ok(events)
    }

    /// True once the terminal events were emitted.
    pub fn is_finished(&self) -> bool {
        self.ended
    }
}

impl Default for OpenaiToAnthropicStream {
    fn default() -> Self {
        Self::new()
    }
}

/// Batch form of [`OpenaiToAnthropicStream`] for recorded sequences.
pub fn translate_openai_stream(events: &[Value]) -> Result<Vec<Value>, TranslationError> {
    let mut machine = OpenaiToAnthropicStream::new();
    let mut out = Vec::new();
    for event in events {
        out.extend(machine.push(event)?);
    }
    Ok(out)
}

/// Translate a stateless `/v1/responses` request onto a chat-completions
/// request. Stateful surfaces refuse: `previous_response_id` and
/// function-call items carry server-side state the stateless lane cannot
/// reconstruct (the loss ledger names them).
pub fn responses_request_to_openai(request: &Value) -> TranslationResult {
    let object = request.as_object().ok_or_else(|| {
        TranslationError::field("request", "the responses request must be a JSON object")
    })?;
    if object.get("previous_response_id").is_some() {
        return Err(TranslationError::field(
            "previous_response_id",
            "stateful responses require a responses-native upstream; the stateless translation lane refuses",
        ));
    }
    let mut out = Map::new();
    if let Some(model) = object.get("model") {
        out.insert("model".into(), model.clone());
    }
    let mut messages = Vec::new();
    if let Some(instructions) = object.get("instructions").and_then(Value::as_str) {
        if !instructions.is_empty() {
            messages.push(serde_json::json!({
                "role": "system",
                "content": instructions,
            }));
        }
    }
    match object.get("input") {
        Some(Value::String(text)) => {
            messages.push(serde_json::json!({ "role": "user", "content": text }));
        }
        Some(Value::Array(items)) => {
            for item in items {
                let item_type = item
                    .get("type")
                    .and_then(Value::as_str)
                    .unwrap_or("message");
                if item_type != "message" {
                    return Err(TranslationError::field(
                        "input.type",
                        &format!("'{item_type}' is not one of message (function_call items carry state the stateless lane refuses)"),
                    ));
                }
                let role = item.get("role").and_then(Value::as_str).ok_or_else(|| {
                    TranslationError::field("input.role", "required on message items")
                })?;
                if role != "user" && role != "assistant" {
                    return Err(TranslationError::field(
                        "input.role",
                        &format!("'{role}' is not one of user, assistant"),
                    ));
                }
                let text = match item.get("content") {
                    Some(Value::String(text)) => text.clone(),
                    Some(Value::Array(parts)) => {
                        let mut joined = String::new();
                        for part in parts {
                            let part_type =
                                part.get("type").and_then(Value::as_str).ok_or_else(|| {
                                    TranslationError::field("content.type", "required")
                                })?;
                            match part_type {
                                "input_text" | "output_text" => joined.push_str(
                                    part.get("text").and_then(Value::as_str).unwrap_or(""),
                                ),
                                other => {
                                    return Err(TranslationError::field(
                                        "content.type",
                                        &format!("'{other}' is not one of input_text, output_text"),
                                    ))
                                }
                            }
                        }
                        joined
                    }
                    _ => {
                        return Err(TranslationError::field(
                            "input.content",
                            "required as a part list or a text string",
                        ))
                    }
                };
                messages.push(serde_json::json!({ "role": role, "content": text }));
            }
        }
        _ => {
            return Err(TranslationError::field(
                "input",
                "required as a text string or an item list",
            ))
        }
    }
    if messages.is_empty() {
        return Err(TranslationError::field(
            "input",
            "no messages remain to translate",
        ));
    }
    out.insert("messages".into(), Value::Array(messages));
    // The chat-completions dialect requires a completion bound; pin the
    // same fail-closed default the gateway's reservation estimator uses.
    let max_tokens = object
        .get("max_output_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(1_024);
    out.insert("max_tokens".into(), Value::from(max_tokens));
    for field in ["temperature", "top_p"] {
        if let Some(value) = object.get(field) {
            out.insert(field.into(), value.clone());
        }
    }
    if object.get("stream") == Some(&Value::Bool(true)) {
        out.insert("stream".into(), Value::Bool(true));
    }
    Ok(Value::Object(out))
}

/// Translate a chat-completions response into a `/v1/responses` response
/// object. Output item ids are deterministic (`msg_{index}`, `fc_{index}`);
/// the response id rides the completion id.
pub fn openai_response_to_responses(response: &Value) -> TranslationResult {
    let object = response.as_object().ok_or_else(|| {
        TranslationError::field("response", "the OpenAI response must be a JSON object")
    })?;
    let choice = object
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .ok_or_else(|| TranslationError::field("choices", "required and must be non-empty"))?;
    let message = choice
        .get("message")
        .ok_or_else(|| TranslationError::field("choices.message", "required"))?;
    let finish = choice.get("finish_reason").and_then(Value::as_str);
    let status = match finish {
        Some("length") => "incomplete",
        _ => "completed",
    };

    let mut output = Vec::new();
    if let Some(text) = message.get("content").and_then(Value::as_str) {
        if !text.is_empty() {
            output.push(serde_json::json!({
                "type": "message",
                "id": "msg_0",
                "role": "assistant",
                "status": status,
                "content": [{ "type": "output_text", "text": text }],
            }));
        }
    }
    if let Some(calls) = message.get("tool_calls").and_then(Value::as_array) {
        for (index, call) in calls.iter().enumerate() {
            let function = call
                .get("function")
                .ok_or_else(|| TranslationError::field("tool_calls.function", "required"))?;
            output.push(serde_json::json!({
                "type": "function_call",
                "id": format!("fc_{index}"),
                "call_id": call.get("id").cloned().unwrap_or(Value::Null),
                "name": function.get("name").cloned().unwrap_or(Value::Null),
                "arguments": function.get("arguments").cloned().unwrap_or(Value::Null),
                "status": status,
            }));
        }
    }
    if output.is_empty() {
        return Err(TranslationError::field(
            "choices.message",
            "content or tool_calls is required",
        ));
    }

    let mut out = Map::new();
    if let Some(id) = object.get("id") {
        out.insert("id".into(), id.clone());
    }
    out.insert("object".into(), Value::String("response".into()));
    if let Some(created) = object.get("created") {
        out.insert("created_at".into(), created.clone());
    }
    if let Some(model) = object.get("model") {
        out.insert("model".into(), model.clone());
    }
    out.insert("status".into(), Value::String(status.into()));
    out.insert("output".into(), Value::Array(output));
    if let Some(usage) = object.get("usage") {
        let usage_object = usage
            .as_object()
            .ok_or_else(|| TranslationError::field("usage", "must be a JSON object"))?;
        let prompt = usage_object
            .get("prompt_tokens")
            .cloned()
            .unwrap_or(Value::from(0));
        let completion = usage_object
            .get("completion_tokens")
            .cloned()
            .unwrap_or(Value::from(0));
        let total = usage_object
            .get("total_tokens")
            .cloned()
            .unwrap_or(Value::from(0));
        out.insert(
            "usage".into(),
            serde_json::json!({
                "input_tokens": prompt,
                "output_tokens": completion,
                "total_tokens": total,
                "output_tokens_details": usage_object
                    .get("completion_tokens_details")
                    .cloned()
                    .unwrap_or_else(|| serde_json::json!({ "reasoning_tokens": 0 })),
            }),
        );
    }
    Ok(Value::Object(out))
}

/// Incremental SSE translator: chat-completions chunks in, Responses-API
/// events out (`response.created` → `response.output_item.*` →
/// `response.completed`). The text deltas accumulate so `output_item.done`
/// and `response.completed` carry full content, mirroring the Responses
/// stream contract. The first chunk supplies id/model/created.
#[derive(Debug)]
pub struct ChatToResponsesStream {
    id: Value,
    model: Value,
    created_at: i64,
    started: bool,
    text: String,
    finish_reason: Option<String>,
    usage: Option<Value>,
    ended: bool,
}

impl ChatToResponsesStream {
    pub const fn new() -> Self {
        Self {
            id: Value::Null,
            model: Value::Null,
            created_at: 0,
            started: false,
            text: String::new(),
            finish_reason: None,
            usage: None,
            ended: false,
        }
    }

    fn shell(&self, status: &str) -> Value {
        serde_json::json!({
            "id": self.id,
            "object": "response",
            "created_at": self.created_at,
            "model": self.model,
            "status": status,
        })
    }

    fn message_item(&self, status: &str, full: bool) -> Value {
        serde_json::json!({
            "type": "message",
            "id": "msg_0",
            "role": "assistant",
            "status": status,
            "content": if full {
                serde_json::json!([{ "type": "output_text", "text": self.text }])
            } else {
                serde_json::json!([])
            },
        })
    }

    /// Feed one parsed OpenAI chunk (or the `"[DONE]"` sentinel); returns
    /// the translated Responses events it produced.
    pub fn push(&mut self, frame: &Value) -> Result<Vec<Value>, TranslationError> {
        if frame.is_string() {
            if frame == &Value::String("[DONE]".into()) {
                if self.ended {
                    return Ok(Vec::new());
                }
                return self.emit_terminal();
            }
            return Err(TranslationError::field(
                "stream frame",
                "the only accepted string sentinel is \"[DONE]\"",
            ));
        }
        if self.ended {
            return Err(TranslationError::field(
                "stream frame",
                "the response already completed",
            ));
        }
        let object = frame.as_object().ok_or_else(|| {
            TranslationError::field("stream frame", "must be a JSON object or \"[DONE]\"")
        })?;
        let mut events = Vec::new();
        if !self.started {
            self.started = true;
            if let Some(id) = object.get("id") {
                self.id = id.clone();
            }
            if let Some(model) = object.get("model") {
                self.model = model.clone();
            }
            self.created_at = object.get("created").and_then(Value::as_i64).unwrap_or(0);
            events.push(serde_json::json!({
                "type": "response.created",
                "response": self.shell("in_progress"),
            }));
            events.push(serde_json::json!({
                "type": "response.output_item.added",
                "output_index": 0,
                "item": self.message_item("in_progress", false),
            }));
        }
        let choices = object.get("choices").and_then(Value::as_array);
        let choice = choices.and_then(|choices| choices.first());
        if let Some(choice) = choice {
            if let Some(finish) = choice.get("finish_reason").and_then(Value::as_str) {
                self.finish_reason = Some(finish.to_string());
            }
            if let Some(content) = choice
                .get("delta")
                .and_then(|delta| delta.get("content"))
                .and_then(Value::as_str)
            {
                self.text.push_str(content);
                events.push(serde_json::json!({
                    "type": "response.output_text.delta",
                    "item_id": "msg_0",
                    "output_index": 0,
                    "content_index": 0,
                    "delta": content,
                }));
            }
        } else if object.get("usage").is_some() {
            self.usage = Some(frame.clone());
        }
        if self.finish_reason.is_some() {
            if object.get("usage").is_some() {
                self.usage = Some(frame.clone());
            }
            let terminal = self.emit_terminal()?;
            events.extend(terminal);
        }
        Ok(events)
    }

    fn emit_terminal(&mut self) -> Result<Vec<Value>, TranslationError> {
        self.ended = true;
        let finish = self.finish_reason.as_deref().unwrap_or("stop");
        let status = match finish {
            "length" => "incomplete",
            _ => "completed",
        };
        let mut done_item = self.message_item(status, true);
        done_item["status"] = Value::String(status.into());
        let mut response = self.shell(status);
        let response_object = response.as_object_mut().expect("response shell object");
        response_object.insert("output".into(), Value::Array(vec![done_item.clone()]));
        if let Some(usage_frame) = self.usage.as_ref() {
            if let Some(usage) = usage_frame.get("usage") {
                let prompt = usage
                    .get("prompt_tokens")
                    .cloned()
                    .unwrap_or(Value::from(0));
                let output = usage
                    .get("completion_tokens")
                    .cloned()
                    .unwrap_or(Value::from(0));
                let total = usage.get("total_tokens").cloned().unwrap_or(Value::from(0));
                response_object.insert(
                    "usage".into(),
                    serde_json::json!({
                        "input_tokens": prompt,
                        "output_tokens": output,
                        "total_tokens": total,
                        "output_tokens_details": usage
                            .get("completion_tokens_details")
                            .cloned()
                            .unwrap_or_else(|| serde_json::json!({ "reasoning_tokens": 0 })),
                    }),
                );
            }
        }
        Ok(vec![
            serde_json::json!({
                "type": "response.output_item.done",
                "output_index": 0,
                "item": done_item,
            }),
            serde_json::json!({ "type": "response.completed", "response": response }),
        ])
    }

    /// True once `response.completed` was emitted.
    pub fn is_finished(&self) -> bool {
        self.ended
    }
}

impl Default for ChatToResponsesStream {
    fn default() -> Self {
        Self::new()
    }
}

/// Batch form of [`ChatToResponsesStream`] for recorded sequences.
pub fn translate_chat_to_responses_stream(
    events: &[Value],
) -> Result<Vec<Value>, TranslationError> {
    let mut machine = ChatToResponsesStream::new();
    let mut out = Vec::new();
    for event in events {
        out.extend(machine.push(event)?);
    }
    Ok(out)
}
