//! Workspace path admission for a macOS host path used inside the guest.
//!
//! `/` is the only separator. A literal `\` stays inside its component, so a
//! legal macOS directory name can contain one. NUL, an empty component, `.`,
//! and `..` stay rejected.

/// Guest-visible mode of the virtio-fs staging directory.
///
/// The container process is mapped to the macOS caller, not to the guest
/// owner of this directory. Other users get search (`--x`) only, so a mode
/// `0700` workspace behind the mount stays private.
pub const WORKSPACE_STAGING_DIRECTORY_MODE: u32 = 0o711;

/// Why a workspace path was rejected.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WorkspacePathReject {
    /// Empty, NUL, or the wrong absolute/relative shape.
    Shape,
    /// A trailing separator, an empty component, `.`, or `..`.
    Component,
}

/// Admit one workspace path. `require_absolute` selects the cwd form; the
/// source-relative form is the storage restriction beneath the mount.
pub fn admit_workspace_path(
    value: &str,
    require_absolute: bool,
) -> Result<(), WorkspacePathReject> {
    if value.is_empty()
        || value.as_bytes().contains(&0)
        || (require_absolute && !value.starts_with('/'))
        || (!require_absolute && value.starts_with('/'))
    {
        return Err(WorkspacePathReject::Shape);
    }
    let components = if require_absolute {
        value.strip_prefix('/').unwrap_or(value)
    } else {
        value
    };
    if value != "/"
        && (value.ends_with('/')
            || components
                .split('/')
                .any(|component| component.is_empty() || matches!(component, "." | "..")))
    {
        return Err(WorkspacePathReject::Component);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{admit_workspace_path, WorkspacePathReject};

    #[test]
    fn admits_a_literal_backslash_and_rejects_nul_empty_and_dotdot() {
        let relative = r#"嵌套/凭据 "alpha"\beta"#;
        assert_eq!(admit_workspace_path(relative, false), Ok(()));
        let absolute = r#"/private/var/tmp/aster-中文-"-\-work"#;
        assert_eq!(admit_workspace_path(absolute, true), Ok(()));
        // `\` is not a separator, so this is one component rather than traversal.
        assert_eq!(admit_workspace_path(r"leaf\..\name", false), Ok(()));

        assert_eq!(
            admit_workspace_path("a\0b", false),
            Err(WorkspacePathReject::Shape)
        );
        assert_eq!(
            admit_workspace_path("a//secret", false),
            Err(WorkspacePathReject::Component)
        );
        assert_eq!(
            admit_workspace_path("a/../secret", false),
            Err(WorkspacePathReject::Component)
        );
        assert_eq!(
            admit_workspace_path("a/./secret", false),
            Err(WorkspacePathReject::Component)
        );
        assert_eq!(
            admit_workspace_path("/var/tmp/../etc", true),
            Err(WorkspacePathReject::Component)
        );
        assert_eq!(
            admit_workspace_path("/var//tmp", true),
            Err(WorkspacePathReject::Component)
        );
        assert_eq!(
            admit_workspace_path("/var/tmp\0", true),
            Err(WorkspacePathReject::Shape)
        );
    }

    #[test]
    fn staging_directory_is_searchable_without_a_public_read_or_write() {
        let mode = super::WORKSPACE_STAGING_DIRECTORY_MODE;
        assert_eq!(mode & 0o007, 0o001, "the mapped caller can search");
        assert_eq!(mode & 0o006, 0, "other users cannot read or write");
        assert_eq!(mode & 0o700, 0o700, "the owner keeps a private directory");
    }
}
