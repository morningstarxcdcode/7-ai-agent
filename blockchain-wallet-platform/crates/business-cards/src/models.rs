use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BusinessCardData {
    pub name: String,
    pub title: String,
    pub company: String,
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BusinessCardVersion {
    pub id: Uuid,
    pub card_id: Uuid,
    pub data: BusinessCardData,
    pub version: u32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCardRequest {
    pub data: BusinessCardData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCardRequest {
    pub data: BusinessCardData,
}
