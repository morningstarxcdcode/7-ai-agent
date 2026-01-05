mod models;
mod store;

use axum::{extract::Path, routing::{get, post}, Json, Router};
use serde::Serialize;
use tracing_subscriber::EnvFilter;

use crate::models::{RegisterWalletRequest, WalletInfo};
use crate::store::WalletStore;

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

async fn health() -> axum::Json<HealthResponse> {
    axum::Json(HealthResponse {
        status: "ok",
        service: "wallet",
    })
}

async fn register_wallet(
    axum::extract::State(store): axum::extract::State<WalletStore>,
    Json(request): Json<RegisterWalletRequest>,
) -> Json<WalletInfo> {
    let wallet = store.register_wallet(request).await;
    Json(wallet)
}

async fn get_wallet(
    axum::extract::State(store): axum::extract::State<WalletStore>,
    Path(address): Path<String>,
) -> Option<Json<WalletInfo>> {
    store.get_wallet(&address).await.map(Json)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let store = WalletStore::default();
    let app = Router::new()
        .route("/health", get(health))
        .route("/wallet/register", post(register_wallet))
        .route("/wallet/:address", get(get_wallet))
        .with_state(store);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3002").await?;
    tracing::info!("wallet service listening on 3002");
    axum::serve(listener, app).await?;
    Ok(())
}
