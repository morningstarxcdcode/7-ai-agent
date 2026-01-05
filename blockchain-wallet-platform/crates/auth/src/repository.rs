use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::User;

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn find_by_google_sub(&self, sub: &str) -> Result<Option<User>, sqlx::Error>;
    async fn create_user(&self, user: NewUser) -> Result<User, sqlx::Error>;
    async fn get_user(&self, user_id: Uuid) -> Result<Option<User>, sqlx::Error>;
}

#[derive(Debug, Clone)]
pub struct NewUser {
    pub google_sub: String,
    pub email: String,
}

#[derive(Clone)]
pub struct SqlxUserRepository {
    pool: PgPool,
}

impl SqlxUserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UserRepository for SqlxUserRepository {
    async fn find_by_google_sub(&self, sub: &str) -> Result<Option<User>, sqlx::Error> {
        let row = sqlx::query_as::<_, User>(
            "SELECT id, google_sub, email, created_at FROM users WHERE google_sub = $1",
        )
        .bind(sub)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row)
    }

    async fn create_user(&self, user: NewUser) -> Result<User, sqlx::Error> {
        let row = sqlx::query_as::<_, User>(
            "INSERT INTO users (id, google_sub, email) VALUES ($1, $2, $3) RETURNING id, google_sub, email, created_at",
        )
        .bind(Uuid::new_v4())
        .bind(user.google_sub)
        .bind(user.email)
        .fetch_one(&self.pool)
        .await?;
        Ok(row)
    }

    async fn get_user(&self, user_id: Uuid) -> Result<Option<User>, sqlx::Error> {
        let row = sqlx::query_as::<_, User>(
            "SELECT id, google_sub, email, created_at FROM users WHERE id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Arc;
    use tokio::sync::RwLock;

    #[derive(Clone, Default)]
    struct InMemoryRepo {
        users: Arc<RwLock<HashMap<Uuid, User>>>,
        sub_index: Arc<RwLock<HashMap<String, Uuid>>>,
    }

    #[async_trait]
    impl UserRepository for InMemoryRepo {
        async fn find_by_google_sub(&self, sub: &str) -> Result<Option<User>, sqlx::Error> {
            let index = self.sub_index.read().await;
            let users = self.users.read().await;
            Ok(index.get(sub).and_then(|id| users.get(id).cloned()))
        }

        async fn create_user(&self, user: NewUser) -> Result<User, sqlx::Error> {
            let created = User {
                id: Uuid::new_v4(),
                google_sub: user.google_sub,
                email: user.email,
                created_at: chrono::Utc::now(),
            };
            self.sub_index
                .write()
                .await
                .insert(created.google_sub.clone(), created.id);
            self.users.write().await.insert(created.id, created.clone());
            Ok(created)
        }

        async fn get_user(&self, user_id: Uuid) -> Result<Option<User>, sqlx::Error> {
            Ok(self.users.read().await.get(&user_id).cloned())
        }
    }

    #[tokio::test]
    async fn in_memory_repository_round_trip() {
        let repo = InMemoryRepo::default();
        let user = repo
            .create_user(NewUser {
                google_sub: "sub".to_string(),
                email: "user@example.com".to_string(),
            })
            .await
            .expect("create user");

        let fetched = repo
            .find_by_google_sub("sub")
            .await
            .expect("find user")
            .expect("user exists");

        assert_eq!(user.id, fetched.id);
    }
}
