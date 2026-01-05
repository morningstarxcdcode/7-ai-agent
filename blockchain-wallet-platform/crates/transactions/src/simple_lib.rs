use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use serde::Serialize;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use uuid::Uuid;

use crate::models::*;

#[derive(Clone)]
pub struct AppState {
    transactions: Arc<Mutex<HashMap<Uuid, TransactionRecord>>>,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: "transactions",
    })
}

async fn create_transaction(
    State(state): State<AppState>,
    Json(req): Json<CreateTransactionRequest>,
) -> Result<Json<TransactionRecord>, StatusCode> {
    let id = Uuid::new_v4();
    let now = Utc::now();
    
    let record = TransactionRecord {
        id,
        user_id: req.user_id,
        amount: req.amount,
        to_address: req.to_address,
        from_address: None,
        token_symbol: None,
        tx_hash: None,
        status: TransactionStatus::Pending,
        created_at: now,
        updated_at: now,
    };
    
    state.transactions.lock().unwrap().insert(id, record.clone());
    Ok(Json(record))
}

async fn get_transaction(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TransactionRecord>, StatusCode> {
    state
        .transactions
        .lock()
        .unwrap()
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn list_user_transactions(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> Json<Vec<TransactionRecord>> {
    let txs: Vec<_> = state
        .transactions
        .lock()
        .unwrap()
        .values()
        .cloned()
        .collect();
    Json(txs)
}

async fn update_transaction(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateTransactionRequest>,
) -> Result<Json<TransactionRecord>, StatusCode> {
    let mut txs = state.transactions.lock().unwrap();
    if let Some(tx) = txs.get_mut(&id) {
        tx.status = req.status;
        tx.updated_at = Utc::now();
        Ok(Json(tx.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/transactions", post(create_transaction))
        .route("/transactions/:id", get(get_transaction).patch(update_transaction))
        .route("/transactions/user/:user_id", get(list_user_transactions))
        .with_state(state)
}

pub fn build_state() -> AppState {
    AppState {
        transactions: Arc::new(Mutex::new(HashMap::new())),
    }
}
