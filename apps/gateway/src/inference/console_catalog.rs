//! Console-managed model catalog delivery (spec 002).
//!
//! Routes that declare a `console_catalog` block serve whatever the console
//! (a3s-api) publishes: the poller fetches the compiled catalog, merges it
//! into a config clone (models, synthesized supplier services, failover
//! policies), and applies it through the standard reload path under the
//! lifecycle lock. A failed fetch keeps the last applied snapshot — the
//! serving plane never degrades to an empty catalog. The first successful
//! poll at boot replaces the route's initially empty model set; until then
//! catalog aliases answer with the named not-granted refusal.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use serde::Deserialize;

use crate::config::{
    ConsoleCatalogConfig, FailoverPolicy, GatewayConfig, InferenceModelConfig, InferenceProtocol,
    InferenceTargetConfig,
};

const CATALOG_PATH: &str = "/v1/api/admin/internal/model-service/catalog";
const FETCH_ATTEMPTS: u32 = 3;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogRoute {
    alias: String,
    failover: String,
    targets: Vec<CatalogTarget>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogTarget {
    supplier_id: String,
    name: String,
    protocol: String,
    base_url: String,
    upstream_model: String,
    priority: u32,
    weight: u32,
}

#[derive(Debug, Deserialize)]
struct CatalogEnvelope {
    success: bool,
    data: Option<CatalogBody>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogBody {
    routes: Vec<CatalogRoute>,
}

/// Spawns the poller when any inference route declares a console catalog.
pub(crate) fn maybe_spawn_catalog_poller(gateway: Arc<crate::gateway::Gateway>) {
    // Snapshot the source config at spawn: the applied config drops the
    // catalog marker, so the poller must remember which routes it owns.
    let bootstrap = gateway.current_effective_config();
    let configs = catalog_configs(&bootstrap);
    if configs.is_empty() {
        return;
    }
    let origin_service = configs[0].api_service.clone();
    let interval = poll_interval(&bootstrap);
    let managed_routes = bootstrap
        .inference
        .as_ref()
        .map(|inference| {
            inference
                .routes
                .values()
                .filter(|route| route.console_catalog.is_some())
                .map(|route| route.route_id)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    tokio::spawn(async move {
        poll_loop(gateway, origin_service, interval, managed_routes).await;
    });
}

fn catalog_configs(config: &GatewayConfig) -> Vec<ConsoleCatalogConfig> {
    config
        .inference
        .as_ref()
        .map(|inference| {
            inference
                .routes
                .values()
                .filter_map(|route| route.console_catalog.clone())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn poll_interval(config: &GatewayConfig) -> Duration {
    let seconds = catalog_configs(config)
        .iter()
        .map(|catalog| catalog.poll_interval_secs)
        .min()
        .unwrap_or(30)
        .max(1);
    Duration::from_secs(seconds)
}

async fn poll_loop(
    gateway: Arc<crate::gateway::Gateway>,
    api_service: String,
    interval: Duration,
    managed_routes: Vec<uuid::Uuid>,
) {
    let mut last_digest = String::new();
    loop {
        let config = gateway.current_effective_config();
        let _ = &config;
        match fetch_catalog(&config, &api_service).await {
            Ok(body) => {
                let digest = digest_of(&body);
                if digest == last_digest {
                    tracing::debug!("console catalog unchanged; keeping snapshot");
                } else {
                    let routes = match parse_catalog(&body) {
                        Ok(routes) => routes,
                        Err(error) => {
                            tracing::warn!(
                                error = %error,
                                "console catalog payload rejected; keeping last snapshot"
                            );
                            tokio::time::sleep(interval).await;
                            continue;
                        }
                    };
                    let managed = managed_routes.clone();
                    let applied = gateway
                        .reload_console_catalog(|current| merge_catalog(current, &routes, &managed))
                        .await;
                    match applied {
                        Ok(()) => {
                            tracing::info!(routes = routes.len(), "console catalog applied");
                            last_digest = digest;
                        }
                        Err(error) => {
                            tracing::warn!(
                                error = %error,
                                "console catalog apply refused; keeping last snapshot"
                            );
                            // Do not record the digest: retry on the next tick.
                        }
                    }
                }
            }
            Err(error) => {
                tracing::warn!(
                    error = %error,
                    "console catalog fetch failed; keeping last snapshot"
                );
            }
        }
        tokio::time::sleep(interval).await;
    }
}

fn parse_catalog(body: &str) -> Result<Vec<CatalogRoute>, String> {
    let envelope: CatalogEnvelope =
        serde_json::from_str(body).map_err(|error| format!("catalog json: {error}"))?;
    if !envelope.success {
        return Err("catalog envelope reported failure".to_string());
    }
    let parsed: CatalogBody = envelope.data.ok_or("catalog envelope carried no data")?;
    for route in &parsed.routes {
        FailoverPolicy::parse(&route.failover)
            .map_err(|error| format!("route {}: {error}", route.alias))?;
        for target in &route.targets {
            use std::str::FromStr;
            InferenceProtocol::from_str(&target.protocol)
                .map_err(|error| format!("route {} target: {error}", route.alias))?;
        }
    }
    Ok(parsed.routes)
}

/// Pure merge: catalog routes replace the `models` of every console-catalog
/// route; each distinct supplier becomes a synthesized service (no health
/// check — a probe failure must not take model routing offline) and the
/// model targets reference it by supplier name, matching how upstream keys
/// are keyed.
fn merge_catalog(
    current: &GatewayConfig,
    routes: &[CatalogRoute],
    managed_routes: &[uuid::Uuid],
) -> GatewayConfig {
    let mut merged = current.clone();
    let Some(inference) = merged.inference.as_mut() else {
        return merged;
    };
    for route_config in inference.routes.values_mut() {
        // The applied snapshot drops the catalog marker; ownership is by
        // the route IDs captured at spawn.
        if !managed_routes.contains(&route_config.route_id) {
            continue;
        }
        let mut models = HashMap::new();
        for catalog_route in routes {
            let failover =
                FailoverPolicy::parse(&catalog_route.failover).unwrap_or(FailoverPolicy::None);
            let mut targets = Vec::with_capacity(catalog_route.targets.len());
            for target in &catalog_route.targets {
                targets.push(InferenceTargetConfig {
                    target_id: uuid::Uuid::new_v4(),
                    service: target.name.clone(),
                    upstream_model: target.upstream_model.clone(),
                    priority: target.priority,
                    weight: target.weight,
                    protocol: std::str::FromStr::from_str(&target.protocol)
                        .unwrap_or(InferenceProtocol::Openai),
                    // The marker the key resolver requires; the secret itself
                    // always comes from the console upstream-keys pull.
                    api_key_env: Some(format!(
                        "CONSOLE_SUPPLIER_{}",
                        target.supplier_id.replace('-', "_")
                    )),
                    translate: false,
                });
            }
            if targets.is_empty() {
                continue;
            }
            models.insert(
                catalog_route.alias.clone(),
                InferenceModelConfig {
                    model_id: uuid::Uuid::new_v4(),
                    failover,
                    pricing: None,
                    latency_bias: false,
                    targets,
                    scheduling: None,
                    routing: None,
                    engine_profile: None,
                },
            );
        }
        route_config.models = models;
        // The applied snapshot carries concrete models; the catalog marker
        // stays only on the source-of-truth config the poller reads.
        route_config.console_catalog = None;
    }
    // Synthesize one service per distinct supplier name and base URL.
    let mut suppliers: HashMap<String, String> = HashMap::new();
    for catalog_route in routes {
        for target in &catalog_route.targets {
            suppliers
                .entry(target.name.clone())
                .or_insert_with(|| origin_of(&target.base_url));
        }
    }
    if !suppliers.is_empty() {
        let services = &mut merged.services;
        for (name, url) in suppliers {
            services
                .entry(name)
                .or_insert_with(|| default_supplier_service(url));
        }
    }
    merged
}

/// Reduces a console baseUrl to its origin: the native inference path
/// keeps the caller path (`/v1/chat/completions`), so a version suffix in
/// the stored baseUrl would double up (the ACL boyue precedent — "Origin
/// has no /v1 suffix").
fn origin_of(baseUrl: &str) -> String {
    // split 'https://host/v1' -> scheme 'https', authority 'host'
    let mut parts = baseUrl.splitn(4, '/');
    match (parts.next(), parts.next(), parts.next(), parts.next()) {
        (Some(scheme), Some(""), Some(authority), _) => {
            let scheme = scheme.trim_end_matches(':');
            format!("{scheme}://{authority}")
        }
        _ => baseUrl.to_string(),
    }
}

/// A supplier service with no health check: model routing must not go
/// offline on probe failures (the boyue precedent in the local spine ACL).
fn default_supplier_service(url: String) -> crate::config::ServiceConfig {
    crate::config::ServiceConfig {
        load_balancer: crate::config::LoadBalancerConfig {
            strategy: Default::default(),
            connect_timeout: "30s".to_string(),
            request_timeout: "120s".to_string(),
            stream_idle_timeout: "5m".to_string(),
            stream_total_timeout: crate::config::default_stream_total_timeout(),
            servers: vec![crate::config::ServerConfig {
                url,
                weight: 1,
                target: None,
            }],
            health_check: None,
            sticky: None,
            tls_ca_file: None,
        },
        scaling: None,
        revisions: Vec::new(),
        rollout: None,
        mirror: None,
        failover: None,
    }
}

fn digest_of(body: &str) -> String {
    use sha2::Digest;
    format!("{:x}", sha2::Sha256::digest(body.as_bytes()))
}

async fn fetch_catalog(config: &GatewayConfig, api_service: &str) -> Result<String, String> {
    let origin = config
        .services
        .get(api_service)
        .and_then(|service| service.load_balancer.servers.first())
        .map(|server| server.url.trim_end_matches('/').to_owned())
        .ok_or_else(|| format!("catalog service '{api_service}' has no server"))?;
    let token = std::env::var("A3S_GATEWAY_ADMIN_TOKEN")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "A3S_GATEWAY_ADMIN_TOKEN is unset".to_string())?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| format!("catalog client: {error}"))?;
    let mut last_error = String::new();
    for attempt in 1..=FETCH_ATTEMPTS {
        let response = client
            .get(format!("{origin}{CATALOG_PATH}"))
            .bearer_auth(&token)
            .send()
            .await;
        match response {
            Ok(response) if response.status().is_success() => {
                let body = response
                    .text()
                    .await
                    .map_err(|error| format!("catalog body: {error}"))?;
                // Never treat an HTML error page as a catalog.
                if body.trim_start().starts_with('<') {
                    return Err("catalog response was not json".to_string());
                }
                return Ok(body);
            }
            Ok(response) => {
                last_error = format!("HTTP {}", response.status());
            }
            Err(error) => {
                last_error = error.to_string();
            }
        }
        if attempt < FETCH_ATTEMPTS {
            tokio::time::sleep(Duration::from_secs(attempt as u64)).await;
        }
    }
    Err(last_error)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn catalog_json(routes: &str) -> String {
        format!("{{\"success\":true,\"data\":{{\"routes\":{routes}}}}}")
    }

    #[test]
    fn origin_strips_version_paths() {
        assert_eq!(
            origin_of("https://api.deepseek.com/v1"),
            "https://api.deepseek.com"
        );
        assert_eq!(
            origin_of("http://35.220.164.252:3888/v1"),
            "http://35.220.164.252:3888"
        );
        assert_eq!(origin_of("http://host:9000"), "http://host:9000");
    }

    #[test]
    fn parse_accepts_the_contract_shape() {
        let routes = r#"[{"alias":"deepseek-v3","failover":"none","targets":[
            {"supplierId":"11111111-1111-4111-8111-111111111111","name":"boyue",
             "protocol":"openai","baseUrl":"https://api.example.com",
             "upstreamModel":"ds-chat","priority":0,"weight":1}]}]"#;
        let parsed = parse_catalog(&catalog_json(routes)).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].alias, "deepseek-v3");
        assert_eq!(parsed[0].targets[0].name, "boyue");
    }

    #[test]
    fn parse_refuses_unknown_failover_and_protocol() {
        let bad_failover = r#"[{"alias":"m","failover":"always","targets":[]}]"#;
        let error = parse_catalog(&catalog_json(bad_failover)).unwrap_err();
        assert!(error.contains("none") && error.contains("retryable_status"));

        let bad_protocol = r#"[{"alias":"m","failover":"none","targets":[
            {"supplierId":"x","name":"s","protocol":"grpc","baseUrl":"https://e",
             "upstreamModel":"m","priority":0,"weight":1}]}]"#;
        assert!(parse_catalog(&catalog_json(bad_protocol)).is_err());
    }
}
