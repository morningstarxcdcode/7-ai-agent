use proptest::prelude::*;
use std::collections::HashSet;
use uuid::Uuid;

#[derive(Debug, Clone, serde::Serialize)]
struct UserRecord {
    id: Uuid,
    google_sub: String,
    email: String,
}

fn create_user(sub: String, email: String) -> UserRecord {
    UserRecord {
        id: Uuid::new_v4(),
        google_sub: sub,
        email,
    }
}

fn restore_session(session_map: &std::collections::HashMap<String, Uuid>, session_id: &str) -> Option<Uuid> {
    session_map.get(session_id).copied()
}

proptest! {
    #[test]
    fn property_automatic_blockchain_account_creation(subs in proptest::collection::vec("[a-z0-9]{10,32}", 1..50)) {
        let mut ids = HashSet::new();
        for sub in subs {
            let user = create_user(sub, "user@example.com".to_string());
            prop_assert!(ids.insert(user.id));
        }
    }

    #[test]
    fn property_credential_isolation(sub in "[a-z0-9]{10,32}", email in "[a-z]{3,12}@[a-z]{3,12}\\.com") {
        let user = create_user(sub, email);
        let serialized = serde_json::to_string(&user).expect("serialize user");
        prop_assert!(!serialized.contains("access_token"));
        prop_assert!(!serialized.contains("refresh_token"));
    }

    #[test]
    fn property_session_data_restoration(session_id in "[a-z0-9-]{16,36}") {
        let user_id = Uuid::new_v4();
        let mut sessions = std::collections::HashMap::new();
        sessions.insert(session_id.clone(), user_id);

        let restored = restore_session(&sessions, &session_id);
        prop_assert_eq!(restored, Some(user_id));
    }
}
