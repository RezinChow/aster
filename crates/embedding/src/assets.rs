//! Embedded model assets with pinned digests (fail-closed on drift).

use sha2::{Digest, Sha256};

pub const MODEL_BYTES: &[u8] = include_bytes!("../assets/potion-code-16M-v2.safetensors");
pub const TOKENIZER_BYTES: &[u8] = include_bytes!("../assets/potion-code-16M-v2.tokenizer.json");
pub const CONFIG_BYTES: &[u8] = include_bytes!("../assets/potion-code-16M-v2.config.json");

pub const MODEL_SHA256: &str = "75cf7a6c2171b230ad19b1e7d8e0b1aee86da5a02af8e7cacedd9921d227623c";
pub const TOKENIZER_SHA256: &str =
    "107bbdcbad4bff1d299b7a4c3a2fb17c52890688b7dd0e4c9deab79d3c4f3d45";

pub const MODEL_ID: &str = "potion-code-16M-v2";

/// Refuse load when an embedded asset drifted from its pinned digest. The
/// assets are compile-time constants, so this is a build-integrity check,
/// not a runtime download check.
pub fn verify() -> Result<(), String> {
    let actual = hex(&Sha256::digest(MODEL_BYTES));
    if actual != MODEL_SHA256 {
        return Err(format!(
            "model asset sha256 drift: pinned {MODEL_SHA256}, compiled {actual}"
        ));
    }
    let actual = hex(&Sha256::digest(TOKENIZER_BYTES));
    if actual != TOKENIZER_SHA256 {
        return Err(format!(
            "tokenizer asset sha256 drift: pinned {TOKENIZER_SHA256}, compiled {actual}"
        ));
    }
    Ok(())
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}
