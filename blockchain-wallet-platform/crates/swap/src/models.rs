use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteRequest {
    pub from_token: String,
    pub to_token: String,
    pub amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapQuote {
    pub from_token: String,
    pub to_token: String,
    pub from_amount: String,
    pub to_amount: String,
    pub price_impact: String,
    pub gas_estimate: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapExecuteRequest {
    pub from_token: String,
    pub to_token: String,
    pub amount: String,
    pub user_address: String,
    pub slippage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapExecuteResponse {
    pub transaction_id: String,
    pub tx_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    pub symbol: String,
    pub name: String,
    pub address: String,
    pub decimals: u8,
}
