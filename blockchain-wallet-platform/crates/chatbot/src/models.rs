use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub message: String,
    pub context: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub response: String,
    pub action: Option<ChatAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ChatAction {
    NavigateToSwap {
        from_token: Option<String>,
        to_token: Option<String>,
        amount: Option<String>,
    },
    ViewTransactions,
    ShowBalance,
}
