//! Bootstrap-local access to the deployment's existing object authority.
//!
//! Values here never come from a managed traffic snapshot. Credential values
//! are resolved only when constructing the read-only client, not serialized
//! into configuration, persisted snapshots, or public errors.

use crate::error::{GatewayError, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StaticObjectAuthorityConfig {
    pub s3: StaticObjectS3Config,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StaticObjectS3Config {
    pub endpoint: String,
    pub region: String,
    pub bucket: String,
    /// Exact Cloud object prefix including the `web-bundles` subnamespace.
    pub prefix: String,
    pub access_key_id_env: String,
    pub secret_access_key_env: String,
    pub session_token_env: Option<String>,
    pub ca_file: Option<PathBuf>,
    /// Explicitly limited to loopback fixtures; HTTPS is required elsewhere.
    pub allow_http: bool,
    pub virtual_hosted_style: bool,
    pub request_timeout_ms: u64,
    pub connect_timeout_ms: u64,
}

impl StaticObjectAuthorityConfig {
    pub(crate) fn validate(&self) -> Result<()> {
        let s3 = &self.s3;
        let invalid =
            |reason: &str| GatewayError::Config(format!("managed.static_objects.s3 {reason}"));
        let endpoint = url::Url::parse(&s3.endpoint)
            .map_err(|_| invalid("endpoint must be an absolute HTTPS origin"))?;
        if endpoint.host_str().is_none()
            || !endpoint.username().is_empty()
            || endpoint.password().is_some()
            || endpoint.query().is_some()
            || endpoint.fragment().is_some()
            || endpoint.path() != "/"
        {
            return Err(invalid(
                "endpoint must be an origin without credentials, path or query",
            ));
        }
        let loopback = match endpoint.host() {
            Some(url::Host::Ipv4(address)) => address.is_loopback(),
            Some(url::Host::Ipv6(address)) => address.is_loopback(),
            Some(url::Host::Domain("localhost")) => true,
            _ => false,
        };
        if endpoint.scheme() != "https"
            && !(endpoint.scheme() == "http" && s3.allow_http && loopback)
        {
            return Err(invalid(
                "endpoint requires HTTPS; explicit HTTP is loopback-only",
            ));
        }
        if s3.allow_http && !loopback {
            return Err(invalid("allow_http is limited to loopback fixtures"));
        }
        if s3.bucket.is_empty()
            || s3.bucket.len() > 255
            || s3.bucket.contains(['/', '\\', ':', '%'])
            || s3
                .bucket
                .chars()
                .any(|c| c.is_control() || c.is_whitespace())
            || s3.region.is_empty()
            || s3.region.len() > 128
            || s3
                .region
                .chars()
                .any(|c| c.is_control() || c.is_whitespace())
        {
            return Err(invalid(
                "bucket and region must be bounded literal identifiers",
            ));
        }
        if s3.prefix.len() > 1024
            || crate::static_object::normalize_object_path(&s3.prefix)
                .map_err(|_| invalid("prefix must be a canonical relative object namespace"))?
                != s3.prefix
        {
            return Err(invalid(
                "prefix must be a canonical relative object namespace",
            ));
        }
        for name in [&s3.access_key_id_env, &s3.secret_access_key_env]
            .into_iter()
            .chain(s3.session_token_env.iter())
        {
            let mut bytes = name.bytes();
            if name.len() > 128
                || !bytes
                    .next()
                    .is_some_and(|c| c.is_ascii_alphabetic() || c == b'_')
                || !bytes.all(|c| c.is_ascii_alphanumeric() || c == b'_')
            {
                return Err(invalid(
                    "credential environment references must be valid names",
                ));
            }
        }
        if let Some(ca_file) = &s3.ca_file {
            if !ca_file.is_absolute() {
                return Err(invalid("ca_file must be an absolute path"));
            }
        }
        if s3.connect_timeout_ms == 0
            || s3.request_timeout_ms == 0
            || s3.connect_timeout_ms > s3.request_timeout_ms
            || s3.request_timeout_ms > 60_000
        {
            return Err(invalid(
                "timeouts require 0 < connect <= request <= 60000 ms",
            ));
        }
        Ok(())
    }
}
