use super::*;
use crate::views::elicitation_view::{ElicitationStage, ElicitationViewState, FieldValueUi};

const FORM: &str = r#"root = Card("Details", [name, amount, ready, choice, notes, submit])
name = Input("name", "Name", "", "text", null, null, null, true)
amount = Input("amount", "Amount", 3, "number", 1, 5)
ready = Checkbox("ready", "Ready", false, true)
choice = Select("choice", "Choice", "beta", ["alpha", "beta"], true)
notes = Textarea("notes", "Notes")
submit = Button("submit", "Continue")"#;

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
        "root = Stack([root])",
        "root = Card(\"x\", [missing])",
        "root = Widget(\"x\")",
        "root = Input(\"name\", \"Name\")\nother = env(\"SECRET\")",
        "root = Card(\"x\", [a, b])\na = Input(\"name\", \"A\")\nb = Input(\"name\", \"B\")",
        "root = Input(\"constructor\", \"Name\")",
        "root = Input(\"name\", \"Name\", false)",
        "root = Input(\"name\", \"Name\", \"\", true)",
        "root = Input(\"name\", \"Name\", \"\", \"password\")",
        "root = Select(\"name\", \"Name\", \"bad\", [\"good\"])",
        "root = Input(\"count\", \"Count\", 3, \"number\", 10, 1)",
        "root = Button(\"open-url\", \"Open\")",
        "root = Metric(\"Total\", {amount * 3})",
    ] {
        assert!(compile(source, "Details").is_err(), "must reject {source}");
    }
    assert!(compile(&"x".repeat(65_537), "Details").is_err());
}
