use proptest::prelude::*;

use business_cards::models::{BusinessCardData};
use business_cards::store::BusinessCardStore;

proptest! {
    #[test]
    fn property_version_history_maintenance(name in "[a-zA-Z ]{3,20}", title in "[a-zA-Z ]{3,20}") {
        let store = BusinessCardStore::default();
        let initial = BusinessCardData {
            name: name.clone(),
            title: title.clone(),
            company: "Acme".to_string(),
            email: "user@example.com".to_string(),
        };
        let created = tokio_test::block_on(store.create_card(initial));

        let updated = BusinessCardData {
            name,
            title: "Updated".to_string(),
            company: "Acme".to_string(),
            email: "user@example.com".to_string(),
        };
        tokio_test::block_on(store.update_card(created.card_id, updated));

        let history = tokio_test::block_on(store.history(created.card_id));
        prop_assert!(history.len() >= 2);
        prop_assert!(history.iter().any(|entry| entry.version == 1));
    }
}
