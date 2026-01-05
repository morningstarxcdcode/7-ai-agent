use axum::{body::Body, http::Request};
use httpmock::MockServer;
use tower::ServiceExt;

use gateway::{build_router, build_state, Settings};

#[tokio::test]
async fn forwards_auth_requests() {
    let server = MockServer::start_async().await;
    let _mock = server
        .mock_async(|when, then| {
            when.method("GET").path("/auth/google/login");
            then.status(200)
                .header("content-type", "application/json")
                .body("{\"auth_url\":\"https://example.com\"}");
        })
        .await;

    let settings = Settings {
        server_addr: "127.0.0.1:0".to_string(),
        auth_base_url: server.base_url(),
        wallet_base_url: server.base_url(),
        transactions_base_url: server.base_url(),
        business_cards_base_url: server.base_url(),
        autonomous_coder_base_url: server.base_url(),
    };

    let app = build_router(build_state(settings));
    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/auth/google/login")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("response");

    assert!(response.status().is_success());
}

#[tokio::test]
async fn forwards_transaction_requests() {
    let server = MockServer::start_async().await;
    let _mock = server
        .mock_async(|when, then| {
            when.method("POST").path("/transactions");
            then.status(201)
                .header("content-type", "application/json")
                .body("{\"id\":\"00000000-0000-0000-0000-000000000000\"}");
        })
        .await;

    let settings = Settings {
        server_addr: "127.0.0.1:0".to_string(),
        auth_base_url: server.base_url(),
        wallet_base_url: server.base_url(),
        transactions_base_url: server.base_url(),
        business_cards_base_url: server.base_url(),
        autonomous_coder_base_url: server.base_url(),
    };

    let app = build_router(build_state(settings));
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/transactions")
                .header("content-type", "application/json")
                .body(Body::from("{}"))
                .unwrap(),
        )
        .await
        .expect("response");

    assert!(response.status().is_success());
}
