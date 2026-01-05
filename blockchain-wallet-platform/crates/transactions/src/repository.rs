use async_trait::async_trait;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::models::{CreateTransactionRequest, TransactionRecord, TransactionStatus, UpdateTransactionRequest};

#[async_trait]
pub trait TransactionRepository: Send + Sync {
    async fn create(&self, request: CreateTransactionRequest) -> Result<TransactionRecord, sqlx::Error>;
    async fn update(&self, id: Uuid, request: UpdateTransactionRequest) -> Result<Option<TransactionRecord>, sqlx::Error>;
    async fn list_by_user(&self, user_id: Uuid) -> Result<Vec<TransactionRecord>, sqlx::Error>;
}

#[derive(Clone)]
pub struct SqlxTransactionRepository {
    pool: PgPool,
}

impl SqlxTransactionRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl TransactionRepository for SqlxTransactionRepository {
    async fn create(&self, request: CreateTransactionRequest) -> Result<TransactionRecord, sqlx::Error> {
        let id = Uuid::new_v4();
        let status = TransactionStatus::Pending;
        let row = sqlx::query(
            "INSERT INTO transactions (id, user_id, amount, to_address, status) VALUES ($1, $2, $3, $4, $5) \
             RETURNING id, user_id, amount, to_address, status, created_at, updated_at",
        )
        .bind(id)
        .bind(request.user_id)
        .bind(request.amount)
        .bind(request.to_address)
        .bind(status.as_str())
        .fetch_one(&self.pool)
        .await?;

        Ok(TransactionRecord::from_row(row))
    }

    async fn update(&self, id: Uuid, request: UpdateTransactionRequest) -> Result<Option<TransactionRecord>, sqlx::Error> {
        let row = sqlx::query(
            "UPDATE transactions SET status = $1, updated_at = NOW() WHERE id = $2 \
             RETURNING id, user_id, amount, to_address, status, created_at, updated_at",
        )
        .bind(request.status.as_str())
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(TransactionRecord::from_row))
    }

    async fn list_by_user(&self, user_id: Uuid) -> Result<Vec<TransactionRecord>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT id, user_id, amount, to_address, status, created_at, updated_at \
             FROM transactions WHERE user_id = $1 ORDER BY created_at DESC",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(TransactionRecord::from_row).collect())
    }
}

impl TransactionRecord {
    pub fn from_row(row: sqlx::postgres::PgRow) -> Self {
        use sqlx::Row;
        let status: String = row.get("status");
        TransactionRecord {
            id: row.get("id"),
            user_id: row.get("user_id"),
            amount: row.get("amount"),
            to_address: row.get("to_address"),
            status: TransactionStatus::from_str(&status),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        }
    }
}
