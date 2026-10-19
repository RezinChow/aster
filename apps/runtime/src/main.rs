//! a3s-runtime binary — Gateway `/v1` data-plane.

use std::net::SocketAddr;

use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into());
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8787);
    let addr: SocketAddr = format!("{host}:{port}").parse()?;

    let data_dir = a3s_gateway_runtime::usage::data_dir();
    let state = a3s_gateway_runtime::AppState::new(data_dir);
    let app = a3s_gateway_runtime::http::router(state);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("a3s-runtime listening on http://{addr}");
    tracing::info!(
        "paths: POST /v1/api/services/{{kind}}/invoke (sku in additional parameters) · /v1/api/services/{{kind}}/invoke/{{sku}} · /v1/api/models · /v1/api/usage · /v1/api/events/recent"
    );
    axum::serve(listener, app).await?;
    Ok(())
}
