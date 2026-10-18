//! Independent human-proof process.
//!
//! `A3S_AUTH_DATABASE_URL` selects the Postgres store. Without it the process
//! uses an in-memory store, logs the degrade, and `/health` stays unavailable.
//! `A3S_AUTH_DIRECTORY_URL` is the a3s-api origin plus `/v1/api/admin`. Admission
//! then uses `A3S_AUTH_INTERNAL_TOKEN` both to call that directory and to
//! admit credential enrollment and session revocation on this process.
//! `A3S_AUTH_LISTEN` defaults to `127.0.0.1:7641`.
//! `A3S_AUTH_ISSUER` defaults to `https://127.0.0.1:7641`.
//! `A3S_ETCD_ENDPOINTS` optional — registers into Boot discovery when set.

use std::sync::Arc;

use a3s_auth::{
    serve_with, AppState, AuthService, HttpDirectory, InternalGuard, MemoryAuthStore,
    UnknownDirectory,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let issuer =
        std::env::var("A3S_AUTH_ISSUER").unwrap_or_else(|_| "https://127.0.0.1:7641".into());
    let listen = std::env::var("A3S_AUTH_LISTEN").unwrap_or_else(|_| "127.0.0.1:7641".into());
    let port = listen
        .rsplit_once(':')
        .and_then(|(_, port)| port.parse::<u16>().ok())
        .unwrap_or(7641);
    let internal_token = std::env::var("A3S_AUTH_INTERNAL_TOKEN")
        .ok()
        .filter(|value| !value.is_empty());
    if !loopback_listen(&listen) && internal_token.is_none() {
        return Err(
            "A3S_AUTH_INTERNAL_TOKEN is required when A3S_AUTH_LISTEN is not loopback".into(),
        );
    }
    let (store, persists): (Arc<dyn a3s_auth::AuthStore>, bool) = if let Ok(url) =
        std::env::var("A3S_AUTH_DATABASE_URL")
    {
        if url.is_empty() {
            return Err("A3S_AUTH_DATABASE_URL is empty".into());
        }
        (
            Arc::new(a3s_auth::PostgresAuthStore::connect(&url).await?),
            true,
        )
    } else {
        eprintln!(
                "a3s-auth: A3S_AUTH_DATABASE_URL is unset; sessions stay in memory and /health stays unavailable"
            );
        (Arc::new(MemoryAuthStore::new()), false)
    };
    let directory: Arc<dyn a3s_auth::DirectoryAdmission> =
        if let Ok(url) = std::env::var("A3S_AUTH_DIRECTORY_URL") {
            let token = internal_token
                .clone()
                .ok_or("A3S_AUTH_INTERNAL_TOKEN is required when A3S_AUTH_DIRECTORY_URL is set")?;
            Arc::new(HttpDirectory::new(url, token)?)
        } else {
            Arc::new(UnknownDirectory)
        };
    let internal = match internal_token {
        Some(token) => InternalGuard::from_secret(token),
        None => {
            eprintln!(
                "a3s-auth: A3S_AUTH_INTERNAL_TOKEN is unset; enrollment, revocation, and sms sessions stay closed"
            );
            InternalGuard::closed()
        }
    };
    let auth = Arc::new(AuthService::system(store, directory, issuer).with_persistence(persists));

    // Keep registration alive for the process lifetime (Wave A / G1).
    let _discovery = a3s_boot::try_register_from_env("a3s-auth", port).await?;
    if _discovery.is_some() {
        eprintln!("a3s-auth registered with etcd discovery");
    }

    let listener = tokio::net::TcpListener::bind(&listen).await?;
    let bound = listener.local_addr()?;
    eprintln!("a3s-auth listening on {bound}");
    serve_with(listener, AppState { auth, internal }).await?;
    Ok(())
}

fn loopback_listen(listen: &str) -> bool {
    let Some((host, _)) = listen.rsplit_once(':') else {
        return false;
    };
    let host = host.trim_matches(['[', ']']);
    matches!(host, "127.0.0.1" | "localhost" | "::1")
}
