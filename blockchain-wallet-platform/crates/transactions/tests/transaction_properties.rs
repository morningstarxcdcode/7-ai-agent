use proptest::prelude::*;
use uuid::Uuid;

use transactions::models::{CreateTransactionRequest, TransactionStatus};
use transactions::store::TransactionStore;

proptest! {
    #[test]
    fn property_transaction_lifecycle_tracking(amount in "[0-9]{1,6}", to_address in "0x[a-f0-9]{40}") {
        let store = TransactionStore::default();
        let user_id = Uuid::new_v4();
        let request = CreateTransactionRequest {
            user_id,
            amount,
            to_address,
        };

        let record = tokio_test::block_on(store.record_transaction(request));
        prop_assert_eq!(record.status, TransactionStatus::Pending);

        let updated = tokio_test::block_on(store.update_status(record.id, TransactionStatus::Confirmed));
        prop_assert!(updated.is_some());
        prop_assert_eq!(updated.unwrap().status, TransactionStatus::Confirmed);
    }

    #[test]
    fn property_transaction_history_persistence(count in 1usize..25) {
        let store = TransactionStore::default();
        let user_id = Uuid::new_v4();

        for _ in 0..count {
            let request = CreateTransactionRequest {
                user_id,
                amount: "100".to_string(),
                to_address: "0x0000000000000000000000000000000000000000".to_string(),
            };
            tokio_test::block_on(store.record_transaction(request));
        }

        let list = tokio_test::block_on(store.list_by_user(user_id));
        prop_assert_eq!(list.len(), count);
    }
}
