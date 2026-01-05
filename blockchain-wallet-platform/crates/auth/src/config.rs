use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Settings {
    pub server_addr: String,
    pub database_url: String,
    pub google_client_id: String,
    pub google_client_secret: String,
    pub google_redirect_url: String,
    pub jwt_secret: String,
    pub redis_url: String,
}

impl Settings {
    pub fn from_env() -> Result<Self, config::ConfigError> {
        config::Config::builder()
            .add_source(config::Environment::default())
            .build()?
            .try_deserialize()
    }
}
