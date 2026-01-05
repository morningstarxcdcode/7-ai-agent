mod engine;
mod models;

use axum::{routing::{get, post}, Json, Router};
use serde::Serialize;
use tracing_subscriber::EnvFilter;

use crate::engine::AutonomousCoderEngine;
use crate::models::{GenerateCodeRequest, GeneratedCode};

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

async fn health() -> axum::Json<HealthResponse> {
    axum::Json(HealthResponse {
        status: "ok",
        service: "autonomous-coder",
    })
}

async fn generate_code(
    axum::extract::State(engine): axum::extract::State<AutonomousCoderEngine>,
    Json(request): Json<GenerateCodeRequest>,
) -> Json<GeneratedCode> {
    Json(engine.generate(request.spec))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let engine = AutonomousCoderEngine::default();
    let app = Router::new()
        .route("/health", get(health))
        .route("/autonomous-coder/generate", post(generate_code))
        .with_state(engine);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3005").await?;
    tracing::info!("autonomous-coder service listening on 3005");
    axum::serve(listener, app).await?;
    Ok(())
}
