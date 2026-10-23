//! Read-client construction from trusted bootstrap settings only.

use crate::config::StaticObjectAuthorityConfig;
use crate::error::{GatewayError, Result};
use object_store::aws::AmazonS3Builder;
use object_store::client::{HttpClient, HttpConnector};
use object_store::{ClientOptions, ObjectStore, RetryConfig};
use std::io::Read;
use std::sync::Arc;
use std::time::Duration;

pub(crate) fn build_deployment_object_client(
    config: &StaticObjectAuthorityConfig,
) -> Result<Arc<dyn ObjectStore>> {
    build_with_credentials(config, |name| std::env::var(name).ok())
}

fn build_with_credentials(
    config: &StaticObjectAuthorityConfig,
    read: impl Fn(&str) -> Option<String>,
) -> Result<Arc<dyn ObjectStore>> {
    config.validate()?;
    let options = &config.s3;
    let credential = |name: &str| -> Result<String> {
        read(name)
            .filter(|value| {
                !value.is_empty()
                    && value.len() <= 16 * 1024
                    && !value.chars().any(char::is_control)
            })
            .ok_or_else(|| {
                GatewayError::Config(format!(
                    "static object authority credential environment '{name}' is missing or invalid"
                ))
            })
    };
    let access_key = credential(&options.access_key_id_env)?;
    let secret = credential(&options.secret_access_key_env)?;
    let token = options
        .session_token_env
        .as_deref()
        .map(credential)
        .transpose()?;
    let request_timeout = Duration::from_millis(options.request_timeout_ms);
    let mut http = reqwest::Client::builder()
        .timeout(request_timeout)
        .connect_timeout(Duration::from_millis(options.connect_timeout_ms))
        .https_only(!options.allow_http)
        .redirect(reqwest::redirect::Policy::none())
        .no_gzip()
        .no_brotli()
        .no_zstd()
        .no_deflate();
    if let Some(ca_file) = &options.ca_file {
        const MAX_CA_BYTES: u64 = 1024 * 1024;
        let mut bytes = Vec::new();
        std::fs::File::open(ca_file)
            .and_then(|file| file.take(MAX_CA_BYTES + 1).read_to_end(&mut bytes))
            .map_err(|_| {
                GatewayError::Config("static object authority CA file cannot be read".into())
            })?;
        if bytes.is_empty() || bytes.len() as u64 > MAX_CA_BYTES {
            return Err(GatewayError::Config(
                "static object authority CA bundle exceeds its bound".into(),
            ));
        }
        let certificates = reqwest::Certificate::from_pem_bundle(&bytes).map_err(|_| {
            GatewayError::Config("static object authority CA bundle is invalid".into())
        })?;
        if certificates.is_empty() {
            return Err(GatewayError::Config(
                "static object authority CA bundle is empty".into(),
            ));
        }
        for certificate in certificates {
            http = http.add_root_certificate(certificate);
        }
    }
    let http = http.build().map_err(|_| {
        GatewayError::Config("static object authority TLS client could not be constructed".into())
    })?;
    let mut builder = AmazonS3Builder::new()
        .with_endpoint(&options.endpoint)
        .with_region(&options.region)
        .with_bucket_name(&options.bucket)
        .with_access_key_id(access_key)
        .with_secret_access_key(secret)
        .with_virtual_hosted_style_request(options.virtual_hosted_style)
        .with_client_options(ClientOptions::new().with_allow_http(options.allow_http))
        .with_retry(RetryConfig {
            max_retries: 0,
            retry_timeout: request_timeout,
            ..RetryConfig::default()
        })
        .with_http_connector(StaticReadConnector(http));
    if let Some(token) = token {
        builder = builder.with_token(token);
    }
    builder
        .build()
        .map(|store| Arc::new(store) as Arc<dyn ObjectStore>)
        .map_err(|_| {
            GatewayError::Config("static object authority client configuration is invalid".into())
        })
}

#[derive(Debug)]
struct StaticReadConnector(reqwest::Client);

impl HttpConnector for StaticReadConnector {
    fn connect(&self, _options: &ClientOptions) -> object_store::Result<HttpClient> {
        Ok(HttpClient::new(self.0.clone()))
    }
}

#[cfg(test)]
#[path = "s3_tests.rs"]
mod tests;
