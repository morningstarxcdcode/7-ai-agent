use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::models::{RegisterWalletRequest, WalletInfo};

#[derive(Clone, Default)]
pub struct WalletStore {
    wallets: Arc<RwLock<HashMap<String, WalletInfo>>>,
}

impl WalletStore {
    pub async fn register_wallet(&self, request: RegisterWalletRequest) -> WalletInfo {
        let wallet = WalletInfo {
            address: request.address,
            public_key: request.public_key,
            created_at: chrono::Utc::now(),
        };
        self.wallets
            .write()
            .await
            .insert(wallet.address.clone(), wallet.clone());
        wallet
    }

    pub async fn get_wallet(&self, address: &str) -> Option<WalletInfo> {
        self.wallets.read().await.get(address).cloned()
    }
}
