//! Host opt-in for reading another product's local login (`import_accounts`).
//!
//! An account import reads credentials that a different product stored on
//! this machine (a keychain item, an IDE database, a CLI auth file). It runs
//! only for the sources a host-trusted layer lists, so a default launch reads
//! none of them.

use serde::{Deserialize, Serialize};

/// One local account source a launcher may import models from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AccountImport {
    /// The current Claude providers in the CC Switch database.
    CcSwitch,
    /// The logged-in Grok CLI account (`~/.grok`).
    Grok,
    /// The logged-in Cursor account (CLI config, keychain or IDE state).
    Cursor,
    /// The logged-in WorkBuddy account (aster's own `login-workbuddy` store).
    Workbuddy,
    /// The logged-in Codex account (`~/.codex`, ChatGPT plan login).
    Codex,
}

impl AccountImport {
    pub const ALL: [Self; 5] = [
        Self::CcSwitch,
        Self::Grok,
        Self::Cursor,
        Self::Workbuddy,
        Self::Codex,
    ];

    pub fn parse(value: &str) -> Result<Self, String> {
        match value.trim() {
            "cc-switch" => Ok(Self::CcSwitch),
            "grok" => Ok(Self::Grok),
            "cursor" => Ok(Self::Cursor),
            "workbuddy" => Ok(Self::Workbuddy),
            "codex" => Ok(Self::Codex),
            other => Err(format!(
                "unknown account import {other:?} (closed set: cc-switch, grok, cursor, workbuddy, codex)"
            )),
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::CcSwitch => "cc-switch",
            Self::Grok => "grok",
            Self::Cursor => "cursor",
            Self::Workbuddy => "workbuddy",
            Self::Codex => "codex",
        }
    }

    /// Parse a comma-separated list (`cursor,grok`). Empty items are refused.
    pub fn parse_list(value: &str) -> Result<Vec<Self>, String> {
        let mut imports = Vec::new();
        for item in value.split(',') {
            let import = Self::parse(item)?;
            if !imports.contains(&import) {
                imports.push(import);
            }
        }
        Ok(imports)
    }
}

#[cfg(test)]
#[path = "account_import/tests.rs"]
mod tests;
