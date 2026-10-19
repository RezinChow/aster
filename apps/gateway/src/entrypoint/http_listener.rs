//! HTTP transports share request policy and bounded connection draining.

use std::future::Future;
use std::io;
use std::net::SocketAddr;
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::net::TcpListener;

pub(super) trait HttpListener: Send + Sync + 'static {
    const SUPPORTS_TLS: bool;
    type Stream: AsyncRead + AsyncWrite + Unpin + Send + 'static;

    fn accept(&self)
        -> impl Future<Output = io::Result<(Self::Stream, Option<SocketAddr>)>> + Send;
}

impl HttpListener for TcpListener {
    const SUPPORTS_TLS: bool = true;
    type Stream = tokio::net::TcpStream;

    async fn accept(&self) -> io::Result<(Self::Stream, Option<SocketAddr>)> {
        let (stream, remote) = self.accept().await?;
        if let Err(error) = stream.set_nodelay(true) {
            tracing::debug!(error = %error, remote = %remote, "Failed to enable TCP_NODELAY");
        }
        Ok((stream, Some(remote)))
    }
}

#[cfg(unix)]
pub(super) use private_unix::PrivateUnixListener;

#[cfg(unix)]
mod private_unix {
    use super::*;
    use std::os::unix::fs::{FileTypeExt, MetadataExt, PermissionsExt};
    use std::path::{Path, PathBuf};

    pub(crate) struct PrivateUnixListener {
        // Close the listener before removing the owned socket.
        listener: tokio::net::UnixListener,
        _socket: OwnedSocket,
    }

    struct OwnedSocket {
        path: PathBuf,
        device: u64,
        inode: u64,
    }

    impl Drop for OwnedSocket {
        fn drop(&mut self) {
            match std::fs::symlink_metadata(&self.path) {
                Ok(metadata)
                    if metadata.file_type().is_socket()
                        && metadata.dev() == self.device
                        && metadata.ino() == self.inode =>
                {
                    if let Err(error) = std::fs::remove_file(&self.path) {
                        tracing::error!(path = %self.path.display(), error = %error,
                            "Failed to remove owned Unix listener socket");
                    }
                }
                _ => {}
            }
        }
    }

    impl PrivateUnixListener {
        pub(crate) fn bind(path: &Path) -> io::Result<Self> {
            unsafe extern "C" {
                fn geteuid() -> std::os::raw::c_uint;
            }
            // POSIX geteuid reads the process identity and takes no pointers.
            let owner_uid = unsafe { geteuid() };
            let parent = path
                .parent()
                .ok_or_else(|| invalid("Unix socket requires a parent"))?;
            validate_parent(parent, owner_uid)?;
            // bind never unlinks an occupied path, including a stale socket.
            let listener = tokio::net::UnixListener::bind(path)?;
            let metadata = std::fs::symlink_metadata(path)?;
            let socket = OwnedSocket {
                path: path.to_owned(),
                device: metadata.dev(),
                inode: metadata.ino(),
            };
            if !metadata.file_type().is_socket() || metadata.uid() != owner_uid {
                return Err(invalid("Unix socket must belong to the listener owner"));
            }
            std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))?;
            Ok(Self {
                listener,
                _socket: socket,
            })
        }
    }

    pub(super) fn validate_parent(parent: &Path, owner_uid: u32) -> io::Result<()> {
        if parent.canonicalize()? != parent {
            return Err(invalid("Unix socket parent must be canonical"));
        }
        let parent_metadata = std::fs::symlink_metadata(parent)?;
        if !parent_metadata.is_dir() || parent_metadata.mode() & 0o777 != 0o700 {
            return Err(invalid(
                "Unix socket requires a private parent directory (0700)",
            ));
        }
        if parent_metadata.uid() != owner_uid {
            return Err(invalid(
                "Unix socket parent must belong to the listener owner",
            ));
        }
        // An ancestor must not let another user replace the private directory.
        for ancestor in parent.ancestors().skip(1) {
            let ancestor = std::fs::symlink_metadata(ancestor)?;
            if (ancestor.uid() != 0 && ancestor.uid() != owner_uid)
                || (ancestor.mode() & 0o022 != 0 && ancestor.mode() & 0o1000 == 0)
            {
                return Err(invalid("Unix socket has an untrusted writable ancestor"));
            }
        }
        Ok(())
    }

    fn invalid(message: &'static str) -> io::Error {
        io::Error::new(io::ErrorKind::PermissionDenied, message)
    }

    impl HttpListener for PrivateUnixListener {
        const SUPPORTS_TLS: bool = false;
        type Stream = tokio::net::UnixStream;

        async fn accept(&self) -> io::Result<(Self::Stream, Option<SocketAddr>)> {
            self.listener
                .accept()
                .await
                .map(|(stream, _)| (stream, None))
        }
    }
}

#[cfg(all(test, unix))]
#[path = "http_listener_tests.rs"]
mod tests;
