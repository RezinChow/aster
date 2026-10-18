use std::collections::{HashMap, HashSet};

use a3s_acl::{ParseLimits, Value as Ast};
use a3s_code_tools::mcp_elicitation::{
    McpElicitExtRequest, McpElicitExtResponse, McpElicitModeFields, parse_form_schema,
};
use agent_client_protocol as acp;
use serde::Deserialize;
use serde_json::{Map, Value, json};

use super::{AppView, handle_mcp_elicit, interaction_target_agent};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Request {
    session_id: String,
    form_id: String,
    prompt: String,
    spec: String,
    format: String,
}

pub(super) fn handle_form_request(
    ext: a3s_acp_lib::AcpArgs<acp::ExtRequest>,
    app: &mut AppView,
) -> bool {
    let prepared: Result<_, String> = (|| {
        let request: Request = serde_json::from_str(ext.request.params.get())
            .map_err(|_| "invalid form request".to_string())?;
        for id in [&request.session_id, &request.form_id] {
            if id.trim().is_empty() || id.len() > 128 || id.chars().any(char::is_control) {
                return Err("invalid form identity".into());
            }
        }
        if request.format != "openui" {
            return Err("unsupported form format".into());
        }
        if interaction_target_agent(app, &request.session_id).is_none() {
            return Err("form session has no local view".into());
        }
        let compiled = compile(&request.spec, &request.prompt)?;
        let request = McpElicitExtRequest {
            session_id: request.session_id,
            tool_call_id: request.form_id,
            server_name: "Aster".into(),
            message: compiled.message,
            require_nonempty: true,
            mode: McpElicitModeFields::Form {
                requested_schema: Some(compiled.schema),
            },
        };
        let raw = serde_json::value::to_raw_value(&request).map_err(|_| "invalid form schema")?;
        Ok((raw, compiled.defaults))
    })();
    let (raw, defaults) = match prepared {
        Ok(prepared) => prepared,
        Err(message) => {
            let _ = ext.response_tx.send(Err(acp::Error::new(-32602, message)));
            return false;
        }
    };
    let (response_tx, response_rx) = tokio::sync::oneshot::channel();
    let mut original = ext.response_tx;
    tokio::spawn(async move {
        tokio::select! {
            _ = original.closed() => {}
            response = response_rx => {
                let response = match response {
                    Ok(Ok(response)) => adapt_response(response, defaults),
                    Ok(Err(error)) => Err(error),
                    Err(_) => Err(acp::Error::new(-32603, "form was closed before submission")),
                };
                let _ = original.send(response);
            }
        }
    });
    handle_mcp_elicit(
        a3s_acp_lib::AcpArgs {
            request: acp::ExtRequest::new("x.ai/mcp/elicit", raw.into()),
            response_tx,
        },
        app,
    )
}

fn adapt_response(
    response: acp::ExtResponse,
    defaults: Map<String, Value>,
) -> a3s_acp_lib::AcpResult<acp::ExtResponse> {
    let response: McpElicitExtResponse = serde_json::from_str(response.0.get())
        .map_err(|_| acp::Error::new(-32603, "invalid form response"))?;
    let payload = match response {
        McpElicitExtResponse::Accept {
            content: Some(Value::Object(content)),
        } => {
            let mut values = defaults;
            values.extend(content);
            json!({ "values": values })
        }
        McpElicitExtResponse::Cancel => json!({ "outcome": "cancel" }),
        McpElicitExtResponse::Decline => json!({ "outcome": "decline" }),
        _ => return Err(acp::Error::new(-32603, "form returned no values")),
    };
    let raw =
        serde_json::value::to_raw_value(&payload).map_err(|_| acp::Error::internal_error())?;
    Ok(acp::ExtResponse::new(raw.into()))
}

struct Compiled {
    schema: Value,
    defaults: Map<String, Value>,
    message: String,
}

struct Builder {
    nodes: HashMap<String, (String, Vec<Ast>)>,
    visited: HashSet<String>,
    properties: Map<String, Value>,
    defaults: Map<String, Value>,
    required: Vec<Value>,
    order: Vec<String>,
    text: Vec<String>,
}

fn compile(source: &str, prompt: &str) -> Result<Compiled, String> {
    let document = a3s_acl::parse_with_limits(
        source,
        ParseLimits {
            max_document_bytes: 65_536,
            max_nesting_depth: 16,
            max_collection_items: 160,
            max_token_bytes: 4096,
            ..Default::default()
        },
    )
    .map_err(|_| "invalid or oversized OpenUI source")?;
    let mut builder = Builder {
        nodes: HashMap::new(),
        visited: HashSet::new(),
        properties: Map::new(),
        defaults: Map::new(),
        required: Vec::new(),
        order: Vec::new(),
        text: vec![prompt.into()],
    };
    if document.blocks.len() > 160 {
        return Err("too many form statements".into());
    }
    for node in document.blocks {
        if !identifier(&node.name)
            || !node.labels.is_empty()
            || !node.blocks.is_empty()
            || node.attributes.len() != 1
        {
            return Err("form statements must assign a component".into());
        }
        let Some(Ast::Call(kind, args)) = node.attributes.get(&node.name) else {
            return Err("form statements must assign a component".into());
        };
        if builder
            .nodes
            .insert(node.name, (kind.clone(), args.clone()))
            .is_some()
        {
            return Err("duplicate form statement".into());
        }
    }
    builder.visit("root", 0)?;
    if builder.visited.len() != builder.nodes.len() || builder.properties.is_empty() {
        return Err("form contains unused nodes or no fields".into());
    }
    let schema = json!({"type":"object", "properties":builder.properties, "required":builder.required, "x-a3s-field-order":builder.order});
    parse_form_schema(&schema)?;
    let message = builder.text.join(" · ");
    if message.chars().count() > 4096 {
        return Err("form description is too long".into());
    }
    Ok(Compiled {
        schema,
        defaults: builder.defaults,
        message,
    })
}

fn identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 48
        && value.as_bytes()[0].is_ascii_alphabetic()
        && value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_')
        && !matches!(value, "constructor" | "prototype" | "__proto__")
}

fn string(value: &Ast) -> Result<&str, String> {
    value
        .as_str()
        .ok_or_else(|| "form requires literal text".into())
}

fn literal(value: &Ast) -> Result<Value, String> {
    match value {
        Ast::String(value) => Ok(value.clone().into()),
        Ast::Bool(value) => Ok((*value).into()),
        Ast::Number(value) if value.is_finite() => Ok(json!(value)),
        Ast::Null => Ok(Value::Null),
        Ast::List(values) => values
            .iter()
            .map(literal)
            .collect::<Result<Vec<_>, _>>()
            .map(Value::Array),
        _ => Err("dynamic expressions are not supported by terminal forms".into()),
    }
}

impl Builder {
    fn visit(&mut self, name: &str, depth: usize) -> Result<(), String> {
        if depth > 16 || !self.visited.insert(name.into()) {
            return Err("form references are cyclic, duplicated or too deep".into());
        }
        let (kind, args) = self.nodes.get(name).cloned().ok_or("missing form node")?;
        let child_arg = match kind.as_str() {
            "Card" => {
                if args.len() != 2 {
                    return Err("Card requires a title and children".into());
                }
                self.text.push(string(&args[0])?.into());
                Some(1)
            }
            "Stack" if args.len() == 1 => Some(0),
            "Grid"
                if args.len() == 2
                    && args[0]
                        .as_number()
                        .is_some_and(|v| v > 0.0 && v.fract() == 0.0) =>
            {
                Some(1)
            }
            "Text" if args.len() == 1 => {
                self.text.push(string(&args[0])?.into());
                None
            }
            "Button" if args.len() == 2 && string(&args[0])? == "submit" => {
                self.text.push(string(&args[1])?.into());
                None
            }
            "Input" | "Textarea" | "Select" | "Checkbox" | "Slider" => {
                self.field(&kind, &args)?;
                None
            }
            _ => return Err(format!("unsupported terminal form component: {kind}")),
        };
        if let Some(index) = child_arg {
            let Some(Ast::List(children)) = args.get(index) else {
                return Err("form children must be references".into());
            };
            for child in children {
                self.visit(string(child)?, depth + 1)?;
            }
        }
        Ok(())
    }

    fn field(&mut self, kind: &str, args: &[Ast]) -> Result<(), String> {
        let names: &[&str] = match kind {
            "Input" => &[
                "name",
                "title",
                "default",
                "inputType",
                "minimum",
                "maximum",
                "step",
                "required",
                "description",
            ],
            "Textarea" => &["name", "title", "default", "required", "description"],
            "Select" => &[
                "name",
                "title",
                "default",
                "enum",
                "required",
                "description",
            ],
            "Checkbox" => &["name", "title", "default", "required"],
            "Slider" => &["name", "title", "default", "minimum", "maximum", "step"],
            _ => return Err("unsupported form field".into()),
        };
        if args.len() < 2 || args.len() > names.len() {
            return Err("invalid field arguments".into());
        }
        let name = string(&args[0])?.to_string();
        if !identifier(&name) || self.properties.contains_key(&name) {
            return Err("invalid or duplicate field name".into());
        }
        let mut property = Map::new();
        for (key, value) in names.iter().zip(args) {
            let value = literal(value)?;
            if !value.is_null() {
                property.insert((*key).into(), value);
            }
        }
        property.remove("name");
        let title = property
            .get("title")
            .and_then(Value::as_str)
            .ok_or("field needs a label")?;
        if title.chars().count() > 128 {
            return Err("field label is too long".into());
        }
        let required = match property.remove("required") {
            None => false,
            Some(Value::Bool(value)) => value,
            _ => return Err("required must be a boolean".into()),
        };
        if required {
            self.required.push(name.clone().into());
        }
        let ty = match kind {
            "Checkbox" => "boolean",
            "Slider" => "number",
            "Input" => match property
                .remove("inputType")
                .unwrap_or_else(|| "text".into())
            {
                Value::String(input_type) => match input_type.as_str() {
                    "text" => "string",
                    "number" => "number",
                    "email" => {
                        property.insert("format".into(), "email".into());
                        "string"
                    }
                    "date" => {
                        property.insert("format".into(), "date".into());
                        "string"
                    }
                    _ => return Err("unsupported input type".into()),
                },
                _ => return Err("input type must be text".into()),
            },
            _ => "string",
        };
        if property
            .get("description")
            .is_some_and(|value| !value.is_string())
        {
            return Err("field placeholder must be text".into());
        }
        property.insert("type".into(), ty.into());
        let initial = property
            .entry("default")
            .or_insert_with(|| match ty {
                "boolean" => false.into(),
                "number" => 0.into(),
                _ => "".into(),
            })
            .clone();
        if !matches!(
            (ty, &initial),
            ("boolean", Value::Bool(_))
                | ("number", Value::Number(_))
                | ("string", Value::String(_))
        ) {
            return Err("field default has the wrong type".into());
        }
        for key in ["minimum", "maximum", "step"] {
            if let Some(value) = property.get(key) {
                if value.as_f64().is_none() {
                    return Err("numeric constraints must be numbers".into());
                }
            }
        }
        if property
            .get("step")
            .and_then(Value::as_f64)
            .is_some_and(|v| v <= 0.0)
        {
            return Err("step must be positive".into());
        }
        property.remove("step");
        let minimum = property.get("minimum").and_then(Value::as_f64);
        let maximum = property.get("maximum").and_then(Value::as_f64);
        if minimum.zip(maximum).is_some_and(|(min, max)| min > max) {
            return Err("minimum exceeds maximum".into());
        }
        if let Some(value) = initial.as_f64() {
            if minimum.is_some_and(|min| value < min) || maximum.is_some_and(|max| value > max) {
                return Err("default is outside the field range".into());
            }
        }
        if kind == "Select" {
            let options = property
                .get("enum")
                .and_then(Value::as_array)
                .ok_or("Select needs options")?;
            if options.iter().any(|v| !v.is_string()) {
                return Err("Select options must be strings".into());
            }
            if initial.as_str() != Some("") && !options.contains(&initial) {
                return Err("Select default is not an option".into());
            }
        }
        self.order.push(name.clone());
        self.defaults.insert(name.clone(), initial);
        self.properties.insert(name, Value::Object(property));
        Ok(())
    }
}

#[cfg(test)]
mod tests;
