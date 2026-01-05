use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Settings {
    pub server_addr: String,
    pub auth_base_url: String,
    pub wallet_base_url: String,
    pub transactions_base_url: String,
    pub business_cards_base_url: String,
    pub autonomous_coder_base_url: String,
    pub swap_base_url: String,
    pub chatbot_base_url: String,
}

impl Settings {
    pub fn from_env() -> Result<Self, config::ConfigError> {
        config::Config::builder()
            .add_source(config::Environment::default().prefix("GATEWAY").separator("_"))
            .build()?
            .try_deserialize()
    }
}
