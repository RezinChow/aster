use super::*;
use crate::views::elicitation_view::{ElicitationStage, ElicitationViewState, FieldValueUi};

const FORM: &str = r#"{"root":"root","elements":{"root":{"type":"Card","props":{"title":"Details"},"children":["name","amount","ready","choice","notes","submit"]},"name":{"type":"Input","props":{"label":"Name","type":"text","required":true,"value":{"$bindState":"/form/name"}}},"amount":{"type":"Input","props":{"label":"Amount","type":"number","min":1,"max":5,"value":{"$bindState":"/form/amount"}}},"ready":{"type":"Checkbox","props":{"label":"Ready","required":true,"checked":{"$bindState":"/form/ready"}}},"choice":{"type":"Select","props":{"label":"Choice","options":["alpha","beta"],"required":true,"value":{"$bindState":"/form/choice"}}},"notes":{"type":"Textarea","props":{"label":"Notes","value":{"$bindState":"/form/notes"}}},"submit":{"type":"Button","props":{"action":"submit","label":"Continue"}}},"state":{"form":{"name":"","amount":3,"ready":false,"choice":"beta","notes":""}}}"#;

fn view(compiled: &Compiled) -> ElicitationViewState {
    ElicitationViewState::from_request(
        McpElicitExtRequest {
            session_id: "session-1".into(),
            tool_call_id: "form-1".into(),
            server_name: "Aster".into(),
            message: compiled.message.clone(),
            require_nonempty: true,
            mode: McpElicitModeFields::Form {
                requested_schema: Some(compiled.schema.clone()),
            },
        },
        None,
        None,
    )
}

#[test]
fn existing_native_form_keeps_invalid_fields_open_and_returns_typed_values() {
    let compiled = compile(FORM, "Fill in the details").expect("valid form");
    let mut view = view(&compiled);
    let ElicitationStage::Form(form) = &view.stage else {
        panic!("native form")
    };
    assert_eq!(
        form.fields
            .iter()
            .map(|field| field.spec.name.as_str())
            .collect::<Vec<_>>(),
        ["name", "amount", "ready", "choice", "notes"]
    );
    assert!(
        view.try_accept().is_none(),
        "required fields must block submission"
    );
    let ElicitationStage::Form(form) = &mut view.stage else {
        panic!("native form")
    };
    assert!(
        form.fields
            .iter()
            .filter(|field| field.error.is_some())
            .count()
            >= 2
    );
    for field in &mut form.fields {
        match field.spec.name.as_str() {
            "name" => {
                field.value = FieldValueUi::Text {
                    draft: "   ".into(),
                }
            }
            "ready" => field.value = FieldValueUi::Toggle { on: true },
            _ => {}
        }
    }
    assert!(
        view.try_accept().is_none(),
        "whitespace cannot satisfy a required input"
    );
    let ElicitationStage::Form(form) = &mut view.stage else {
        panic!("native form")
    };
    for field in &mut form.fields {
        if field.spec.name == "name" {
            field.value = FieldValueUi::Text {
                draft: "Ada".into(),
            };
        }
        if field.spec.name == "amount" {
            field.value = FieldValueUi::Text { draft: "6".into() };
        }
    }
    assert!(
        view.try_accept().is_none(),
        "numeric bounds must be enforced"
    );
    let ElicitationStage::Form(form) = &mut view.stage else {
        panic!("native form")
    };
    for field in &mut form.fields {
        if field.spec.name == "amount" {
            field.value = FieldValueUi::Text { draft: "4".into() };
        }
    }
    let response = view.try_accept().expect("valid input submits");
    let raw = serde_json::value::to_raw_value(&response).unwrap();
    let response = adapt_response(acp::ExtResponse::new(raw.into()), compiled.defaults).unwrap();
    let payload: Value = serde_json::from_str(response.0.get()).unwrap();
    assert_eq!(payload["values"]["name"], "Ada");
    assert_eq!(payload["values"]["amount"].as_f64(), Some(4.0));
    assert_eq!(payload["values"]["ready"], true);
    assert_eq!(payload["values"]["choice"], "beta");
    assert_eq!(
        payload["values"]["notes"], "",
        "optional fields retain their empty value"
    );
}

#[test]
fn cancellation_never_becomes_a_submission() {
    let compiled = compile(FORM, "Details").unwrap();
    let raw = serde_json::value::to_raw_value(&McpElicitExtResponse::Cancel).unwrap();
    let response = adapt_response(acp::ExtResponse::new(raw.into()), compiled.defaults).unwrap();
    let payload: Value = serde_json::from_str(response.0.get()).unwrap();
    assert_eq!(payload["outcome"], "cancel");
    assert!(payload.get("values").is_none());
}

#[test]
fn unrepresentable_or_ambiguous_forms_are_rejected_before_opening_ui() {
    for source in [
        "{\"root\":\"root\",\"elements\":{\"root\":{\"type\":\"Stack\",\"props\":{},\"children\":[\"root\"]}}}",
        "{\"root\":\"root\",\"elements\":{\"root\":{\"type\":\"Card\",\"props\":{\"title\":\"x\"},\"children\":[\"missing\"]}}}",
        "root = Widget(\"x\")",
        "root = Input(\"name\", \"Name\")\nother = env(\"SECRET\")",
        "{\"root\":\"root\",\"elements\":{\"root\":{\"type\":\"Card\",\"props\":{\"title\":\"x\"},\"children\":[\"a\",\"b\"]},\"a\":{\"type\":\"Input\",\"props\":{\"label\":\"A\",\"value\":{\"$bindState\":\"/form/name\"}}},\"b\":{\"type\":\"Input\",\"props\":{\"label\":\"B\",\"value\":{\"$bindState\":\"/form/name\"}}}},\"state\":{\"form\":{\"name\":\"\"}}}",
        "{\"root\":\"root\",\"elements\":{\"root\":{\"type\":\"Input\",\"props\":{\"label\":\"Name\",\"value\":{\"$bindState\":\"/form/constructor\"}}}},\"state\":{\"form\":{\"constructor\":\"\"}}}",
        "{\"root\":\"root\",\"elements\":{\"root\":{\"type\":\"Input\",\"props\":{\"label\":\"Name\",\"value\":{\"$bindState\":\"/form/name\"}}}},\"state\":{\"form\":{\"name\":false}}}",
        "{\"root\":\"root\",\"elements\":{\"root\":{\"type\":\"Input\",\"props\":{\"label\":\"Name\",\"type\":true,\"value\":{\"$bindState\":\"/form/name\"}}}},\"state\":{\"form\":{\"name\":\"\"}}}",
        "{\"root\":\"root\",\"elements\":{\"root\":{\"type\":\"Input\",\"props\":{\"label\":\"Name\",\"type\":\"password\",\"value\":{\"$bindState\":\"/form/name\"}}}},\"state\":{\"form\":{\"name\":\"\"}}}",
        "{\"root\":\"root\",\"elements\":{\"root\":{\"type\":\"Select\",\"props\":{\"label\":\"Name\",\"options\":[\"good\"],\"value\":{\"$bindState\":\"/form/name\"}}}},\"state\":{\"form\":{\"name\":\"bad\"}}}",
        "{\"root\":\"root\",\"elements\":{\"root\":{\"type\":\"Input\",\"props\":{\"label\":\"Count\",\"type\":\"number\",\"min\":10,\"max\":1,\"value\":{\"$bindState\":\"/form/count\"}}}},\"state\":{\"form\":{\"count\":3}}}",
        "{\"root\":\"root\",\"elements\":{\"root\":{\"type\":\"Button\",\"props\":{\"action\":\"open-url\",\"label\":\"Open\"}}}}",
        "root = Metric(\"Total\", {amount * 3})",
    ] {
        assert!(compile(source, "Details").is_err(), "must reject {source}");
    }
    assert!(compile(&"x".repeat(65_537), "Details").is_err());
}
