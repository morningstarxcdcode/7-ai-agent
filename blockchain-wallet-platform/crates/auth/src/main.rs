mod config;
mod handlers;
mod jwt;
mod models;
mod oauth;
mod repository;
mod sessions;

use axum::{routing::get, Router};
use serde::Serialize;
use tracing_subscriber::EnvFilter;

use crate::config::Settings;
use crate::repository::{SqlxUserRepository, UserRepository};
use std::sync::Arc;

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

async fn health() -> axum::Json<HealthResponse> {
    axum::Json(HealthResponse {
        status: "ok",
        service: "auth",
    })
}

#[derive(Clone)]
pub struct AppState {
    pub(crate) settings: Settings,
    pub(crate) user_repo: Arc<dyn UserRepository>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let settings = Settings::from_env()?;
    let pool = sqlx::PgPoolOptions::new()
        .max_connections(5)
        .connect(&settings.database_url)
        .await?;
    let user_repo: Arc<dyn UserRepository> = Arc::new(SqlxUserRepository::new(pool));
    let server_addr = settings.server_addr.clone();
    let state = AppState { settings, user_repo };

    let app = Router::new()
        .route("/health", get(health))
        .route("/auth/google/login", get(handlers::google_login))
        .route("/auth/google/callback", get(handlers::google_callback))
        .route("/auth/verify", get(handlers::verify_token))
        .route("/auth/session/restore", get(handlers::restore_session))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&server_addr).await?;
    tracing::info!("auth service listening on {}", server_addr);
    axum::serve(listener, app).await?;
    Ok(())
}
