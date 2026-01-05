pub mod models;
pub mod service;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use std::sync::Arc;

pub use models::*;
pub use service::SwapService;

#[derive(Clone)]
pub struct AppState {
    pub swap_service: Arc<SwapService>,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: "swap",
    })
}

async fn get_quote(
    State(state): State<AppState>,
    Query(params): Query<QuoteRequest>,
) -> Result<Json<SwapQuote>, StatusCode> {
    state
        .swap_service
        .get_quote(&params.from_token, &params.to_token, &params.amount)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn execute_swap(
    State(state): State<AppState>,
    Json(req): Json<SwapExecuteRequest>,
) -> Result<Json<SwapExecuteResponse>, StatusCode> {
    state
        .swap_service
        .execute_swap(req)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_supported_tokens(
    State(state): State<AppState>,
) -> Json<Vec<TokenInfo>> {
    Json(state.swap_service.get_supported_tokens())
}

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/swap/quote", get(get_quote))
        .route("/swap/execute", post(execute_swap))
        .route("/swap/tokens", get(get_supported_tokens))
        .with_state(state)
}
