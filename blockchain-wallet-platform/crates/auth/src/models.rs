use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize)]
pub struct AuthUrlResponse {
    pub auth_url: String,
}

#[derive(Debug, Deserialize)]
pub struct OAuthCallbackQuery {
    pub code: String,
    pub state: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthTokens {
    pub access_token: String,
    pub session_id: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct User {
    pub id: Uuid,
    pub google_sub: String,
    pub email: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct SessionRestoreResponse {
    pub user: User,
}

#[derive(Debug, Serialize)]
pub struct VerifyTokenResponse {
    pub user_id: String,
}
