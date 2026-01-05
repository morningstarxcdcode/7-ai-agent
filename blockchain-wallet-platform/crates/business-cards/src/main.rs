mod models;
mod store;

use axum::{extract::Path, routing::{get, post, put}, Json, Router};
use serde::Serialize;
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

use crate::models::{BusinessCardData, BusinessCardVersion, CreateCardRequest, UpdateCardRequest};
use crate::store::BusinessCardStore;

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

async fn health() -> axum::Json<HealthResponse> {
    axum::Json(HealthResponse {
        status: "ok",
        service: "business-cards",
    })
}

async fn create_card(
    axum::extract::State(store): axum::extract::State<BusinessCardStore>,
    Json(request): Json<CreateCardRequest>,
) -> Json<BusinessCardVersion> {
    let card = store.create_card(request.data).await;
    Json(card)
}

async fn update_card(
    axum::extract::State(store): axum::extract::State<BusinessCardStore>,
    Path(card_id): Path<Uuid>,
    Json(request): Json<UpdateCardRequest>,
) -> Option<Json<BusinessCardVersion>> {
    store.update_card(card_id, request.data).await.map(Json)
}

async fn card_history(
    axum::extract::State(store): axum::extract::State<BusinessCardStore>,
    Path(card_id): Path<Uuid>,
) -> Json<Vec<BusinessCardVersion>> {
    Json(store.history(card_id).await)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let store = BusinessCardStore::default();
    let app = Router::new()
        .route("/health", get(health))
        .route("/business-cards", post(create_card))
        .route("/business-cards/:card_id", put(update_card))
        .route("/business-cards/:card_id/history", get(card_history))
        .with_state(store);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3004").await?;
    tracing::info!("business-cards service listening on 3004");
    axum::serve(listener, app).await?;
    Ok(())
}
