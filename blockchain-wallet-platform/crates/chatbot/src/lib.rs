pub mod models;
pub mod service;

use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use std::sync::Arc;

pub use models::*;
pub use service::ChatbotService;

#[derive(Clone)]
pub struct AppState {
    pub chatbot: Arc<ChatbotService>,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: "chatbot",
    })
}

async fn send_message(
    State(state): State<AppState>,
    Json(req): Json<ChatRequest>,
) -> Result<Json<ChatResponse>, StatusCode> {
    state
        .chatbot
        .process_message(&req.message, req.context)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/chat/message", post(send_message))
        .with_state(state)
}
