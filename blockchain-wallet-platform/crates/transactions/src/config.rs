use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Settings {
    pub server_addr: String,
    pub database_url: String,
}

impl Settings {
    pub fn from_env() -> Result<Self, config::ConfigError> {
        config::Config::builder()
            .add_source(config::Environment::default().prefix("TRANSACTIONS").separator("_"))
            .build()?
            .try_deserialize()
    }
}
