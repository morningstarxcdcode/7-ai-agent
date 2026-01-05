use redis::AsyncCommands;
use uuid::Uuid;

#[derive(Clone)]
pub struct SessionStore {
    client: redis::Client,
}

impl SessionStore {
    pub fn new(redis_url: &str) -> Result<Self, redis::RedisError> {
        Ok(Self {
            client: redis::Client::open(redis_url)?,
        })
    }

    pub async fn create_session(&self, user_id: Uuid) -> Result<String, redis::RedisError> {
        let session_id = Uuid::new_v4().to_string();
        let mut conn = self.client.get_async_connection().await?;
        let key = format!("session:{}", session_id);
        let _: () = conn.set_ex(key, user_id.to_string(), 60 * 60 * 24).await?;
        Ok(session_id)
    }

    pub async fn restore_session(&self, session_id: &str) -> Result<Option<Uuid>, redis::RedisError> {
        let mut conn = self.client.get_async_connection().await?;
        let key = format!("session:{}", session_id);
        let value: Option<String> = conn.get(key).await?;
        Ok(value.and_then(|id| Uuid::parse_str(&id).ok()))
    }
}
