use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::models::{BusinessCardData, BusinessCardVersion};

#[derive(Clone, Default)]
pub struct BusinessCardStore {
    versions: Arc<RwLock<HashMap<Uuid, Vec<BusinessCardVersion>>>>,
}

impl BusinessCardStore {
    pub async fn create_card(&self, data: BusinessCardData) -> BusinessCardVersion {
        let card_id = Uuid::new_v4();
        let version = BusinessCardVersion {
            id: Uuid::new_v4(),
            card_id,
            data,
            version: 1,
            created_at: chrono::Utc::now(),
        };
        self.versions.write().await.insert(card_id, vec![version.clone()]);
        version
    }

    pub async fn update_card(&self, card_id: Uuid, data: BusinessCardData) -> Option<BusinessCardVersion> {
        let mut versions = self.versions.write().await;
        let entry = versions.get_mut(&card_id)?;
        let next_version = entry.last().map(|v| v.version + 1).unwrap_or(1);
        let version = BusinessCardVersion {
            id: Uuid::new_v4(),
            card_id,
            data,
            version: next_version,
            created_at: chrono::Utc::now(),
        };
        entry.push(version.clone());
        Some(version)
    }

    pub async fn history(&self, card_id: Uuid) -> Vec<BusinessCardVersion> {
        self.versions
            .read()
            .await
            .get(&card_id)
            .cloned()
            .unwrap_or_default()
    }
}
