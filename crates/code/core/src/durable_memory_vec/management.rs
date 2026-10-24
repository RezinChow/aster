//! Bounded inspection and conditional deletion through the live memory owner.

use super::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

const PAGE_SIZE: usize = 50;
const MAX_RECORDS: usize = 10_000;
const MAX_RECORD_BYTES: usize = 64 * 1024;
const MAX_SCAN_BYTES: usize = 16 * 1024 * 1024;

macro_rules! closed_set {
    ($name:ident { $($variant:ident => $wire:literal),+ $(,)? }) => {
        #[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
        pub enum $name { $(#[serde(rename = $wire)] $variant),+ }
        impl $name {
            pub fn parse(value: &str) -> Option<Self> { match value { $($wire => Some(Self::$variant),)+ _ => None } }
            pub fn as_str(self) -> &'static str { match self { $(Self::$variant => $wire),+ } }
        }
    };
}
closed_set!(StoredMemoryType { Episodic => "episodic", Semantic => "semantic", Procedural => "procedural", Working => "working" });
closed_set!(MemoryManagementCode { Invalid => "invalid", Missing => "missing", Busy => "busy", Conflict => "conflict", Limit => "limit", Failed => "failed" });

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MemoryManagementFailure {
    pub code: MemoryManagementCode,
    pub message: String,
}
impl MemoryManagementFailure {
    pub fn new(code: MemoryManagementCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
    fn failed(error: impl std::fmt::Display) -> Self {
        Self::new(MemoryManagementCode::Failed, error.to_string())
    }
}
impl std::fmt::Display for MemoryManagementFailure {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {}", self.code.as_str(), self.message)
    }
}
impl std::error::Error for MemoryManagementFailure {}
type ManagementResult<T> = std::result::Result<T, MemoryManagementFailure>;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum MemoryManagementRequest {
    List {
        query: String,
        memory_type: Option<StoredMemoryType>,
        cursor: Option<String>,
    },
    Read {
        id: String,
    },
    Delete {
        id: String,
        revision: String,
    },
}
impl MemoryManagementRequest {
    pub fn parse(raw: &str) -> ManagementResult<Self> {
        let request: Self = serde_json::from_str(raw).map_err(|_| {
            MemoryManagementFailure::new(
                MemoryManagementCode::Invalid,
                "memory request refuses unknown fields, operations or types",
            )
        })?;
        request.validate()?;
        Ok(request)
    }
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::List { .. } => "list",
            Self::Read { .. } => "read",
            Self::Delete { .. } => "delete",
        }
    }
    pub fn validate(&self) -> ManagementResult<()> {
        let invalid = || {
            MemoryManagementFailure::new(
                MemoryManagementCode::Invalid,
                "memory request exceeds its bounds or has an invalid revision",
            )
        };
        match self {
            Self::List { query, cursor, .. }
                if query.len() > 1024 || cursor.as_ref().is_some_and(|value| value.len() > 512) =>
            {
                Err(invalid())
            }
            Self::Read { id } | Self::Delete { id, .. }
                if id.is_empty() || id.len() > 256 || id.contains('\0') =>
            {
                Err(invalid())
            }
            Self::Delete { revision, .. }
                if revision.len() != 64
                    || !revision
                        .bytes()
                        .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase()) =>
            {
                Err(invalid())
            }
            _ => Ok(()),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ManagedMemory {
    pub id: String,
    pub content: String,
    pub tags: Vec<String>,
    pub importance: f32,
    pub memory_type: StoredMemoryType,
    pub timestamp: String,
    pub metadata: BTreeMap<String, String>,
    pub access_count: u32,
    pub last_accessed: Option<String>,
    pub revision: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum MemoryManagementResponse {
    List {
        items: Vec<ManagedMemory>,
        total: usize,
        next_cursor: Option<String>,
    },
    Read {
        item: ManagedMemory,
    },
    Delete {
        id: String,
    },
}
impl MemoryManagementResponse {
    pub fn parse(raw: &str) -> ManagementResult<Self> {
        serde_json::from_str(raw).map_err(MemoryManagementFailure::failed)
    }
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::List { .. } => "list",
            Self::Read { .. } => "read",
            Self::Delete { .. } => "delete",
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Cursor {
    generation: u64,
    filter: String,
    offset: usize,
}

#[derive(Deserialize, Default)]
#[serde(default, deny_unknown_fields)]
struct InspectedMeta {
    metadata: BTreeMap<String, String>,
    access_count: u32,
    last_accessed: Option<String>,
}

fn digest(value: &[u8]) -> String {
    format!("{:x}", Sha256::digest(value))
}

fn inspect(document: &Doc, path: &Path) -> ManagementResult<ManagedMemory> {
    let decode = |error: anyhow::Error| MemoryManagementFailure::failed(error);
    let string = |field| {
        document
            .get_string(field)
            .map_err(MemoryManagementFailure::failed)?
            .ok_or_else(|| {
                MemoryManagementFailure::failed(format!("memory record omitted {field}"))
            })
    };
    let content = string("content")?;
    let tags = string("tags")?;
    let timestamp = string("timestamp")?;
    let memory_type = string("memory_type")?;
    let meta_raw = string("meta")?;
    let id = memory_id(document).map_err(decode)?;
    let importance = document
        .get_f32("importance")
        .map_err(MemoryManagementFailure::failed)?
        .ok_or_else(|| MemoryManagementFailure::failed("memory record omitted importance"))?;
    if id.is_empty()
        || id.len() > 256
        || !importance.is_finite()
        || !(0.0..=1.0).contains(&importance)
        || content.len() + tags.len() + meta_raw.len() > MAX_RECORD_BYTES
    {
        return Err(MemoryManagementFailure::new(
            MemoryManagementCode::Limit,
            "memory record exceeds inspection limits",
        ));
    }
    DateTime::parse_from_rfc3339(&timestamp).map_err(MemoryManagementFailure::failed)?;
    let kind: String =
        serde_json::from_str(&memory_type).map_err(MemoryManagementFailure::failed)?;
    let kind = StoredMemoryType::parse(&kind).ok_or_else(|| {
        MemoryManagementFailure::failed("memory record has an unknown stored type")
    })?;
    let meta: InspectedMeta =
        serde_json::from_str(&meta_raw).map_err(MemoryManagementFailure::failed)?;
    if let Some(stamp) = &meta.last_accessed {
        DateTime::parse_from_rfc3339(stamp).map_err(MemoryManagementFailure::failed)?;
    }
    let revision = digest(
        &serde_json::to_vec(&(
            path.to_string_lossy(),
            &id,
            &content,
            &tags,
            importance.to_bits(),
            &memory_type,
            &timestamp,
            &meta_raw,
        ))
        .map_err(MemoryManagementFailure::failed)?,
    );
    let item = ManagedMemory {
        id,
        content,
        tags: tags.split_whitespace().map(str::to_owned).collect(),
        importance,
        memory_type: kind,
        timestamp,
        metadata: meta.metadata,
        access_count: meta.access_count,
        last_accessed: meta.last_accessed,
        revision,
    };
    if serde_json::to_vec(&item)
        .map_err(MemoryManagementFailure::failed)?
        .len()
        > MAX_RECORD_BYTES
    {
        return Err(MemoryManagementFailure::new(
            MemoryManagementCode::Limit,
            "memory detail exceeds inspection limits",
        ));
    }
    Ok(item)
}

impl VecMemoryStore {
    pub fn manage(
        &self,
        request: MemoryManagementRequest,
    ) -> ManagementResult<MemoryManagementResponse> {
        request.validate()?;
        let _mutation = self
            .mutation
            .lock()
            .map_err(|_| MemoryManagementFailure::failed("memory mutation lock is poisoned"))?;
        let stats = self
            .collection
            .stats()
            .map_err(MemoryManagementFailure::failed)?;
        if stats.accounted_document_bytes > MAX_SCAN_BYTES as u64
            || stats.doc_count > MAX_RECORDS as u64
        {
            return Err(MemoryManagementFailure::new(
                MemoryManagementCode::Limit,
                "memory catalog exceeds the inspection budget",
            ));
        }
        match request {
            MemoryManagementRequest::List {
                query,
                memory_type,
                cursor,
            } => {
                let documents = self
                    .collection
                    .iter_with_options(None, false)
                    .map_err(MemoryManagementFailure::failed)?;
                let generation = documents.revision();
                let query = query.trim().to_lowercase();
                let filter = digest(
                    &serde_json::to_vec(&(self.path.to_string_lossy(), &query, memory_type))
                        .map_err(MemoryManagementFailure::failed)?,
                );
                let offset = if let Some(raw) = cursor {
                    let cursor: Cursor = serde_json::from_str(&raw).map_err(|_| {
                        MemoryManagementFailure::new(
                            MemoryManagementCode::Invalid,
                            "memory cursor is invalid",
                        )
                    })?;
                    if cursor.generation != generation || cursor.filter != filter {
                        return Err(MemoryManagementFailure::new(
                            MemoryManagementCode::Conflict,
                            "memory catalog changed; refresh the list",
                        ));
                    }
                    cursor.offset
                } else {
                    0
                };
                let mut items = Vec::new();
                let mut bytes = 0usize;
                for document in documents {
                    let item = inspect(
                        &document.map_err(MemoryManagementFailure::failed)?,
                        &self.path,
                    )?;
                    bytes += serde_json::to_vec(&item)
                        .map_err(MemoryManagementFailure::failed)?
                        .len();
                    if bytes > MAX_SCAN_BYTES {
                        return Err(MemoryManagementFailure::new(
                            MemoryManagementCode::Limit,
                            "memory catalog exceeds 16 MiB inspection budget",
                        ));
                    }
                    if memory_type.is_none_or(|kind| kind == item.memory_type)
                        && (query.is_empty() || item.content.to_lowercase().contains(&query))
                    {
                        items.push(item);
                    }
                }
                items.sort_by(|a, b| a.id.cmp(&b.id));
                let total = items.len();
                if offset > total {
                    return Err(MemoryManagementFailure::new(
                        MemoryManagementCode::Invalid,
                        "memory cursor is outside the catalog",
                    ));
                }
                let mut end = offset;
                let mut page_bytes = 0usize;
                for item in items.iter().skip(offset).take(PAGE_SIZE) {
                    let next_bytes = serde_json::to_vec(item)
                        .map_err(MemoryManagementFailure::failed)?
                        .len();
                    if page_bytes + next_bytes > 256 * 1024 {
                        break;
                    }
                    page_bytes += next_bytes;
                    end += 1;
                }
                let next_cursor = if end < total {
                    Some(
                        serde_json::to_string(&Cursor {
                            generation,
                            filter,
                            offset: end,
                        })
                        .map_err(MemoryManagementFailure::failed)?,
                    )
                } else {
                    None
                };
                let items = items.into_iter().skip(offset).take(end - offset).collect();
                Ok(MemoryManagementResponse::List {
                    items,
                    total,
                    next_cursor,
                })
            }
            MemoryManagementRequest::Read { id } => Ok(MemoryManagementResponse::Read {
                item: self.inspect_id(&id)?,
            }),
            MemoryManagementRequest::Delete { id, revision } => {
                if self.read_only {
                    return Err(MemoryManagementFailure::new(
                        MemoryManagementCode::Busy,
                        "memory owner is read-only",
                    ));
                }
                if self.inspect_id(&id)?.revision != revision {
                    return Err(MemoryManagementFailure::new(
                        MemoryManagementCode::Conflict,
                        "memory record changed; inspect it again before deleting",
                    ));
                }
                self.delete_record(&id)
                    .map_err(MemoryManagementFailure::failed)?;
                Ok(MemoryManagementResponse::Delete { id })
            }
        }
    }

    fn inspect_id(&self, id: &str) -> ManagementResult<ManagedMemory> {
        let documents = self
            .collection
            .fetch_with_options(&[id], None, false)
            .map_err(MemoryManagementFailure::failed)?;
        let document = documents.first().ok_or_else(|| {
            MemoryManagementFailure::new(
                MemoryManagementCode::Missing,
                "memory record is unavailable",
            )
        })?;
        inspect(document, &self.path)
    }

    pub(super) fn delete_record(&self, id: &str) -> Result<()> {
        let documents = self
            .collection
            .fetch_with_options(&[id], Some(&[CONTENT_FIELD]), false)
            .map_err(display_error)?;
        let content = documents
            .first()
            .map(|document| document.get_string(CONTENT_FIELD))
            .transpose()
            .map_err(display_error)?
            .flatten();
        let mut hygiene = self
            .hygiene
            .lock()
            .map_err(|_| anyhow!("memory hygiene lock is poisoned"))?;
        let mut vectors = self
            .vectors
            .lock()
            .map_err(|_| anyhow!("memory vectors lock is poisoned"))?;
        let result = self.collection.delete(&[id]).map_err(display_error)?;
        if result.error_count != 0 {
            return Err(anyhow!("a3s-vec memory delete rejected {id}"));
        }
        if let Some(content) = content {
            let hash = <[u8; 32]>::from(Sha256::digest(content.trim().as_bytes()));
            hygiene.retain(|known| *known != hash);
        }
        vectors.retain(|(key, _)| key != id);
        self.collection.flush().map_err(display_error)?;
        Ok(())
    }
}

impl LazyFileMemoryStore {
    pub async fn manage(
        &self,
        request: MemoryManagementRequest,
    ) -> ManagementResult<MemoryManagementResponse> {
        request.validate()?;
        self.inner()
            .await
            .map_err(|error| {
                let message = error.to_string();
                let code = if message.contains("collection is locked") {
                    MemoryManagementCode::Busy
                } else {
                    MemoryManagementCode::Failed
                };
                MemoryManagementFailure::new(code, message)
            })?
            .manage(request)
    }
}

#[cfg(test)]
#[path = "management_tests.rs"]
mod tests;
