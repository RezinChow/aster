//! PT0 translation corpus lock.
//!
//! The paired OpenAI/Anthropic fixtures under `tests/fixtures/translation/`
//! are the frozen conformance corpus for cross-protocol translation
//! (`PT0`/`PT1` in `docs/gateway-optimization-roadmap.md`). The corpus is
//! frozen before the translator exists: implementation must satisfy these
//! pairs, never the other way around. Every field that cannot survive
//! translation is named in the fixture's `loss_ledger_entries` — an
//! unlisted loss is a contract violation.

use std::collections::HashSet;
use std::fs;
use std::path::Path;

const CORPUS_DIR: &str = "tests/fixtures/translation";

fn corpus_files() -> Vec<String> {
    let mut names = fs::read_dir(CORPUS_DIR)
        .unwrap_or_else(|error| panic!("translation corpus dir must list: {error}"))
        .filter_map(|entry| {
            let path = entry.expect("corpus entry").path();
            if path
                .extension()
                .is_some_and(|extension| extension == "json")
            {
                path.file_stem()
                    .map(|stem| stem.to_string_lossy().into_owned())
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    names.sort();
    assert!(!names.is_empty(), "translation corpus must not be empty");
    names
}

fn load(name: &str) -> serde_json::Value {
    let path = Path::new(CORPUS_DIR).join(format!("{name}.json"));
    let bytes = fs::read(&path).unwrap_or_else(|error| panic!("{name}: {error}"));
    serde_json::from_slice(&bytes).unwrap_or_else(|error| panic!("{name}: invalid JSON: {error}"))
}

#[test]
fn corpus_pairs_are_well_formed_and_uniquely_named() {
    let mut seen = HashSet::new();
    for name in corpus_files() {
        let fixture = load(&name);
        assert_eq!(
            fixture["name"], name,
            "{name}: fixture name must match its filename"
        );
        assert!(
            seen.insert(
                fixture["name"]
                    .as_str()
                    .expect("name is a string")
                    .to_string()
            ),
            "{name}: duplicate corpus name"
        );
        let description = fixture["description"]
            .as_str()
            .unwrap_or_else(|| panic!("{name}: every corpus pair carries a description"));
        assert!(description.len() >= 20, "{name}: description is too thin");

        for dialect in ["openai", "anthropic"] {
            let body = &fixture[dialect];
            assert!(body.is_object(), "{name}: {dialect} body must be an object");
            assert_eq!(
                body["model"], "chat-model",
                "{name}: {dialect} keeps the resolved model alias"
            );
            assert!(
                body["messages"]
                    .as_array()
                    .is_some_and(|messages| !messages.is_empty()),
                "{name}: {dialect} carries at least one message"
            );
        }
    }
}

#[test]
fn every_untranslatable_field_is_ledgered() {
    for name in corpus_files() {
        let fixture = load(&name);
        let entries = fixture["loss_ledger_entries"].as_array();
        if let Some(entries) = entries {
            assert!(
                !entries.is_empty(),
                "{name}: loss_ledger_entries present but empty"
            );
            for entry in entries {
                let entry = entry
                    .as_str()
                    .unwrap_or_else(|| panic!("{name}: loss ledger entries are strings"));
                let (field, _) = entry
                    .split_once(':')
                    .unwrap_or_else(|| panic!("{name}: entry '{entry}' names its field"));
                assert!(!field.is_empty(), "{name}: entry '{entry}' names its field");
            }
        }
        // A pair whose bodies differ beyond the ledgered fields must say so:
        // fixtures with zero entries must be information-preserving in both
        // directions. Leading OpenAI system messages hoist into Anthropic's
        // top-level `system` field — loss-free, so they are excluded from
        // the count before comparing.
        if entries.is_none() {
            let openai = &fixture["openai"];
            let anthropic = &fixture["anthropic"];
            let openai_messages = openai["messages"].as_array().expect("messages");
            let hoisted_system = openai_messages
                .iter()
                .take_while(|message| message["role"] == "system")
                .count();
            assert_eq!(
                Some(openai_messages.len() - hoisted_system),
                anthropic["messages"].as_array().map(Vec::len),
                "{name}: ledger-free pairs preserve the message count (system hoist aside)"
            );
            assert_eq!(
                openai["max_tokens"], anthropic["max_tokens"],
                "{name}: ledger-free pairs preserve max_tokens"
            );
        }
    }
}
