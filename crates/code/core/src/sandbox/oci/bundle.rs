use std::path::{Path, PathBuf};

use a3s_oci_sdk::{
    runtime_bundle_handoff_directory, ContainerId, CreateAttachments, CreateRequest,
    IsolationRequest, OciBundle, ProcessIo, StorageAccessMode, StorageAttachmentId, StorageCleanup,
    StorageOwnership, StoragePathRestriction, StoragePathRestrictions,
    RUNTIME_BUNDLE_HANDOFF_EXTENSION, RUNTIME_BUNDLE_HANDOFF_MOVE_V2,
    STORAGE_PATH_RESTRICTIONS_EXTENSION,
};
use anyhow::{bail, Context, Result};
use serde_json::json;
use tokio::process::Command;
use tokio_util::sync::CancellationToken;

use super::{operation, OciSandboxAssets, SandboxCommandRequest};

/// Map container root onto one host identity.
///
/// Virtio-fs shows the macOS caller's ownership. A one-id map makes the
/// container process that owner, so it can read a mode `0700` workspace
/// without `CAP_DAC_OVERRIDE` and without granting any other host id.
pub(super) fn workspace_id_map(
    host_uid: u32,
    host_gid: u32,
) -> (serde_json::Value, serde_json::Value) {
    (
        json!({"containerID": 0, "hostID": host_uid, "size": 1}),
        json!({"containerID": 0, "hostID": host_gid, "size": 1}),
    )
}

pub(super) async fn prepare(
    workspace: &Path,
    assets: &OciSandboxAssets,
    root: &Path,
    request: &SandboxCommandRequest,
    cancellation: &CancellationToken,
) -> Result<CreateRequest> {
    let policy_workspace = workspace.to_path_buf();
    let scratch = root.to_path_buf();
    let boundary = tokio::task::spawn_blocking(move || {
        a3s_sandbox::WorkspaceFilesystemBoundary::compile(
            &a3s_sandbox::SandboxPolicy::a3s_bash_baseline(),
            &policy_workspace,
            &scratch,
        )
    })
    .await
    .context("compile workspace boundary")??;
    if cancellation.is_cancelled() {
        bail!("OCI command cancelled before staging");
    }
    let context = operation("create")?;
    let id = ContainerId::new(format!("aster-{}", uuid::Uuid::new_v4().simple()))?;
    let runtime = root.join("s/runtime");
    let directory = runtime_bundle_handoff_directory(&runtime, &id, &context.operation_id)?;
    std::fs::create_dir_all(directory.parent().context("handoff has no parent")?)?;
    use std::os::unix::fs::PermissionsExt;
    for path in directory
        .ancestors()
        .skip(1)
        .take_while(|path| *path != runtime)
    {
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700))?;
    }
    let mut copy = Command::new("/usr/bin/ditto");
    copy.arg(&assets.bundle).arg(&directory).env_clear();
    let copied = crate::tools::process::execute_owned_process(
        &mut copy,
        &[],
        std::time::Duration::from_secs(30),
        cancellation,
    )
    .await?;
    if !copied.status.is_some_and(|status| status.success()) {
        bail!("stage sandbox rootfs: {}", copied.stderr);
    }
    std::fs::set_permissions(&directory, std::fs::Permissions::from_mode(0o700))?;
    let rootfs = directory.join("rootfs");
    if rootfs.canonicalize()? != rootfs || !std::fs::symlink_metadata(&rootfs)?.is_dir() {
        bail!("rootfs template is not a plain owned directory");
    }
    if workspace != Path::new("/workspace") {
        let alias = rootfs.join("workspace");
        match std::fs::symlink_metadata(&alias) {
            Ok(metadata) if metadata.is_dir() => std::fs::remove_dir(&alias)?,
            Ok(_) => std::fs::remove_file(&alias)?,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
        std::os::unix::fs::symlink(workspace, alias)?;
    }
    let config_path = directory.join("config.json");
    if std::fs::symlink_metadata(&config_path)?
        .file_type()
        .is_symlink()
    {
        bail!("configuration template is a symlink");
    }
    let mut config: serde_json::Value = serde_json::from_slice(&std::fs::read(&config_path)?)?;
    let relative = |paths: Vec<PathBuf>| -> Result<Vec<String>> {
        paths
            .into_iter()
            .map(|path| {
                let path = path.strip_prefix(&boundary.workspace)?;
                Ok(if path.as_os_str().is_empty() {
                    ".".into()
                } else {
                    path.to_str()
                        .context("workspace restriction path is not UTF-8")?
                        .into()
                })
            })
            .collect()
    };
    let restrictions = StoragePathRestrictions::new(vec![StoragePathRestriction::new(
        StorageAttachmentId::new("workspace")?,
        relative(boundary.deny_read)?,
        relative(boundary.deny_write)?,
        relative(boundary.write_exceptions)?,
    )?])?;
    config["annotations"][RUNTIME_BUNDLE_HANDOFF_EXTENSION] = json!(RUNTIME_BUNDLE_HANDOFF_MOVE_V2);
    config["annotations"][STORAGE_PATH_RESTRICTIONS_EXTENSION] =
        json!(restrictions.to_annotation_value()?);
    config
        .as_object_mut()
        .context("invalid OCI template")?
        .remove("hooks");
    config["process"]["args"] =
        json!(["/bin/bash", "--noprofile", "--norc", "-c", request.command]);
    config["process"]["cwd"] = json!(workspace);
    // Virtio-fs preserves Host ownership. Map container root onto the caller
    // so a mode 0700 workspace is readable without a DAC override.
    let uid = unsafe { libc::geteuid() };
    let gid = unsafe { libc::getegid() };
    let (user, group) = workspace_id_map(uid, gid);
    config["linux"]["uidMappings"] = json!([user]);
    config["linux"]["gidMappings"] = json!([group]);
    config["process"]["capabilities"] =
        json!({"bounding":[],"effective":[],"permitted":[],"inheritable":[],"ambient":[]});
    config["hostname"] = json!("aster");
    config
        .as_object_mut()
        .context("invalid OCI template")?
        .remove("domainname");
    let linux = config["linux"]
        .as_object_mut()
        .context("OCI template has no Linux configuration")?;
    linux.remove("cgroupsPath");
    linux.remove("timeOffsets");
    if let Some(namespaces) = linux
        .get_mut("namespaces")
        .and_then(serde_json::Value::as_array_mut)
    {
        namespaces.retain(|namespace| namespace["type"] != "time");
    }

    let mut environment =
        a3s_sandbox::sandboxed_command_environment(Path::new("/tmp"), request.env.as_deref())?;
    let requested_path = request
        .env
        .as_deref()
        .and_then(|environment| environment.get("PATH"))
        .map(String::as_str)
        .unwrap_or("");
    let system_path = "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";
    let path = if requested_path.is_empty() {
        system_path.to_owned()
    } else {
        format!("{requested_path}:{system_path}")
    };
    environment.insert("PATH".into(), path.into());
    config["process"]["env"] = json!(environment
        .into_iter()
        .map(|(key, value)| {
            Ok(format!(
                "{}={}",
                key.into_string()
                    .map_err(|_| anyhow::anyhow!("command environment key is not UTF-8"))?,
                value
                    .into_string()
                    .map_err(|_| anyhow::anyhow!("command environment value is not UTF-8"))?
            ))
        })
        .collect::<Result<Vec<_>>>()?);
    let mounts = config["mounts"]
        .as_array_mut()
        .context("OCI template has no mounts")?;
    let index = mounts.len();
    mounts.push(json!({"source":workspace,"destination":workspace,"type":"none","options":["rbind","rw","nodev","nosuid"]}));
    let encoded = serde_json::to_string(&config)?;
    std::fs::write(&config_path, &encoded)?;
    std::fs::set_permissions(&config_path, std::fs::Permissions::from_mode(0o600))?;
    let bundle = OciBundle::from_json(directory, encoded)?;
    let attachments = CreateAttachments::from_bundle(&bundle, ProcessIo::default())?
        .attach_storage_mount(
            &bundle,
            index,
            StorageAttachmentId::new("workspace")?,
            StorageAccessMode::ReadWrite,
            StorageOwnership::Caller,
            StorageCleanup::DetachOnly,
        )?
        .with_runtime_bundle_storage_handoff(&bundle)?
        .with_storage_path_restrictions(&bundle)?;
    Ok(CreateRequest {
        context,
        id,
        bundle,
        isolation: IsolationRequest::DedicatedVm,
        attachments,
    })
}

#[cfg(test)]
mod tests {
    use super::workspace_id_map;

    #[test]
    fn maps_container_root_onto_the_caller_only() {
        let (user, group) = workspace_id_map(501, 20);
        assert_eq!(user["containerID"], 0);
        assert_eq!(user["hostID"], 501);
        assert_eq!(user["size"], 1);
        assert_eq!(group["containerID"], 0);
        assert_eq!(group["hostID"], 20);
        assert_eq!(group["size"], 1);
    }
}
