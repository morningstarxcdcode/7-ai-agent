use proptest::prelude::*;
use wallet::models::RegisterWalletRequest;
use wallet::store::WalletStore;

proptest! {
    #[test]
    fn property_private_key_never_exposed(address in "0x[a-f0-9]{40}", pubkey in "[a-f0-9]{66}") {
        let store = WalletStore::default();
        let request = RegisterWalletRequest { address: address.clone(), public_key: pubkey.clone() };
        let wallet = tokio_test::block_on(store.register_wallet(request));
        let serialized = serde_json::to_string(&wallet).expect("serialize wallet");
        prop_assert!(!serialized.to_lowercase().contains("private"));
        prop_assert!(serialized.contains(&address));
    }
}
