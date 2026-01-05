use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::models::{CreateTransactionRequest, TransactionRecord, TransactionStatus};

#[derive(Clone, Default)]
pub struct TransactionStore {
    records: Arc<RwLock<HashMap<Uuid, TransactionRecord>>>,
}

impl TransactionStore {
    pub async fn record_transaction(&self, request: CreateTransactionRequest) -> TransactionRecord {
        let now = chrono::Utc::now();
        let record = TransactionRecord {
            id: Uuid::new_v4(),
            user_id: request.user_id,
            amount: request.amount,
            to_address: request.to_address,
            status: TransactionStatus::Pending,
            created_at: now,
            updated_at: now,
        };
        self.records.write().await.insert(record.id, record.clone());
        record
    }

    pub async fn update_status(
        &self,
        id: Uuid,
        status: TransactionStatus,
    ) -> Option<TransactionRecord> {
        let mut records = self.records.write().await;
        let record = records.get_mut(&id)?;
        record.status = status;
        record.updated_at = chrono::Utc::now();
        Some(record.clone())
    }

    pub async fn list_by_user(&self, user_id: Uuid) -> Vec<TransactionRecord> {
        self.records
            .read()
            .await
            .values()
            .filter(|record| record.user_id == user_id)
            .cloned()
            .collect()
    }
}
