use crate::models::*;
use anyhow::Result;
use serde_json::Value;

pub struct ChatbotService;

impl ChatbotService {
    pub fn new() -> Self {
        Self
    }

    pub async fn process_message(
        &self,
        message: &str,
        _context: Option<Value>,
    ) -> Result<ChatResponse> {
        let message_lower = message.to_lowercase();

        // Intent detection based on keywords
        if message_lower.contains("swap") || message_lower.contains("exchange") {
            return self.handle_swap_intent(&message_lower);
        }

        if message_lower.contains("transaction") || message_lower.contains("history") {
            return Ok(ChatResponse {
                response: "Let me show you your transaction history. You can view all your past transactions, including their status and details.".to_string(),
                action: Some(ChatAction::ViewTransactions),
            });
        }

        if message_lower.contains("balance") {
            return Ok(ChatResponse {
                response: "I'll show you your current balance. You can see your ETH balance and other token balances in your dashboard.".to_string(),
                action: Some(ChatAction::ShowBalance),
            });
        }

        if message_lower.contains("help") {
            return Ok(ChatResponse {
                response: "I can help you with:\n\n• Swapping tokens (e.g., 'Swap 0.1 ETH to USDC')\n• Checking your balance\n• Viewing transaction history\n• Sending transactions\n\nWhat would you like to do?".to_string(),
                action: None,
            });
        }

        // Default response
        Ok(ChatResponse {
            response: "I'm here to help! You can ask me to:\n\n• Swap tokens (e.g., 'Swap 0.1 ETH to USDC')\n• Check your balance\n• View transactions\n• And more!\n\nWhat would you like to do?".to_string(),
            action: None,
        })
    }

    fn handle_swap_intent(&self, message: &str) -> Result<ChatResponse> {
        // Parse swap parameters from natural language
        let mut from_token = None;
        let mut to_token = None;
        let mut amount = None;

        // Simple pattern matching for "X ETH to Y" or "swap X to Y"
        let tokens = ["eth", "usdc", "usdt", "dai", "wbtc"];
        
        for token in &tokens {
            if message.contains(token) {
                if from_token.is_none() {
                    from_token = Some(token.to_uppercase());
                } else if to_token.is_none() {
                    to_token = Some(token.to_uppercase());
                }
            }
        }

        // Try to extract amount (simple number detection)
        for word in message.split_whitespace() {
            if let Ok(num) = word.parse::<f64>() {
                if num > 0.0 && amount.is_none() {
                    amount = Some(num.to_string());
                }
            }
        }

        let response = if from_token.is_some() && to_token.is_some() {
            format!(
                "I'll help you swap {} {} to {}. Let me take you to the swap page where you can review the details and confirm the transaction.",
                amount.as_ref().unwrap_or(&"some".to_string()),
                from_token.as_ref().unwrap(),
                to_token.as_ref().unwrap()
            )
        } else {
            "I'll take you to the swap page where you can select tokens and enter the amount you'd like to swap.".to_string()
        };

        Ok(ChatResponse {
            response,
            action: Some(ChatAction::NavigateToSwap {
                from_token,
                to_token,
                amount,
            }),
        })
    }
}

impl Default for ChatbotService {
    fn default() -> Self {
        Self::new()
    }
}
