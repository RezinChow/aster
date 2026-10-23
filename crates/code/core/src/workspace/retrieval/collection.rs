//! Complete literal collection queries over the existing immutable source catalog.
//! Agent lexical Top-K limits and candidate ranking do not bound this operation.

use super::{ChunkCatalogSnapshot, WorkspaceIndexError};
use crate::workspace::WorkspacePath;
use regex::Regex;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::ops::Range;
use std::sync::{LazyLock, Mutex};
use uuid::Uuid;

const MAX_PAGE_BYTES: usize = 256 * 1024;
const MAX_SKIPPED_PATH_BYTES: usize = 16 * 1024;
const MAX_TAG_BYTES: usize = 8 * 1024;
const MAX_CURSORS: usize = 128;

#[derive(Debug, thiserror::Error)]
pub enum WorkspaceCollectionError {
    #[error("{0}")]
    InvalidRequest(&'static str),
    #[error("collection cursor is invalid, expired or belongs to another query snapshot")]
    InvalidCursor,
    #[error("collection cursor storage is unavailable")]
    Unavailable,
    #[error(transparent)]
    Index(#[from] WorkspaceIndexError),
}

macro_rules! closed_set {
    ($name:ident { $($variant:ident => $wire:literal),+ $(,)? }) => {
        #[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
        pub enum $name { $(#[serde(rename = $wire)] $variant),+ }
        impl $name {
            pub fn as_str(self) -> &'static str { match self { $(Self::$variant => $wire),+ } }
            pub fn parse(value: &str) -> Result<Self, WorkspaceCollectionError> {
                match value { $($wire => Ok(Self::$variant),)+ _ => Err(WorkspaceCollectionError::InvalidRequest(concat!(stringify!($name), " refuses an unknown value"))) }
            }
        }
    };
}
closed_set!(WorkspaceCollectionSort { Relevance => "relevance", Path => "path", Modified => "modified" });
closed_set!(WorkspaceCollectionOrder { Asc => "asc", Desc => "desc" });
closed_set!(WorkspaceCollectionMatch { Title => "title", Path => "path", Body => "body" });

#[derive(Clone, Debug)]
pub struct WorkspaceCollectionRequest {
    pub search: String,
    pub folder: Option<String>,
    pub tag: Option<String>,
    pub sort_by: WorkspaceCollectionSort,
    pub sort_order: WorkspaceCollectionOrder,
    pub cursor: Option<String>,
    pub limit: usize,
}
impl Default for WorkspaceCollectionRequest {
    fn default() -> Self {
        Self {
            search: String::new(),
            folder: None,
            tag: None,
            sort_by: WorkspaceCollectionSort::Relevance,
            sort_order: WorkspaceCollectionOrder::Asc,
            cursor: None,
            limit: 20,
        }
    }
}

/// UTF-8 offsets in the addressed source/context. Hosts map them to their editor's coordinate system.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct WorkspaceCollectionTextRange {
    pub start: usize,
    pub end: usize,
}

#[derive(Clone, Debug, Serialize)]
pub struct WorkspaceCollectionHit {
    pub path: String,
    pub title: String,
    pub content_digest: String,
    pub modified_ms: Option<u64>,
    pub matched_field: WorkspaceCollectionMatch,
    pub context: String,
    pub context_range: WorkspaceCollectionTextRange,
    pub source_range: Option<WorkspaceCollectionTextRange>,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceCollectionPage {
    pub scope: String,
    pub catalog_revision: u64,
    pub source_revision: u64,
    /// This is the admitted snapshot's count, not a claim of complete filesystem discovery.
    pub matched_files: usize,
    pub indexed_files: usize,
    pub eligible_files: usize,
    pub failed_files: usize,
    pub metadata_skipped_files: usize,
    pub metadata_skipped_paths: Vec<String>,
    pub tags: Vec<String>,
    pub tags_capped: bool,
    pub hits: Vec<WorkspaceCollectionHit>,
    pub next_cursor: Option<String>,
}

#[derive(Clone, PartialEq, Eq)]
struct Cursor {
    query: [u8; 32],
    offset: usize,
}
#[derive(Default)]
struct Cursors {
    values: BTreeMap<Uuid, Cursor>,
    order: VecDeque<Uuid>,
}

/// A passive owner-scoped snapshot. It starts no filesystem watcher or provider call.
/// A host retains this object while paging and replaces it when admitting a new generation.
pub struct WorkspaceCollectionQuery {
    snapshot: ChunkCatalogSnapshot,
    scope: String,
    cursors: Mutex<Cursors>,
}

impl WorkspaceCollectionQuery {
    pub fn new(
        snapshot: ChunkCatalogSnapshot,
        scope: String,
    ) -> Result<Self, WorkspaceCollectionError> {
        if scope.is_empty() || scope.len() > 256 || scope.contains('\0') {
            return Err(WorkspaceCollectionError::InvalidRequest(
                "collection scope must be a nonempty bounded owner identity",
            ));
        }
        Ok(Self {
            snapshot,
            scope,
            cursors: Mutex::default(),
        })
    }

    pub fn query(
        &self,
        request: &WorkspaceCollectionRequest,
    ) -> Result<WorkspaceCollectionPage, WorkspaceCollectionError> {
        if request.search.chars().count() > 512
            || request.search.contains('\0')
            || !(1..=100).contains(&request.limit)
        {
            return Err(WorkspaceCollectionError::InvalidRequest(
                "collection search permits at most 512 characters and a limit from 1 to 100",
            ));
        }
        if request
            .folder
            .as_ref()
            .is_some_and(|folder| !safe_folder(folder))
            || request.tag.as_ref().is_some_and(|tag| {
                tag.is_empty() || tag.chars().count() > 128 || tag.contains('\0')
            })
        {
            return Err(WorkspaceCollectionError::InvalidRequest(
                "collection folder or tag is invalid",
            ));
        }
        let query = fingerprint(request);
        let offset = match &request.cursor {
            None => 0,
            Some(value) => {
                let id =
                    Uuid::parse_str(value).map_err(|_| WorkspaceCollectionError::InvalidCursor)?;
                let guard = self
                    .cursors
                    .lock()
                    .map_err(|_| WorkspaceCollectionError::Unavailable)?;
                let cursor = guard
                    .values
                    .get(&id)
                    .filter(|cursor| cursor.query == query)
                    .ok_or(WorkspaceCollectionError::InvalidCursor)?;
                cursor.offset
            }
        };
        let search = request.search.trim().to_lowercase();
        let mut matches = Vec::new();
        let mut skipped = Vec::new();
        let mut skipped_count = 0;
        let mut skipped_bytes = 0;
        let mut tags = BTreeSet::new();
        let mut tag_bytes = 0;
        let mut tags_capped = false;
        for (path, file) in &self.snapshot.state.files {
            if request
                .folder
                .as_ref()
                .is_some_and(|folder| !path.starts_with(&format!("{folder}/")))
            {
                continue;
            }
            let source = self
                .snapshot
                .source_text(&WorkspacePath::from_normalized(path))?
                .ok_or_else(|| {
                    WorkspaceCollectionError::InvalidRequest(
                        "catalog source disappeared from an immutable snapshot",
                    )
                })?;
            let Some(metadata) = metadata(path, &source) else {
                skipped_count += 1;
                let size = json_size(path)? + 1;
                if skipped.len() < 20 && skipped_bytes + size <= MAX_SKIPPED_PATH_BYTES {
                    skipped.push(path.clone());
                    skipped_bytes += size;
                }
                continue;
            };
            for tag in &metadata.tags {
                if tags.contains(tag) {
                    continue;
                }
                let size = json_size(tag)? + 1;
                if tags.len() < 128 && tag_bytes + size <= MAX_TAG_BYTES {
                    tags.insert(tag.clone());
                    tag_bytes += size;
                } else {
                    tags_capped = true;
                }
            }
            if request
                .tag
                .as_ref()
                .is_some_and(|tag| !metadata.tags.contains(tag))
            {
                continue;
            }
            let (matched_field, matched, text, source_range) = if search.is_empty() {
                (
                    WorkspaceCollectionMatch::Title,
                    0..0,
                    metadata.title.as_str(),
                    None,
                )
            } else if let Some(range) = literal_match(&metadata.title, &search) {
                (
                    WorkspaceCollectionMatch::Title,
                    range,
                    metadata.title.as_str(),
                    None,
                )
            } else if let Some(range) = literal_match(path, &search) {
                (WorkspaceCollectionMatch::Path, range, path.as_str(), None)
            } else if let Some(range) = literal_match(&source, &search) {
                let source_range = Some(WorkspaceCollectionTextRange {
                    start: range.start,
                    end: range.end,
                });
                (
                    WorkspaceCollectionMatch::Body,
                    range,
                    source.as_str(),
                    source_range,
                )
            } else {
                continue;
            };
            let (context, context_range) = context(text, matched);
            matches.push(WorkspaceCollectionHit {
                path: path.clone(),
                title: metadata.title,
                content_digest: file.content_digest.to_string(),
                modified_ms: file.manifest.modified_ms,
                matched_field,
                context,
                context_range,
                source_range,
            });
        }
        matches.sort_by(|a, b| {
            let order = match request.sort_by {
                WorkspaceCollectionSort::Path => a.path.cmp(&b.path),
                WorkspaceCollectionSort::Relevance => {
                    rank(a.matched_field).cmp(&rank(b.matched_field))
                }
                WorkspaceCollectionSort::Modified => match (a.modified_ms, b.modified_ms) {
                    (Some(a), Some(b)) => a.cmp(&b),
                    (None, None) => std::cmp::Ordering::Equal,
                    (None, Some(_)) => return std::cmp::Ordering::Greater,
                    (Some(_), None) => return std::cmp::Ordering::Less,
                },
            };
            let order = if request.sort_order == WorkspaceCollectionOrder::Desc {
                order.reverse()
            } else {
                order
            };
            order.then_with(|| a.path.cmp(&b.path))
        });
        if offset > matches.len() {
            return Err(WorkspaceCollectionError::InvalidCursor);
        }
        let matched_files = matches.len();
        let mut page = WorkspaceCollectionPage {
            scope: self.scope.clone(),
            catalog_revision: self.snapshot.revision(),
            source_revision: self.snapshot.source_revision(),
            matched_files,
            indexed_files: self.snapshot.file_count(),
            eligible_files: self.snapshot.eligible_file_count(),
            failed_files: self.snapshot.failed_file_count(),
            metadata_skipped_files: skipped_count,
            metadata_skipped_paths: skipped,
            tags: tags.into_iter().collect(),
            tags_capped,
            hits: Vec::new(),
            next_cursor: Some(Uuid::nil().to_string()),
        };
        // Reserve the full cursor and all metadata before admitting rows.
        let mut bytes = json_size(&page)?;
        for hit in matches.into_iter().skip(offset).take(request.limit) {
            let size = json_size(&hit)? + usize::from(!page.hits.is_empty());
            if bytes + size > MAX_PAGE_BYTES {
                break;
            }
            bytes += size;
            page.hits.push(hit);
        }
        let next_offset = offset + page.hits.len();
        if next_offset == offset && next_offset < matched_files {
            return Err(WorkspaceCollectionError::InvalidRequest(
                "a collection row exceeds the page budget",
            ));
        }
        page.next_cursor = if next_offset < matched_files {
            Some(self.cursor(Cursor {
                query,
                offset: next_offset,
            })?)
        } else {
            None
        };
        Ok(page)
    }

    fn cursor(&self, cursor: Cursor) -> Result<String, WorkspaceCollectionError> {
        let mut guard = self
            .cursors
            .lock()
            .map_err(|_| WorkspaceCollectionError::Unavailable)?;
        if let Some((id, _)) = guard.values.iter().find(|(_, value)| **value == cursor) {
            return Ok(id.to_string());
        }
        let id = Uuid::new_v4();
        guard.values.insert(id, cursor);
        guard.order.push_back(id);
        while guard.order.len() > MAX_CURSORS {
            if let Some(old) = guard.order.pop_front() {
                guard.values.remove(&old);
            }
        }
        Ok(id.to_string())
    }
}

fn json_size(value: &(impl Serialize + ?Sized)) -> Result<usize, WorkspaceCollectionError> {
    serde_json::to_vec(value)
        .map(|bytes| bytes.len())
        .map_err(|_| WorkspaceCollectionError::Unavailable)
}

fn rank(value: WorkspaceCollectionMatch) -> u8 {
    match value {
        WorkspaceCollectionMatch::Title => 0,
        WorkspaceCollectionMatch::Path => 1,
        WorkspaceCollectionMatch::Body => 2,
    }
}
fn safe_folder(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 4096
        && !value.contains(['\\', '\0'])
        && value
            .split('/')
            .all(|part| !part.is_empty() && part != "." && part != "..")
}
fn fingerprint(request: &WorkspaceCollectionRequest) -> [u8; 32] {
    let mut hash = Sha256::new();
    for part in [
        request.search.as_str(),
        request.folder.as_deref().unwrap_or(""),
        request.tag.as_deref().unwrap_or(""),
        request.sort_by.as_str(),
        request.sort_order.as_str(),
    ] {
        hash.update((part.len() as u64).to_be_bytes());
        hash.update(part.as_bytes());
    }
    hash.update((request.limit as u64).to_be_bytes());
    hash.finalize().into()
}

struct Metadata {
    title: String,
    tags: BTreeSet<String>,
}
fn metadata(path: &str, source: &str) -> Option<Metadata> {
    let name = path.rsplit('/').next().unwrap_or(path);
    let mut title = name
        .strip_suffix(".markdown")
        .or_else(|| name.strip_suffix(".md"))
        .unwrap_or(name)
        .to_owned();
    let mut tags = BTreeSet::new();
    if source.starts_with("---\n") || source.starts_with("---\r\n") {
        let mut offset = source.find('\n')? + 1;
        let start = offset;
        let mut end = None;
        for line in source[start..].split_inclusive('\n') {
            if line.trim_end_matches(['\r', '\n']) == "---" {
                end = Some(offset);
                break;
            }
            offset += line.len();
            if offset - start > 64 * 1024 {
                return None;
            }
        }
        if let Some(end) = end {
            let value: serde_yaml::Value = serde_yaml::from_str(&source[start..end]).ok()?;
            if !value.is_mapping() && !value.is_null() {
                return None;
            }
            if let Some(value) = value.get("title").filter(|value| !value.is_null()) {
                title = value.as_str()?.to_owned();
            }
            if let Some(value) = value.get("tags").filter(|value| !value.is_null()) {
                match value {
                    serde_yaml::Value::String(tag) => {
                        tags.insert(tag.clone());
                    }
                    serde_yaml::Value::Sequence(values) => {
                        for value in values {
                            tags.insert(value.as_str()?.to_owned());
                        }
                    }
                    _ => return None,
                }
            }
        }
    }
    // This is the existing explicit #tag grammar, not inferred entity extraction.
    static TAG: LazyLock<Regex> = LazyLock::new(|| {
        // The fixed Unicode property/classes are valid regex syntax by construction.
        Regex::new(r"(?:^|[\s(\[{])#([\p{L}\p{N}_-]{1,40})").expect("static written-tag grammar")
    });
    for captures in TAG.captures_iter(source) {
        if let Some(tag) = captures.get(1) {
            tags.insert(tag.as_str().to_owned());
        }
    }
    if title.chars().count() > 512
        || title.contains(['\n', '\r', '\0'])
        || tags.len() > 128
        || tags
            .iter()
            .any(|tag| tag.is_empty() || tag.chars().count() > 128 || tag.contains('\0'))
    {
        return None;
    }
    Some(Metadata { title, tags })
}

fn literal_match(text: &str, query: &str) -> Option<Range<usize>> {
    let folded = text.to_lowercase();
    let start = folded.find(query)?;
    let end = start + query.len();
    let mut offset = 0;
    let mut from = None;
    for (byte, ch) in text.char_indices() {
        let next = offset + ch.to_lowercase().map(char::len_utf8).sum::<usize>();
        if from.is_none() && start < next {
            from = Some(byte);
        }
        if end <= next {
            return Some(from?..byte + ch.len_utf8());
        }
        offset = next;
    }
    None
}
fn context(text: &str, range: Range<usize>) -> (String, WorkspaceCollectionTextRange) {
    let start = text[..range.start]
        .char_indices()
        .rev()
        .nth(39)
        .map_or(0, |(at, _)| at);
    let end = text[start..]
        .char_indices()
        .nth(200)
        .map_or(text.len(), |(at, _)| start + at);
    (
        text[start..end].to_owned(),
        WorkspaceCollectionTextRange {
            start: range.start - start,
            end: range.end.min(end) - start,
        },
    )
}

#[cfg(test)]
#[path = "collection_tests.rs"]
mod tests;
