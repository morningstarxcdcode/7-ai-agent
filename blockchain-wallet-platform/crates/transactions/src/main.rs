use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let state = transactions::build_state();
    let app = transactions::build_router(state);

    let addr = "127.0.0.1:8005";
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("transactions service listening on {}", addr);
    axum::serve(listener, app).await?;
    Ok(())
}

use axum::{extract::Path, routing::{get, post, put}, Json, Router};
use serde::Serialize;
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

use crate::config::Settings;
use crate::models::{CreateTransactionRequest, TransactionRecord, UpdateTransactionRequest};
use crate::repository::{SqlxTransactionRepository, TransactionRepository};
use std::sync::Arc;

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

async fn health() -> axum::Json<HealthResponse> {
    axum::Json(HealthResponse {
        status: "ok",
        service: "transactions",
    })
}

#[derive(Clone)]
struct AppState {
    repo: Arc<dyn TransactionRepository>,
}

async fn create_transaction(
    axum::extract::State(state): axum::extract::State<AppState>,
    Json(request): Json<CreateTransactionRequest>,
) -> Result<Json<TransactionRecord>, axum::http::StatusCode> {
    match state.repo.create(request).await {
        Ok(record) => Ok(Json(record)),
        Err(err) => {
            tracing::error!(error = %err, "failed to create transaction");
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn update_transaction(
    axum::extract::State(state): axum::extract::State<AppState>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateTransactionRequest>,
) -> Result<Option<Json<TransactionRecord>>, axum::http::StatusCode> {
    match state.repo.update(id, request).await {
        Ok(record) => Ok(record.map(Json)),
        Err(err) => {
            tracing::error!(error = %err, "failed to update transaction");
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn list_transactions(
    axum::extract::State(state): axum::extract::State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Vec<TransactionRecord>>, axum::http::StatusCode> {
    match state.repo.list_by_user(user_id).await {
        Ok(records) => Ok(Json(records)),
        Err(err) => {
            tracing::error!(error = %err, "failed to list transactions");
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let settings = Settings::from_env()?;
    let server_addr = settings.server_addr.clone();
    let pool = sqlx::PgPoolOptions::new()
        .max_connections(5)
        .connect(&settings.database_url)
        .await?;
    let repo: Arc<dyn TransactionRepository> = Arc::new(SqlxTransactionRepository::new(pool));
    let state = AppState { repo };
    let app = Router::new()
        .route("/health", get(health))
        .route("/transactions", post(create_transaction))
        .route("/transactions/:id", put(update_transaction))
        .route("/transactions/user/:user_id", get(list_transactions))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&server_addr).await?;
    tracing::info!("transactions service listening on {}", server_addr);
    axum::serve(listener, app).await?;
    Ok(())
}
