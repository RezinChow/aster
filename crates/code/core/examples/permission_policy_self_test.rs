//! Load a permission policy JSON/YAML file and exit non-zero when embedded
//! `match` / `not_match` self-tests fail (or the document cannot parse).
//!
//! Usage:
//!   cargo run -p aster-core --example permission_policy_self_test -- <path>
//!
//! Exit codes: 0 = ok, 1 = usage/IO, 2 = validation/parse failure.

use aster_core::permissions::PermissionPolicy;
use std::env;
use std::fs;
use std::path::Path;
use std::process::ExitCode;

fn load_policy(path: &Path) -> Result<PermissionPolicy, String> {
    let raw = fs::read_to_string(path).map_err(|err| format!("read {}: {err}", path.display()))?;
    let ext = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let policy: PermissionPolicy = if matches!(ext.as_str(), "yaml" | "yml") {
        serde_yaml::from_str(&raw).map_err(|err| format!("yaml: {err}"))?
    } else {
        serde_json::from_str(&raw).map_err(|err| format!("json: {err}"))?
    };
    policy
        .validate_rule_examples()
        .map_err(|err| format!("self-test: {err}"))?;
    Ok(policy)
}

fn main() -> ExitCode {
    let mut args = env::args().skip(1);
    let Some(path) = args.next() else {
        eprintln!("usage: permission_policy_self_test <policy.json|yaml>");
        return ExitCode::from(1);
    };
    if args.next().is_some() {
        eprintln!("usage: permission_policy_self_test <policy.json|yaml>");
        return ExitCode::from(1);
    }
    match load_policy(Path::new(&path)) {
        Ok(_) => {
            println!("ok: {}", path);
            ExitCode::SUCCESS
        }
        Err(err) => {
            eprintln!("error: {err}");
            ExitCode::from(2)
        }
    }
}
