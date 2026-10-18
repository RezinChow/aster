//! Explicit host-owned service sockets reachable through guest VSOCK.

use std::collections::HashSet;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::error::{BoxError, Result};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HostServiceSocket {
    pub guest_port: u32,
    pub socket_path: PathBuf,
}

pub fn validate_host_service_sockets(
    sockets: &[HostServiceSocket],
    sidecar_port: Option<u32>,
) -> Result<()> {
    if sockets.len() > 16 {
        return Err(invalid("at most 16 bindings are supported"));
    }
    #[cfg(not(unix))]
    if !sockets.is_empty() {
        return Err(invalid(
            "Unix host service sockets are unavailable on this host",
        ));
    }
    let mut ports = HashSet::new();
    let mut paths = HashSet::new();
    for socket in sockets {
        if socket.guest_port < 1024
            || socket.guest_port == u32::MAX
            || [
                crate::EXEC_VSOCK_PORT,
                crate::PTY_VSOCK_PORT,
                crate::ATTEST_VSOCK_PORT,
                crate::PORT_FWD_VSOCK_PORT,
                crate::config::SIDECAR_VSOCK_PORT,
            ]
            .contains(&socket.guest_port)
            || sidecar_port == Some(socket.guest_port)
            || !ports.insert(socket.guest_port)
        {
            return Err(invalid("guest port is reserved or duplicated"));
        }
        let path = &socket.socket_path;
        let normalized = path.components().collect::<PathBuf>();
        if !path.is_absolute()
            || path.file_name().is_none()
            || path.as_os_str() != normalized.as_os_str()
            || path.components().any(|part| {
                !matches!(
                    part,
                    std::path::Component::RootDir | std::path::Component::Normal(_)
                )
            })
            || path.to_str().is_none()
            || path.as_os_str().as_encoded_bytes().contains(&0)
            || !paths.insert(path)
        {
            return Err(invalid(
                "socket path must be unique, absolute, normalized UTF-8",
            ));
        }
    }
    Ok(())
}

impl HostServiceSocket {
    /// Validate without modifying the service's directory or socket.
    #[cfg(unix)]
    pub fn validate_host_path(&self, owner_uid: u32) -> Result<()> {
        use std::os::unix::fs::{FileTypeExt, MetadataExt};
        validate_host_service_sockets(std::slice::from_ref(self), None)?;
        let parent = self
            .socket_path
            .parent()
            .ok_or_else(|| invalid("missing parent"))?;
        if parent.canonicalize()? != parent {
            return Err(invalid("socket parent must be canonical"));
        }
        let metadata = std::fs::symlink_metadata(parent)?;
        if !metadata.is_dir() || metadata.uid() != owner_uid || metadata.mode() & 0o777 != 0o700 {
            return Err(invalid(
                "socket parent must belong to the launcher and have mode 0700",
            ));
        }
        for ancestor in parent.ancestors().skip(1) {
            let metadata = std::fs::symlink_metadata(ancestor)?;
            if (metadata.uid() != 0 && metadata.uid() != owner_uid)
                || (metadata.mode() & 0o022 != 0 && metadata.mode() & 0o1000 == 0)
            {
                return Err(invalid("socket has an untrusted ancestor"));
            }
        }
        let metadata = std::fs::symlink_metadata(&self.socket_path)?;
        if !metadata.file_type().is_socket()
            || metadata.uid() != owner_uid
            || metadata.mode() & 0o777 != 0o600
        {
            return Err(invalid(
                "service must be a launcher-owned Unix socket with mode 0600",
            ));
        }
        Ok(())
    }
}

fn invalid(message: &str) -> BoxError {
    BoxError::ConfigError(format!("Host service socket: {message}"))
}

#[cfg(test)]
#[path = "host_service_tests.rs"]
mod tests;
