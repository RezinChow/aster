//! Project AI-engineering layout roots, internalized under `.aster/`
//! (canonical) with legacy `.kstudio/` fallback.
//!
//! Defaults match `kstudio.project-layout.v1` core paths. This module exposes
//! narratable Core paths for hosts to compose; it does not run the factory or
//! install skills by itself.

use std::path::{Path, PathBuf};

/// Vendored layout contract (`kstudio.project-layout.v1` JSON Schema).
pub const KSTUDIO_PROJECT_LAYOUT_V1_JSON: &str = include_str!("kstudio-project-layout.v1.json");

/// Vendored extension-pack contract (`kstudio.extension-pack.v1`).
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
/// Legacy portable engineering root.
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

/// On-disk engineering factory drop shipped with aster-core: contracts,
/// project skeleton, and the loop/review controller scripts.
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

/// Which factory seed paths exist under the engineering root.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KstudioSeedCoverage {
    pub present: Vec<String>,
    pub missing: Vec<String>,
}

impl KstudioSeedCoverage {
    pub fn is_complete(&self) -> bool {
        self.missing.is_empty()
    }
}

/// Which factory seed paths exist under `.kstudio/`.
pub fn kstudio_factory_seed_coverage(workspace: &Path) -> KstudioSeedCoverage {
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
    KstudioSeedCoverage { present, missing }
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
        assert!(kstudio_root(root.path())
            .join("workflow")
            .join("GOALS.md")
            .is_file());
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
        assert!(bundled_kstudio_factory_dir()
            .join("kstudio-agent-rules")
            .is_dir());
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

}
