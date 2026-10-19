//! The local bge-m3 embedding engine.
//!
//! Lazy-loaded from the installed family directory, reloaded when that
//! directory changes, and always executed on the blocking pool behind a
//! mutex — the same contract the PP-OCRv6 provider follows.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use a3s_use_core::{UseError, UseResult};
use ort::session::builder::GraphOptimizationLevel;
use ort::session::Session;
use ort::value::TensorRef;

use crate::assets::{bge_status, resolve_family_assets, BgeRuntimeStatus, Family};
use crate::math::l2_normalize;
use crate::tokenizer::PairTokenizer;
use crate::wire::{EmbeddingItem, EmbeddingRequest, EmbeddingResponse, Usage};

const ENGINE_BATCH_SIZE: usize = 8;
const INPUT_IDS: &str = "input_ids";
const ATTENTION_MASK: &str = "attention_mask";

/// Client for the locally installed bge-m3 embedding model.
#[derive(Clone)]
pub struct EmbeddingClient {
    loaded: Arc<Mutex<Option<LoadedEngine>>>,
}

struct LoadedEngine {
    model_dir: PathBuf,
    install_stamp: String,
    engine: EmbeddingEngine,
}

struct EmbeddingEngine {
    session: Session,
    tokenizer: PairTokenizer,
    /// Some XLM-R exports declare a `token_type_ids` input even though the
    /// architecture ignores it; we feed zeros so such exports still load.
    token_type_input: Option<String>,
}

impl EmbeddingClient {
    pub fn from_env() -> UseResult<Self> {
        Ok(Self {
            loaded: Arc::new(Mutex::new(None)),
        })
    }

    pub fn status(&self) -> BgeRuntimeStatus {
        bge_status(Family::BgeM3)
    }

    /// Loads the ONNX session now so the first real request pays no load
    /// latency. Runs one tiny embedding; a missing install is returned, not
    /// panicked on.
    pub async fn warm(&self) -> UseResult<()> {
        let request = EmbeddingRequest {
            model: None,
            input: vec!["warm".to_string()],
        };
        self.embed(request).await.map(|_| ())
    }

    pub async fn embed(&self, request: EmbeddingRequest) -> UseResult<EmbeddingResponse> {
        let loaded = Arc::clone(&self.loaded);
        tokio::task::spawn_blocking(move || {
            let assets = resolve_family_assets(Family::BgeM3)?;
            let mut loaded = loaded.lock().map_err(|_| {
                UseError::new(
                    "use.bge.runtime_failed",
                    "The local bge-m3 engine lock is poisoned.",
                )
            })?;
            // A forced reinstall keeps the canonical path but changes the
            // receipt digest — the stamp, not the path, is the reload signal.
            let should_load = loaded
                .as_ref()
                .map(|loaded| {
                    loaded.model_dir != assets.root || loaded.install_stamp != assets.install_stamp
                })
                .unwrap_or(true);
            if should_load {
                *loaded = Some(LoadedEngine {
                    model_dir: assets.root.clone(),
                    install_stamp: assets.install_stamp.clone(),
                    engine: EmbeddingEngine::load(&assets.model_file, &assets.tokenizer_file)?,
                });
            }
            let engine = loaded.as_mut().ok_or_else(|| {
                UseError::new(
                    "use.bge.runtime_failed",
                    "The local bge-m3 engine failed to initialize.",
                )
            })?;
            let (mut embeddings, prompt_tokens) = engine.engine.embed_all(&request.input)?;
            embeddings.truncate(request.input.len());
            let mut data = Vec::with_capacity(embeddings.len());
            for (index, embedding) in embeddings.into_iter().enumerate() {
                data.push(EmbeddingItem {
                    object: "embedding",
                    index,
                    embedding,
                });
            }
            Ok(EmbeddingResponse {
                object: "list",
                data,
                model: request
                    .model
                    .clone()
                    .unwrap_or_else(|| Family::BgeM3.as_str().to_string()),
                usage: Usage {
                    prompt_tokens,
                    total_tokens: prompt_tokens,
                },
            })
        })
        .await
        .map_err(|error| {
            UseError::new(
                "use.bge.runtime_failed",
                format!("The local bge-m3 inference task failed: {error}"),
            )
        })?
    }
}

impl EmbeddingEngine {
    fn load(model_file: &Path, tokenizer_file: &Path) -> UseResult<Self> {
        let (session, token_type_input) = load_session(model_file)?;
        let tokenizer = PairTokenizer::load(tokenizer_file)?;
        Ok(Self {
            session,
            tokenizer,
            token_type_input,
        })
    }

    fn embed_all(&mut self, texts: &[String]) -> UseResult<(Vec<Vec<f32>>, u64)> {
        let mut embeddings = Vec::with_capacity(texts.len());
        let mut total_tokens = 0_u64;
        for batch in texts.chunks(ENGINE_BATCH_SIZE) {
            let (ids, mask, tokens) = self.tokenizer.encode_batch(batch)?;
            total_tokens += tokens;
            let rows = ids.len();
            let columns = ids.first().map(Vec::len).unwrap_or(0);
            let flat_ids = ids.into_iter().flatten().collect::<Vec<_>>();
            let flat_mask = mask.into_iter().flatten().collect::<Vec<_>>();
            let output = run_encoder(
                &mut self.session,
                &flat_ids,
                &flat_mask,
                rows,
                columns,
                self.token_type_input.as_deref(),
            )?;
            let hidden = output.hidden;
            let stride = columns.checked_mul(hidden).ok_or_else(|| {
                engine_error(
                    "use.bge.provider_output_invalid",
                    "The bge-m3 row stride overflowed.",
                )
            })?;
            for row in 0..rows {
                let start = row
                    .checked_mul(stride)
                    .filter(|offset| offset + hidden <= output.data.len())
                    .ok_or_else(|| {
                        engine_error(
                            "use.bge.provider_output_invalid",
                            "The bge-m3 CLS row escapes the output tensor.",
                        )
                    })?;
                let mut vector = output.data[start..start + hidden].to_vec();
                if vector.iter().any(|value| !value.is_finite()) {
                    return Err(engine_error(
                        "use.bge.provider_output_invalid",
                        "The bge-m3 encoder produced a non-finite hidden state.",
                    ));
                }
                l2_normalize(&mut vector);
                embeddings.push(vector);
            }
        }
        Ok((embeddings, total_tokens))
    }
}

fn load_session(path: &Path) -> UseResult<(Session, Option<String>)> {
    let session = Session::builder()
        .map_err(|error| runtime_error("create an ONNX Runtime session", error))?
        .with_optimization_level(GraphOptimizationLevel::Level3)
        .map_err(|error| runtime_error("configure graph optimization", error))?
        .commit_from_file(path)
        .map_err(|error| runtime_error("load the bge-m3 ONNX model", error))?;
    let names: Vec<&str> = session
        .inputs
        .iter()
        .map(|input| input.name.as_str())
        .collect();
    if !names.contains(&INPUT_IDS) || !names.contains(&ATTENTION_MASK) {
        return Err(engine_error(
            "use.bge.model_invalid",
            format!(
                "The bge-m3 model must expose '{INPUT_IDS}' and '{ATTENTION_MASK}' inputs; found {names:?}."
            ),
        ));
    }
    let token_type_input = names
        .iter()
        .find(|name| **name == "token_type_ids")
        .map(|name| (*name).to_string());
    Ok((session, token_type_input))
}

struct EncoderOutput {
    hidden: usize,
    data: Vec<f32>,
}

fn run_encoder(
    session: &mut Session,
    flat_ids: &[i64],
    flat_mask: &[i64],
    rows: usize,
    columns: usize,
    token_type_input: Option<&str>,
) -> UseResult<EncoderOutput> {
    let expected = rows
        .checked_mul(columns)
        .filter(|total| *total == flat_ids.len());
    if expected.is_none() || flat_ids.len() != flat_mask.len() {
        return Err(engine_error(
            "use.bge.provider_input_invalid",
            "The bge-m3 batch tensor length does not match its shape.",
        ));
    }
    let ids = TensorRef::from_array_view(([rows, columns], flat_ids))
        .map_err(|error| runtime_error("create the input_ids tensor", error))?;
    let mask = TensorRef::from_array_view(([rows, columns], flat_mask))
        .map_err(|error| runtime_error("create the attention_mask tensor", error))?;
    let outputs = match token_type_input {
        None => session
            .run(ort::inputs![INPUT_IDS => ids, ATTENTION_MASK => mask])
            .map_err(|error| runtime_error("run bge-m3 inference", error))?,
        Some(name) => {
            let zeros = vec![0_i64; flat_ids.len()];
            let token_types = TensorRef::from_array_view(([rows, columns], zeros.as_slice()))
                .map_err(|error| runtime_error("create the token_type_ids tensor", error))?;
            session
                .run(ort::inputs![INPUT_IDS => ids, ATTENTION_MASK => mask, name => token_types])
                .map_err(|error| runtime_error("run bge-m3 inference", error))?
        }
    };
    // Prefer the named hidden state; quantized exports sometimes keep extra
    // intermediate outputs.
    let fallback = outputs.values().next();
    let (shape, data): (Vec<i64>, Vec<f32>) = if let Some(output) = outputs.get("last_hidden_state")
    {
        let (shape, data) = output
            .try_extract_tensor::<f32>()
            .map_err(|error| runtime_error("read the bge-m3 output tensor", error))?;
        (shape.to_vec(), data.into())
    } else if let Some(output) = fallback {
        let (shape, data) = output
            .try_extract_tensor::<f32>()
            .map_err(|error| runtime_error("read the bge-m3 output tensor", error))?;
        (shape.to_vec(), data.into())
    } else {
        return Err(engine_error(
            "use.bge.provider_output_invalid",
            "The bge-m3 inference returned no output tensor.",
        ));
    };
    let shape = shape
        .iter()
        .map(|dimension| {
            usize::try_from(*dimension).map_err(|_| {
                engine_error(
                    "use.bge.provider_output_invalid",
                    format!("The bge-m3 output contains an invalid dimension {dimension}."),
                )
            })
        })
        .collect::<UseResult<Vec<_>>>()?;
    if shape.len() != 3 || shape[0] != rows || shape[1] != columns || shape[2] == 0 {
        return Err(engine_error(
            "use.bge.provider_output_invalid",
            format!(
                "The bge-m3 encoder output must be [batch, sequence, hidden]; found {shape:?}."
            ),
        ));
    }
    let dimensions = shape
        .iter()
        .try_fold(1_usize, |total, dimension| total.checked_mul(*dimension))
        .ok_or_else(|| {
            engine_error(
                "use.bge.provider_output_invalid",
                "The bge-m3 encoder output dimensions overflowed.",
            )
        })?;
    if dimensions != data.len() {
        return Err(engine_error(
            "use.bge.provider_output_invalid",
            "The bge-m3 encoder output length does not match its batch shape.",
        ));
    }
    Ok(EncoderOutput {
        hidden: shape[2],
        data: data.to_vec(),
    })
}

fn runtime_error(action: &str, error: impl std::fmt::Display) -> UseError {
    UseError::new(
        "use.bge.runtime_failed",
        format!("Failed to {action}: {error}"),
    )
}

fn engine_error(code: &str, message: impl Into<String>) -> UseError {
    UseError::new(code, message)
}
