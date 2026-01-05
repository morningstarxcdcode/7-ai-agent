use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TransactionStatus {
    Pending,
    Confirmed,
    Failed,
}

impl TransactionStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            TransactionStatus::Pending => "pending",
            TransactionStatus::Confirmed => "confirmed",
            TransactionStatus::Failed => "failed",
        }
    }

    pub fn from_str(value: &str) -> Self {
        match value {
            "confirmed" => TransactionStatus::Confirmed,
            "failed" => TransactionStatus::Failed,
            _ => TransactionStatus::Pending,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionRecord {
    pub id: Uuid,
    pub user_id: Uuid,
    pub amount: String,
    pub to_address: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_symbol: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tx_hash: Option<String>,
    pub status: TransactionStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTransactionRequest {
    pub user_id: Uuid,
    pub amount: String,
    pub to_address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTransactionRequest {
    pub status: TransactionStatus,
}
