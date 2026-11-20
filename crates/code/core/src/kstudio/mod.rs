//! Project AI-engineering layout roots (kburn / P15), internalized under
//! `.aster/` (canonical) with legacy `.kstudio/` fallback.
//!
//! Defaults match `kstudio.project-layout.v1` core paths. This module exposes
//! narratable Core paths for hosts to compose; it does not run the factory or
//! install skills by itself.

use std::path::{Path, PathBuf};

/// Vendored kburn layout contract (`kstudio.project-layout.v1` JSON Schema).
pub const KSTUDIO_PROJECT_LAYOUT_V1_JSON: &str = include_str!("kstudio-project-layout.v1.json");

/// Vendored kburn extension-pack contract (`kstudio.extension-pack.v1`).
pub const KSTUDIO_EXTENSION_PACK_V1_JSON: &str = include_str!("kstudio-extension-pack.v1.json");

/// Relative paths under the engineering root expected after a full factory drop
/// (subset; not the entire skeleton tree).
pub const KSTUDIO_FACTORY_SEED_PATHS: &[&str] = &[
    "MANIFEST.json",
    "project.acl",
    "project.acl.example",
    "workflow/GOALS.md",
    "workflow/HEAD",
    "workflow/sitrep.py",
    "workflow/progress-scan.py",
    "workflow/sync-k-skills.py",
    "workflow/print-paste.sh",
    "workflow/review-checks.json",
    "workflow/review.py",
    "workflow/loop-kstudio.py",
    "wiki/Home.md",
    "wiki/Tasks.md",
    "evidence/README.md",
    "skills",
];

/// Workflow helper scripts under `<eng-root>/workflow/` (also factory seeds).
pub const KSTUDIO_WORKFLOW_HELPERS: &[&str] = &[
    "sitrep.py",
    "progress-scan.py",
    "sync-k-skills.py",
    "print-paste.sh",
    "review.py",
    "loop-kstudio.py",
];

/// Absolute paths to present workflow helpers for `workspace`.
pub fn present_kstudio_workflow_helpers(workspace: &Path) -> Vec<PathBuf> {
    let workflow = KstudioCoreDirs::for_workspace(workspace).workflow;
    KSTUDIO_WORKFLOW_HELPERS
        .iter()
        .map(|name| workflow.join(name))
        .filter(|path| path.is_file())
        .collect()
}

/// Aster product directory at the workspace root (canonical engineering home).
pub const ASTER_DIR: &str = ".aster";
/// Legacy portable engineering root (kburn default).
pub const KSTUDIO_DIR: &str = ".kstudio";
pub const CORE_WORKFLOW: &str = "workflow";
pub const CORE_WORKFLOWS: &str = "workflows";
pub const CORE_EVIDENCE: &str = "evidence";
pub const CORE_WIKI: &str = "wiki";
pub const CORE_LANES: &str = "lanes";
pub const CORE_MIGRATION: &str = "migration";
pub const CORE_SKILLS: &str = "skills";

/// Canonical Aster-native engineering root: `workspace/.aster`.
pub fn canonical_kstudio_root(workspace: &Path) -> PathBuf {
    workspace.join(ASTER_DIR)
}

/// Legacy portable root: `workspace/.kstudio`.
pub fn legacy_kstudio_root(workspace: &Path) -> PathBuf {
    workspace.join(KSTUDIO_DIR)
}

/// True when `.aster` already holds engineering layout markers (not merely
/// `config.acl` / incidental files).
pub fn aster_engineering_present(aster_root: &Path) -> bool {
    aster_root.join("MANIFEST.json").is_file()
        || aster_root.join(CORE_WORKFLOW).is_dir()
        || aster_root.join(CORE_WIKI).is_dir()
        || aster_root.join(CORE_EVIDENCE).is_dir()
        || aster_root.join(CORE_SKILLS).is_dir()
}

/// True when `.aster` already has engineering layout. Legacy `.kstudio`
/// remains readable by explicit callers but never triggers automatic arming.
pub fn engineering_root_present(workspace: &Path) -> bool {
    aster_engineering_present(&canonical_kstudio_root(workspace))
}

/// Resolve the engineering root for `workspace`.
///
/// Prefer `.aster` when it already has engineering markers; else legacy
/// `.kstudio`; else return `.aster` (create target for explicit materialize).
pub fn kstudio_root(workspace: &Path) -> PathBuf {
    let canonical = canonical_kstudio_root(workspace);
    if aster_engineering_present(&canonical) {
        return canonical;
    }
    let legacy = legacy_kstudio_root(workspace);
    if legacy.exists() {
        return legacy;
    }
    canonical
}

/// On-disk kburn factory drop shipped with aster-core: contracts, project
/// skeleton, conductor skills and the executable loop/review controller.
pub fn bundled_kstudio_factory_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("src/kstudio/factory")
}

/// Path to the bundled project skeleton (contents of `.kstudio/` after init).
pub fn bundled_kstudio_skeleton_dir() -> PathBuf {
    bundled_kstudio_factory_dir().join("kstudio-project-skeleton")
}

/// Copy missing seed files from the bundled skeleton into the engineering root.
///
/// Destination is [`kstudio_root`]: engineering `.aster` or legacy `.kstudio`
/// wins; otherwise materialize into canonical `.aster`. Existing files are
/// left untouched (fail-closed against overwrite).
pub fn materialize_kstudio_factory_seeds(workspace: &Path) -> anyhow::Result<Vec<PathBuf>> {
    fn copy_missing(
        source: &Path,
        destination: &Path,
        created: &mut Vec<PathBuf>,
    ) -> anyhow::Result<()> {
        if source.is_dir() {
            std::fs::create_dir_all(destination)?;
            for entry in std::fs::read_dir(source)? {
                let entry = entry?;
                copy_missing(&entry.path(), &destination.join(entry.file_name()), created)?;
            }
        } else if source.is_file() && !destination.exists() {
            if let Some(parent) = destination.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::copy(source, destination)?;
            created.push(destination.to_path_buf());
        }
        Ok(())
    }

    let skeleton = bundled_kstudio_skeleton_dir();
    let dest_root = kstudio_root(workspace);
    let mut created = Vec::new();
    for rel in KSTUDIO_FACTORY_SEED_PATHS {
        copy_missing(&skeleton.join(rel), &dest_root.join(rel), &mut created)?;
    }
    Ok(created)
}

/// Core bounded-context directories under `.kstudio/` (layout v1 defaults).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KstudioCoreDirs {
    pub root: PathBuf,
    pub workflow: PathBuf,
    pub workflows: PathBuf,
    pub evidence: PathBuf,
    pub wiki: PathBuf,
    pub lanes: PathBuf,
    pub migration: PathBuf,
    pub skills: PathBuf,
}

impl KstudioCoreDirs {
    /// Resolve layout-v1 default absolute paths for `workspace`.
    pub fn for_workspace(workspace: &Path) -> Self {
        Self::from_core(workspace, &KstudioManifestCore::default())
    }

    /// Resolve absolute paths using relative names from a project manifest.
    pub fn from_core(workspace: &Path, core: &KstudioManifestCore) -> Self {
        let root = kstudio_root(workspace);
        Self {
            workflow: root.join(&core.workflow),
            workflows: root.join(&core.workflows),
            evidence: root.join(&core.evidence),
            wiki: root.join(&core.wiki),
            lanes: root.join(&core.lanes),
            migration: root.join(&core.migration),
            skills: root.join(&core.skills),
            root,
        }
    }

    /// Read MANIFEST when present; otherwise layout-v1 defaults.
    pub fn resolve(workspace: &Path) -> anyhow::Result<Self> {
        Ok(match read_kstudio_manifest(workspace)? {
            Some(manifest) => Self::from_core(workspace, &manifest.core),
            None => Self::for_workspace(workspace),
        })
    }

    /// Paths that must exist for a minimal initialized project (skills optional
    /// until a pack is installed; workflow + evidence are expected after init).
    pub fn required_after_init(&self) -> [&Path; 3] {
        [
            self.workflow.as_path(),
            self.evidence.as_path(),
            self.wiki.as_path(),
        ]
    }
}

/// True when `skills` is the layout-v1 conductor skills directory for `workspace`.
pub fn is_kstudio_skills_dir(workspace: &Path, skills: &Path) -> bool {
    skills == KstudioCoreDirs::for_workspace(workspace).skills
}

/// Model routing guidance when KBurn conductor skills are active.
pub const KBURN_PRIORITY_PROMPT: &str = crate::prompts::KBURN_CATALOG_HEADER;

/// Canonical kburn conductor skill names (12 conductor skills). Bodies stay on disk under
/// `<eng-root>/skills/<name>/SKILL.md` — Core does not embed the markdown.
pub const KBURN_SKILL_NAMES: &[&str] = &[
    "init", "goal", "status", "progress", "plan", "task", "go", "loop", "yolo", "review", "clean",
    "wiki",
];

/// Host selection for automatic KBurn arming.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum KburnMode {
    /// Arm only when an engineering root already exists.
    #[default]
    Auto,
    /// Materialize missing factory seeds even without an engineering root.
    Enabled,
    /// Do not materialize or automatically load KBurn skills.
    Disabled,
}

impl From<Option<bool>> for KburnMode {
    fn from(enabled: Option<bool>) -> Self {
        match enabled {
            Some(true) => Self::Enabled,
            Some(false) => Self::Disabled,
            None => Self::Auto,
        }
    }
}

/// Result of arming kburn runtime for one workspace session.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct KburnArmReport {
    /// No engineering markers were present under `.aster`.
    pub skipped_absent: bool,
    pub materialized: Vec<PathBuf>,
    pub skills_loaded: usize,
    pub skill_errors: usize,
}

fn has_task_acceptance(value: &serde_json::Value) -> bool {
    let sha256 = value
        .get("last_receipt_sha256")
        .and_then(serde_json::Value::as_str)
        .is_some_and(|hash| hash.len() == 64 && hash.bytes().all(|byte| byte.is_ascii_hexdigit()));
    let feedback = value
        .get("seen_feedback")
        .and_then(serde_json::Value::as_array)
        .is_some_and(|entries| !entries.is_empty());
    let accepted_event = value
        .get("history")
        .and_then(serde_json::Value::as_array)
        .is_some_and(|entries| {
            entries.iter().any(|entry| {
                entry.get("kind").and_then(serde_json::Value::as_str) == Some("feedback")
                    && entry.get("status").and_then(serde_json::Value::as_str)
                        == Some("task_accepted")
            })
        });
    value.get("schema").and_then(serde_json::Value::as_str) == Some("kstudio.loop-state.v1")
        && value.get("status").and_then(serde_json::Value::as_str) == Some("task_accepted")
        && value
            .get("spec")
            .and_then(|spec| spec.get("task_id"))
            .and_then(serde_json::Value::as_str)
            .is_some_and(|task| !task.is_empty())
        && sha256
        && feedback
        && accepted_event
}

/// Return a completion-blocking diagnostic when any KBurn loop still needs
/// implementation or semantic review. Missing state is never an acceptance proof.
pub fn incomplete_loop_message(workspace: &Path) -> Option<String> {
    let paths = match loop_state_paths(workspace) {
        Ok(paths) => paths,
        Err(error) => return Some(error),
    };
    for path in paths {
        let raw = match std::fs::read(&path) {
            Ok(raw) => raw,
            Err(error) => {
                return Some(format!(
                    "KBurn loop state {} cannot be read: {error}",
                    path.display()
                ));
            }
        };
        let value: serde_json::Value = match serde_json::from_slice(&raw) {
            Ok(value) => value,
            Err(error) => {
                return Some(format!(
                    "KBurn loop state {} is invalid: {error}",
                    path.display()
                ));
            }
        };
        if value.get("schema").and_then(serde_json::Value::as_str) == Some("kstudio.loop-spec.v1") {
            let task = value
                .get("task_id")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("unknown");
            let collision =
                path.file_name().and_then(|name| name.to_str()) == Some(&format!("{task}.json"));
            return Some(format!(
                "KBurn loop {task} has a spec but its controller is not started. {}Run the controller start/status commands before more implementation, then advance task checks and submit semantic feedback to task_accepted",
                if collision {
                    "The spec collides with controller state; rename it to <task-id>.spec.json. "
                } else {
                    ""
                }
            ));
        }
        let status = value.get("status").and_then(serde_json::Value::as_str);
        if status == Some("task_accepted") && !has_task_acceptance(&value) {
            return Some(format!(
                "KBurn loop state {} has invalid task acceptance evidence",
                path.display()
            ));
        }
        if matches!(status, Some("running" | "ready_for_review")) {
            let task = value
                .get("task_id")
                .or_else(|| value.get("spec").and_then(|spec| spec.get("task_id")))
                .and_then(serde_json::Value::as_str)
                .unwrap_or("unknown");
            let controller = value
                .get("controller")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("unknown");
            let action = if status == Some("running") {
                let review = path
                    .parent()
                    .and_then(|parent| parent.parent())
                    .and_then(|parent| parent.parent())
                    .map(|root| root.join("workflow/review.py"))
                    .unwrap_or_else(|| PathBuf::from(".kstudio/workflow/review.py"));
                format!(
                    "run python3 {} --run to create a fresh receipt, then call loop-kstudio.py advance --run {task} --controller {controller} --receipt <receipt.json>",
                    review.display()
                )
            } else {
                format!(
                    "write the semantic review, then call loop-kstudio.py feedback --run {task} --controller {controller} --feedback <feedback.json>"
                )
            };
            return Some(format!(
                "KBurn loop {task} is {}; {action}. Do not stop before feedback yields task_accepted",
                status.unwrap_or("running")
            ));
        }
    }
    None
}

fn loop_state_paths(workspace: &Path) -> Result<Vec<PathBuf>, String> {
    let mut paths = Vec::new();
    for root in [ASTER_DIR, KSTUDIO_DIR] {
        let directory = workspace.join(root).join("local/loops");
        let entries = match std::fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => {
                return Err(format!(
                    "KBurn loop state {} cannot be read: {error}",
                    directory.display()
                ));
            }
        };
        for entry in entries {
            let entry = entry.map_err(|error| {
                format!(
                    "KBurn loop state {} cannot be read: {error}",
                    directory.display()
                )
            })?;
            let path = entry.path();
            let is_spec = path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.ends_with(".spec.json"));
            if path.extension().and_then(|value| value.to_str()) == Some("json") && !is_spec {
                paths.push(path);
            }
        }
    }
    Ok(paths)
}

fn running_loop_exists(workspace: &Path) -> bool {
    let Ok(paths) = loop_state_paths(workspace) else {
        return false;
    };
    paths.into_iter().any(|path| {
        std::fs::read(path)
            .ok()
            .and_then(|raw| serde_json::from_slice::<serde_json::Value>(&raw).ok())
            .and_then(|value| {
                value
                    .get("status")
                    .and_then(serde_json::Value::as_str)
                    .map(|status| status == "running")
            })
            .unwrap_or(false)
    })
}

fn engineering_path(workspace: &Path, path: &str) -> bool {
    let relative = crate::harness_loop::workspace_relative_path(workspace, path);
    [ASTER_DIR, KSTUDIO_DIR]
        .iter()
        .any(|root| relative == *root || relative.starts_with(&format!("{root}/")))
}

/// Refuse direct product writes after `Skill("loop")` until a controller is running.
pub fn product_write_blocked(
    workspace: &Path,
    invoked: bool,
    tool_name: &str,
    args: &serde_json::Value,
) -> Option<String> {
    if !matches!(tool_name, "write" | "edit" | "patch") || !invoked {
        return None;
    }
    if running_loop_exists(workspace) {
        return None;
    }
    let paths = args
        .get("patches")
        .and_then(serde_json::Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(|entry| entry.get("file_path").and_then(serde_json::Value::as_str))
                .collect::<Vec<_>>()
        })
        .or_else(|| {
            args.get("file_path")
                .and_then(serde_json::Value::as_str)
                .map(|path| vec![path])
        })?;
    if paths.iter().all(|path| engineering_path(workspace, path)) {
        return None;
    }
    Some(
        "KBurn loop is invoked but no controller is running. Only a running controller authorizes product writes. Create a separate <task-id>.spec.json and start/resume the controller, then write product source; engineering spec and check files remain allowed"
            .to_string(),
    )
}

pub(crate) fn is_loop_skill_invocation(tool_name: &str, args: &serde_json::Value) -> bool {
    tool_name == "Skill"
        && args
            .get("skill_name")
            .or_else(|| args.get("skillName"))
            .or_else(|| args.get("name"))
            .and_then(serde_json::Value::as_str)
            == Some("loop")
}

pub(crate) fn loop_skill_invoked(messages: &[crate::llm::Message]) -> bool {
    messages.iter().any(|message| {
        message.content.iter().any(|block| match block {
            crate::llm::ContentBlock::ToolUse { name, input, .. } => {
                is_loop_skill_invocation(name, input)
            }
            _ => false,
        })
    })
}

/// Whether at least one KBurn loop has a real `task_accepted` terminal state.
pub fn accepted_loop_exists(workspace: &Path) -> bool {
    let Ok(paths) = loop_state_paths(workspace) else {
        return false;
    };
    paths.into_iter().any(|path| {
        std::fs::read(path)
            .ok()
            .and_then(|raw| serde_json::from_slice::<serde_json::Value>(&raw).ok())
            .is_some_and(|value| has_task_acceptance(&value))
    })
}

/// Auto-arm kburn only when `.aster` already has engineering markers.
/// Legacy `.kstudio` alone is deliberately not an automatic trigger.
///
/// A bare `.aster/config.acl` alone does not arm, so ordinary Aster sessions do
/// not grow a full engineering tree.
pub fn arm_kburn_runtime(
    workspace: &Path,
    registry: &crate::skills::SkillRegistry,
) -> anyhow::Result<KburnArmReport> {
    if !engineering_root_present(workspace) {
        return Ok(KburnArmReport {
            skipped_absent: true,
            ..KburnArmReport::default()
        });
    }
    arm_kburn_runtime_enabled(workspace, registry)
}

/// Explicitly arm kburn, materializing missing factory seeds even when no
/// engineering root exists. Existing files are never overwritten.
pub fn arm_kburn_runtime_enabled(
    workspace: &Path,
    registry: &crate::skills::SkillRegistry,
) -> anyhow::Result<KburnArmReport> {
    let materialized = materialize_kstudio_factory_seeds(workspace)?;
    let load = load_kburn_skills(workspace, registry)?;
    Ok(KburnArmReport {
        skipped_absent: false,
        materialized,
        skills_loaded: load.loaded,
        skill_errors: load.errors.len(),
    })
}

/// Load present canonical kburn skill packages under `<eng-root>/skills`.
/// Only [`KBURN_SKILL_NAMES`] directories are considered; sibling files such as
/// `README.md` are ignored. Missing packages are skipped (not an error).
pub fn load_kburn_skills(
    workspace: &Path,
    registry: &crate::skills::SkillRegistry,
) -> anyhow::Result<crate::skills::SkillLoadReport> {
    let skills_root = KstudioCoreDirs::for_workspace(workspace).skills;
    let mut report = crate::skills::SkillLoadReport::default();
    if !skills_root.is_dir() {
        return Ok(report);
    }
    for name in KBURN_SKILL_NAMES {
        let package = skills_root.join(name);
        if !package.is_dir() {
            continue;
        }
        let package_report = registry.load_from_dir_report(&package)?;
        report.loaded += package_report.loaded;
        report.errors.extend(package_report.errors);
        report.overrides.extend(package_report.overrides);
    }
    Ok(report)
}

/// Which canonical kburn skill packages exist under the workspace skills root.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KburnSkillCoverage {
    pub present: Vec<String>,
    pub missing: Vec<String>,
}

impl KburnSkillCoverage {
    pub fn is_complete(&self) -> bool {
        self.missing.is_empty()
    }
}

/// Which factory seed paths exist under `.kstudio/`.
pub fn kstudio_factory_seed_coverage(workspace: &Path) -> KburnSkillCoverage {
    let root = kstudio_root(workspace);
    let mut present = Vec::new();
    let mut missing = Vec::new();
    for rel in KSTUDIO_FACTORY_SEED_PATHS {
        let path = root.join(rel);
        let ok = if *rel == "skills" {
            path.is_dir()
        } else {
            path.is_file()
        };
        if ok {
            present.push((*rel).to_owned());
        } else {
            missing.push((*rel).to_owned());
        }
    }
    KburnSkillCoverage { present, missing }
}

/// Enumerate present vs missing packages for [`KBURN_SKILL_NAMES`].
pub fn kburn_skill_coverage(workspace: &Path) -> KburnSkillCoverage {
    let skills_root = KstudioCoreDirs::for_workspace(workspace).skills;
    let mut present = Vec::new();
    let mut missing = Vec::new();
    for name in KBURN_SKILL_NAMES {
        let skill_md = skills_root.join(name).join("SKILL.md");
        if skill_md.is_file() {
            present.push((*name).to_owned());
        } else {
            missing.push((*name).to_owned());
        }
    }
    KburnSkillCoverage { present, missing }
}

/// Minimal project manifest stamp (`kstudio.project-manifest.v1`).
#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize)]
pub struct KstudioManifest {
    pub schema: String,
    pub schema_version: u32,
    #[serde(default)]
    pub project: Option<String>,
    #[serde(default)]
    pub core: KstudioManifestCore,
}

/// Core relative directory names from the manifest (defaults = layout v1).
#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize)]
pub struct KstudioManifestCore {
    #[serde(default = "default_workflow")]
    pub workflow: String,
    #[serde(default = "default_workflows")]
    pub workflows: String,
    #[serde(default = "default_evidence")]
    pub evidence: String,
    #[serde(default = "default_wiki")]
    pub wiki: String,
    #[serde(default = "default_lanes")]
    pub lanes: String,
    #[serde(default = "default_migration")]
    pub migration: String,
    #[serde(default = "default_skills")]
    pub skills: String,
}

impl Default for KstudioManifestCore {
    fn default() -> Self {
        Self {
            workflow: default_workflow(),
            workflows: default_workflows(),
            evidence: default_evidence(),
            wiki: default_wiki(),
            lanes: default_lanes(),
            migration: default_migration(),
            skills: default_skills(),
        }
    }
}

fn default_workflow() -> String {
    CORE_WORKFLOW.to_owned()
}
fn default_workflows() -> String {
    CORE_WORKFLOWS.to_owned()
}
fn default_evidence() -> String {
    CORE_EVIDENCE.to_owned()
}
fn default_wiki() -> String {
    CORE_WIKI.to_owned()
}
fn default_lanes() -> String {
    CORE_LANES.to_owned()
}
fn default_migration() -> String {
    CORE_MIGRATION.to_owned()
}
fn default_skills() -> String {
    CORE_SKILLS.to_owned()
}

/// Read `<eng-root>/MANIFEST.json` when present. Fail closed on bad schema id.
pub fn read_kstudio_manifest(workspace: &Path) -> anyhow::Result<Option<KstudioManifest>> {
    let path = kstudio_root(workspace).join("MANIFEST.json");
    if !path.is_file() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&path)?;
    let manifest: KstudioManifest = serde_json::from_str(&raw)?;
    if manifest.schema != "kstudio.project-manifest.v1" {
        anyhow::bail!(
            "unsupported .kstudio MANIFEST schema {:?}; expected kstudio.project-manifest.v1",
            manifest.schema
        );
    }
    if manifest.schema_version < 1 {
        anyhow::bail!(
            "unsupported .kstudio MANIFEST schema_version {}",
            manifest.schema_version
        );
    }
    Ok(Some(manifest))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn accepted_state() -> String {
        let hash = "a".repeat(64);
        serde_json::json!({
            "schema": "kstudio.loop-state.v1",
            "spec": {"task_id": "demo"},
            "status": "task_accepted",
            "last_receipt_sha256": hash,
            "seen_feedback": [hash],
            "history": [{"kind": "feedback", "status": "task_accepted"}]
        })
        .to_string()
    }

    #[test]
    fn vendored_layout_contract_declares_schema_id() {
        assert!(KSTUDIO_PROJECT_LAYOUT_V1_JSON.contains("\"$id\": \"kstudio.project-layout.v1\""));
        assert!(
            KSTUDIO_PROJECT_LAYOUT_V1_JSON.contains("\"const\": \"kstudio.project-manifest.v1\"")
        );
        assert!(KSTUDIO_PROJECT_LAYOUT_V1_JSON.contains("\"default\": \"skills\""));
    }

    #[test]
    fn vendored_extension_pack_contract_declares_schema_id() {
        assert!(KSTUDIO_EXTENSION_PACK_V1_JSON.contains("\"$id\": \"kstudio.extension-pack.v1\""));
        assert!(
            KSTUDIO_EXTENSION_PACK_V1_JSON
                .contains("\"required\": [\"id\", \"version\", \"api_version\"]")
                || KSTUDIO_EXTENSION_PACK_V1_JSON.contains("api_version")
        );
    }

    #[test]
    fn layout_v1_defaults_prefer_aster_when_absent() {
        let ws = Path::new("/tmp/aster-kstudio-ws");
        let dirs = KstudioCoreDirs::for_workspace(ws);
        assert_eq!(dirs.root, ws.join(".aster"));
        assert_eq!(dirs.workflow, dirs.root.join("workflow"));
        assert_eq!(dirs.workflows, dirs.root.join("workflows"));
        assert_eq!(dirs.evidence, dirs.root.join("evidence"));
        assert_eq!(dirs.wiki, dirs.root.join("wiki"));
        assert_eq!(dirs.lanes, dirs.root.join("lanes"));
        assert_eq!(dirs.migration, dirs.root.join("migration"));
        assert_eq!(dirs.skills, dirs.root.join("skills"));
    }

    #[test]
    fn kstudio_root_prefers_aster_engineering_then_legacy() {
        let root = tempfile::tempdir().unwrap();
        assert_eq!(
            kstudio_root(root.path()),
            canonical_kstudio_root(root.path())
        );
        // Bare .aster (config only) is not engineering — legacy still wins.
        std::fs::create_dir_all(canonical_kstudio_root(root.path())).unwrap();
        std::fs::write(
            canonical_kstudio_root(root.path()).join("config.acl"),
            "providers {}\n",
        )
        .unwrap();
        std::fs::create_dir_all(legacy_kstudio_root(root.path())).unwrap();
        assert_eq!(kstudio_root(root.path()), legacy_kstudio_root(root.path()));
        std::fs::create_dir_all(canonical_kstudio_root(root.path()).join("workflow")).unwrap();
        assert_eq!(
            kstudio_root(root.path()),
            canonical_kstudio_root(root.path())
        );
    }

    #[test]
    fn kstudio_skills_dir_aligns_with_agent_skill_roots() {
        let ws = Path::new("/tmp/aster-kstudio-align");
        let skills = KstudioCoreDirs::for_workspace(ws).skills;
        assert!(crate::skills::agent_skill_roots(ws).contains(&skills));
        assert!(is_kstudio_skills_dir(ws, &skills));
        assert!(!is_kstudio_skills_dir(ws, &ws.join("skills")));
    }

    #[test]
    fn kburn_skill_names_are_twelve_unique_conductor_skills() {
        assert_eq!(KBURN_SKILL_NAMES.len(), 12);
        let mut seen = std::collections::BTreeSet::new();
        for name in KBURN_SKILL_NAMES {
            assert!(
                name.chars().all(|c| c.is_ascii_lowercase() || c == '-'),
                "{name}"
            );
            assert!(!name.starts_with("k-"), "legacy k- prefix removed: {name}");
            assert!(seen.insert(*name), "duplicate {name}");
        }
    }

    #[test]
    fn arm_kburn_runtime_skips_workspaces_without_engineering_root() {
        let root = tempfile::tempdir().unwrap();
        let registry = crate::skills::SkillRegistry::new();
        let report = arm_kburn_runtime(root.path(), &registry).expect("arm");
        assert!(report.skipped_absent);
        std::fs::create_dir_all(legacy_kstudio_root(root.path())).unwrap();
        assert!(!engineering_root_present(root.path()));
        assert!(
            arm_kburn_runtime(root.path(), &registry)
                .expect("legacy alone")
                .skipped_absent
        );
        // Bare .aster/config.acl must not auto-arm.
        std::fs::create_dir_all(canonical_kstudio_root(root.path())).unwrap();
        std::fs::write(
            canonical_kstudio_root(root.path()).join("config.acl"),
            "providers {}\n",
        )
        .unwrap();
        let again = arm_kburn_runtime(root.path(), &registry).expect("arm config-only");
        assert!(again.skipped_absent);
        assert!(!engineering_root_present(root.path()));
        // `.aster/skills` alone is enough to arm (loads + may materialize seeds).
        std::fs::create_dir_all(canonical_kstudio_root(root.path()).join(CORE_SKILLS)).unwrap();
        assert!(engineering_root_present(root.path()));
        let armed = arm_kburn_runtime(root.path(), &registry).expect("arm skills-only");
        assert!(!armed.skipped_absent);
    }

    #[test]
    fn explicit_kburn_enable_materializes_without_an_engineering_root() {
        let root = tempfile::tempdir().unwrap();
        let registry = crate::skills::SkillRegistry::new();
        let report = arm_kburn_runtime_enabled(root.path(), &registry).expect("enabled");
        assert!(!report.skipped_absent);
        assert!(!report.materialized.is_empty());
        assert!(root.path().join(".aster").join("MANIFEST.json").is_file());
        assert!(root.path().join(".aster").join("workflow").is_dir());
        assert!(
            root.path()
                .join(".aster/workflow/loop-kstudio.py")
                .is_file()
        );
        assert!(root.path().join(".aster/workflow/review.py").is_file());
        assert_eq!(report.skills_loaded, KBURN_SKILL_NAMES.len());
        assert!(registry.get("loop").is_some());
    }

    #[test]
    fn loop_completion_blocks_only_active_loops() {
        let root = tempfile::tempdir().unwrap();
        let state = root.path().join(".kstudio/local/loops/demo.json");
        std::fs::create_dir_all(state.parent().unwrap()).unwrap();
        std::fs::write(&state, r#"{"task_id":"demo","status":"running"}"#).unwrap();
        assert!(incomplete_loop_message(root.path()).is_some());
        std::fs::write(&state, r#"{"task_id":"demo","status":"ready_for_review"}"#).unwrap();
        assert!(incomplete_loop_message(root.path()).is_some());
        assert!(!accepted_loop_exists(root.path()));
        std::fs::write(&state, r#"{"task_id":"demo","status":"task_accepted"}"#).unwrap();
        assert!(incomplete_loop_message(root.path()).is_some());
        assert!(!accepted_loop_exists(root.path()));
        std::fs::write(&state, accepted_state()).unwrap();
        assert!(incomplete_loop_message(root.path()).is_none());
        assert!(accepted_loop_exists(root.path()));
        std::fs::write(&state, r#"{"task_id":"demo","status":"blocked"}"#).unwrap();
        assert!(incomplete_loop_message(root.path()).is_none());
        assert!(!accepted_loop_exists(root.path()));
        std::fs::write(&state, b"not-json").unwrap();
        assert!(incomplete_loop_message(root.path()).is_some());
    }

    #[test]
    fn loop_completion_supports_canonical_aster_state() {
        let root = tempfile::tempdir().unwrap();
        let state = root.path().join(".aster/local/loops/demo.json");
        std::fs::create_dir_all(state.parent().unwrap()).unwrap();
        std::fs::write(&state, r#"{"spec":{"task_id":"demo"},"status":"running"}"#).unwrap();
        assert!(
            incomplete_loop_message(root.path())
                .is_some_and(|message| message.contains("KBurn loop demo is running"))
        );
        std::fs::write(&state, accepted_state()).unwrap();
        assert!(incomplete_loop_message(root.path()).is_none());
        assert!(accepted_loop_exists(root.path()));
    }

    #[test]
    fn loop_completion_explains_unstarted_spec_collision() {
        let root = tempfile::tempdir().unwrap();
        let state = root.path().join(".kstudio/local/loops/demo.json");
        std::fs::create_dir_all(state.parent().unwrap()).unwrap();
        std::fs::write(
            &state,
            r#"{"schema":"kstudio.loop-spec.v1","task_id":"demo"}"#,
        )
        .unwrap();
        let message = incomplete_loop_message(root.path()).unwrap();
        assert!(message.contains("controller is not started"), "{message}");
        assert!(
            message.contains("rename it to <task-id>.spec.json"),
            "{message}"
        );
        assert!(message.contains("start/status"), "{message}");
    }

    #[test]
    fn loop_completion_ignores_companion_spec_when_state_is_running() {
        let root = tempfile::tempdir().unwrap();
        let directory = root.path().join(".kstudio/local/loops");
        std::fs::create_dir_all(&directory).unwrap();
        std::fs::write(
            directory.join("demo.spec.json"),
            r#"{"schema":"kstudio.loop-spec.v1","task_id":"demo"}"#,
        )
        .unwrap();
        std::fs::write(
            directory.join("demo.json"),
            r#"{"spec":{"task_id":"demo"},"status":"running"}"#,
        )
        .unwrap();
        let message = incomplete_loop_message(root.path()).unwrap();
        assert!(message.contains("KBurn loop demo is running"), "{message}");
        assert!(message.contains("review.py --run"), "{message}");
        assert!(message.contains("advance --run demo"), "{message}");
        assert!(!message.contains("controller is not started"), "{message}");
    }

    #[test]
    fn product_writes_require_running_loop_after_invocation() {
        let root = tempfile::tempdir().unwrap();
        let product = serde_json::json!({"file_path":"src/main.py"});
        assert!(product_write_blocked(root.path(), false, "write", &product).is_none());
        assert!(product_write_blocked(root.path(), true, "write", &product).is_some());
        let check = serde_json::json!({"file_path":".kstudio/workflow/check.py"});
        assert!(product_write_blocked(root.path(), true, "write", &check).is_none());
        assert!(product_write_blocked(root.path(), true, "read", &product).is_none());
        let state = root.path().join(".kstudio/local/loops/demo.json");
        std::fs::create_dir_all(state.parent().unwrap()).unwrap();
        std::fs::write(&state, r#"{"spec":{"task_id":"demo"},"status":"running"}"#).unwrap();
        assert!(product_write_blocked(root.path(), true, "write", &product).is_none());
    }

    #[test]
    fn arm_kburn_runtime_materializes_and_loads_when_aster_engineering_present() {
        let root = tempfile::tempdir().unwrap();
        let skills = canonical_kstudio_root(root.path()).join(CORE_SKILLS);
        let dir = skills.join("status");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            dir.join("SKILL.md"),
            "---\nname: status\ndescription: status\n---\n# status\n",
        )
        .unwrap();
        let registry = crate::skills::SkillRegistry::new();
        let report = arm_kburn_runtime(root.path(), &registry).expect("arm");
        assert!(!report.skipped_absent);
        assert!(!report.materialized.is_empty());
        assert!(kstudio_root(root.path()).join("MANIFEST.json").is_file());
        assert_eq!(report.skills_loaded, KBURN_SKILL_NAMES.len());
        assert!(registry.get("status").is_some());
        assert_eq!(
            std::fs::read_to_string(dir.join("SKILL.md")).unwrap(),
            "---\nname: status\ndescription: status\n---\n# status\n",
            "an existing project skill must not be overwritten"
        );
    }

    #[test]
    fn materialize_factory_seeds_creates_missing_only() {
        let root = tempfile::tempdir().unwrap();
        let created = materialize_kstudio_factory_seeds(root.path()).expect("materialize");
        assert!(!created.is_empty());
        assert_eq!(
            kstudio_root(root.path()),
            canonical_kstudio_root(root.path()),
            "explicit materialize targets .aster/"
        );
        assert!(kstudio_root(root.path()).join("MANIFEST.json").is_file());
        assert!(
            kstudio_root(root.path()).join("project.acl").is_file(),
            "materialize must seed project.acl (not .kcl)"
        );
        assert!(!kstudio_root(root.path()).join("config.kcl").exists());
        assert!(
            kstudio_root(root.path())
                .join("workflow")
                .join("GOALS.md")
                .is_file()
        );
        assert!(kstudio_root(root.path()).join("skills").is_dir());
        for helper in KSTUDIO_WORKFLOW_HELPERS {
            assert!(
                kstudio_root(root.path())
                    .join("workflow")
                    .join(helper)
                    .is_file(),
                "missing helper {helper}"
            );
        }
        let helpers = present_kstudio_workflow_helpers(root.path());
        assert_eq!(helpers.len(), KSTUDIO_WORKFLOW_HELPERS.len(), "{helpers:?}");
        let again = materialize_kstudio_factory_seeds(root.path()).expect("again");
        assert!(again.is_empty(), "{again:?}");
    }

    #[test]
    fn materialize_seeds_workflow_helpers_under_aster() {
        let root = tempfile::tempdir().unwrap();
        let created = materialize_kstudio_factory_seeds(root.path()).expect("materialize");
        assert!(
            created.iter().any(|p| p.ends_with("sitrep.py")),
            "{created:?}"
        );
        let helpers = present_kstudio_workflow_helpers(root.path());
        assert_eq!(helpers.len(), KSTUDIO_WORKFLOW_HELPERS.len(), "{helpers:?}");
        assert_eq!(
            kstudio_root(root.path()),
            canonical_kstudio_root(root.path())
        );
    }

    #[test]
    fn bundled_factory_skeleton_contains_manifest_and_seed_paths() {
        let skeleton = bundled_kstudio_skeleton_dir();
        assert!(
            skeleton.join("MANIFEST.json").is_file(),
            "missing {}",
            skeleton.join("MANIFEST.json").display()
        );
        for rel in KSTUDIO_FACTORY_SEED_PATHS {
            let path = skeleton.join(rel);
            let ok = if *rel == "skills" {
                // Bundled skeleton may omit skills/ (bodies live in project packs).
                true
            } else {
                path.is_file()
            };
            assert!(
                ok,
                "missing factory seed {rel} under {}",
                skeleton.display()
            );
        }
        assert!(bundled_kstudio_factory_dir().join("contracts").is_dir());
        assert!(
            bundled_kstudio_factory_dir()
                .join("kstudio-agent-rules")
                .is_dir()
        );
    }

    #[test]
    fn this_repo_exposes_workflow_helpers() {
        let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
        let workspace = manifest_dir
            .ancestors()
            .find(|path| {
                path.join(".kstudio")
                    .join("workflow")
                    .join("sitrep.py")
                    .is_file()
            })
            .expect("aster checkout with sitrep.py");
        let helpers = present_kstudio_workflow_helpers(workspace);
        assert!(
            helpers.iter().any(|p| p.ends_with("sitrep.py")),
            "{helpers:?}"
        );
        assert!(helpers.len() >= 2, "{helpers:?}");
    }

    #[test]
    fn this_repo_factory_seed_paths_are_present() {
        let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
        let workspace = manifest_dir
            .ancestors()
            .find(|path| path.join(".kstudio").join("MANIFEST.json").is_file())
            .expect("aster checkout with .kstudio/MANIFEST.json");
        let coverage = kstudio_factory_seed_coverage(workspace);
        assert!(
            coverage.is_complete(),
            "missing factory seeds under {}: {:?}",
            workspace.display(),
            coverage.missing
        );
    }

    #[test]
    fn this_repo_kstudio_skills_cover_all_twelve_when_checked_out() {
        let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
        let workspace = manifest_dir
            .ancestors()
            .find(|path| {
                path.join(".kstudio")
                    .join("skills")
                    .join("init")
                    .join("SKILL.md")
                    .is_file()
            })
            .expect("aster checkout with .kstudio/skills");
        let coverage = kburn_skill_coverage(workspace);
        assert!(
            coverage.is_complete(),
            "missing kburn skills under {}: {:?}",
            workspace.display(),
            coverage.missing
        );
        assert_eq!(coverage.present.len(), 12);
        let registry = crate::skills::SkillRegistry::new();
        let report = load_kburn_skills(workspace, &registry).expect("load repo skills");
        assert!(report.loaded >= 12, "loaded={}", report.loaded);
        assert!(report.errors.is_empty(), "{report:?}");
        for name in KBURN_SKILL_NAMES {
            assert!(registry.get(name).is_some(), "registry missing {name}");
        }
    }

    #[test]
    fn kburn_skill_coverage_reports_present_and_missing() {
        let root = tempfile::tempdir().unwrap();
        let skills = KstudioCoreDirs::for_workspace(root.path()).skills;
        for name in ["init", "wiki"] {
            let dir = skills.join(name);
            std::fs::create_dir_all(&dir).unwrap();
            std::fs::write(dir.join("SKILL.md"), "---\nname: x\n---\n").unwrap();
        }
        let coverage = kburn_skill_coverage(root.path());
        assert_eq!(coverage.present, vec!["init".to_owned(), "wiki".to_owned()]);
        assert_eq!(coverage.missing.len(), 10);
        assert!(!coverage.is_complete());
    }

    #[test]
    fn resolve_dirs_honors_manifest_core_overrides() {
        let root = tempfile::tempdir().unwrap();
        let manifest_path = kstudio_root(root.path()).join("MANIFEST.json");
        std::fs::create_dir_all(manifest_path.parent().unwrap()).unwrap();
        std::fs::write(
            &manifest_path,
            r#"{"schema":"kstudio.project-manifest.v1","schema_version":1,"core":{"skills":"skills","wiki":"knowledge"}}"#,
        )
        .unwrap();
        let dirs = KstudioCoreDirs::resolve(root.path()).expect("resolve");
        assert_eq!(dirs.skills, kstudio_root(root.path()).join("skills"));
        assert_eq!(dirs.wiki, kstudio_root(root.path()).join("knowledge"));
        assert_eq!(dirs.workflow, kstudio_root(root.path()).join("workflow"));
    }

    #[test]
    fn read_kstudio_manifest_accepts_v1_and_rejects_bad_schema() {
        let root = tempfile::tempdir().unwrap();
        let manifest_path = kstudio_root(root.path()).join("MANIFEST.json");
        std::fs::create_dir_all(manifest_path.parent().unwrap()).unwrap();
        std::fs::write(
            &manifest_path,
            r#"{"schema":"kstudio.project-manifest.v1","schema_version":1,"project":"demo","core":{"skills":"skills"}}"#,
        )
        .unwrap();
        let ok = read_kstudio_manifest(root.path())
            .expect("read")
            .expect("present");
        assert_eq!(ok.project.as_deref(), Some("demo"));
        assert_eq!(ok.core.skills, "skills");

        std::fs::write(
            &manifest_path,
            r#"{"schema":"other.v0","schema_version":1}"#,
        )
        .unwrap();
        let err = read_kstudio_manifest(root.path()).expect_err("bad schema");
        assert!(err.to_string().contains("unsupported"), "{err}");
    }

    #[test]
    fn load_kburn_skills_enumerates_present_packages() {
        let root = tempfile::tempdir().unwrap();
        let skills = KstudioCoreDirs::for_workspace(root.path()).skills;
        for name in ["goal", "plan", "yolo"] {
            let dir = skills.join(name);
            std::fs::create_dir_all(&dir).unwrap();
            std::fs::write(
                dir.join("SKILL.md"),
                format!("---\nname: {name}\ndescription: test\n---\n# {name}\n"),
            )
            .unwrap();
        }
        let registry = crate::skills::SkillRegistry::new();
        let report = load_kburn_skills(root.path(), &registry).expect("load");
        assert_eq!(report.loaded, 3);
        assert!(report.errors.is_empty(), "{report:?}");
        for name in ["goal", "plan", "yolo"] {
            assert!(registry.get(name).is_some(), "missing {name}");
        }
        for name in KBURN_SKILL_NAMES {
            if !matches!(*name, "goal" | "plan" | "yolo") {
                assert!(registry.get(name).is_none());
            }
        }
    }
}
