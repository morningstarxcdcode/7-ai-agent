mod config;

use axum::{
    body::{Body, Bytes},
    extract::{Path, Request, State},
    http::{Response, StatusCode},
    routing::any,
    Router,
};
use serde::Serialize;

pub use config::Settings;

#[derive(Clone)]
pub struct AppState {
    pub settings: Settings,
    client: reqwest::Client,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

async fn health() -> axum::Json<HealthResponse> {
    axum::Json(HealthResponse {
        status: "ok",
        service: "gateway",
    })
}

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/health", axum::routing::get(health))
        .route("/auth/*path", any(proxy_auth))
        .route("/wallet/*path", any(proxy_wallet))
        .route("/transactions/*path", any(proxy_transactions))
        .route("/business-cards/*path", any(proxy_business_cards))
        .route("/autonomous-coder/*path", any(proxy_autonomous_coder))
        .route("/swap/*path", any(proxy_swap))
        .route("/chat/*path", any(proxy_chat))
        .with_state(state)
}

pub fn build_state(settings: Settings) -> AppState {
    AppState {
        settings,
        client: reqwest::Client::new(),
    }
}

async fn proxy_auth(
    State(state): State<AppState>,
    Path(path): Path<String>,
    req: Request,
) -> Result<Response<Body>, StatusCode> {
    forward(req, &state, &state.settings.auth_base_url, "auth", path).await
}

async fn proxy_wallet(
    State(state): State<AppState>,
    Path(path): Path<String>,
    req: Request,
) -> Result<Response<Body>, StatusCode> {
    forward(req, &state, &state.settings.wallet_base_url, "wallet", path).await
}

async fn proxy_transactions(
    State(state): State<AppState>,
    Path(path): Path<String>,
    req: Request,
) -> Result<Response<Body>, StatusCode> {
    forward(
        req,
        &state,
        &state.settings.transactions_base_url,
        "transactions",
        path,
    )
    .await
}

async fn proxy_business_cards(
    State(state): State<AppState>,
    Path(path): Path<String>,
    req: Request,
) -> Result<Response<Body>, StatusCode> {
    forward(
        req,
        &state,
        &state.settings.business_cards_base_url,
        "business-cards",
        path,
    )
    .await
}

async fn proxy_autonomous_coder(
    State(state): State<AppState>,
    Path(path): Path<String>,
    req: Request,
) -> Result<Response<Body>, StatusCode> {
    forward(
        req,
        &state,
        &state.settings.autonomous_coder_base_url,
        "autonomous-coder",
        path,
    )
    .await
}

async fn proxy_swap(
    State(state): State<AppState>,
    Path(path): Path<String>,
    req: Request,
) -> Result<Response<Body>, StatusCode> {
    forward(
        req,
        &state,
        &state.settings.swap_base_url,
        "swap",
        path,
    )
    .await
}

async fn proxy_chat(
    State(state): State<AppState>,
    Path(path): Path<String>,
    req: Request,
) -> Result<Response<Body>, StatusCode> {
    forward(
        req,
        &state,
        &state.settings.chatbot_base_url,
        "chat",
        path,
    )
    .await
}

async fn forward(
    req: Request,
    state: &AppState,
    base_url: &str,
    prefix: &str,
    path: String,
) -> Result<Response<Body>, StatusCode> {
    let query = req.uri().query().map(|q| format!("?{}", q)).unwrap_or_default();
    let suffix = if path.is_empty() {
        "".to_string()
    } else {
        format!("/{}", path)
    };
    let target = format!(
        "{}/{}{}{}",
        base_url.trim_end_matches('/'),
        prefix.trim_matches('/'),
        suffix,
        query
    );

    let method = req.method().clone();
    let headers = req.headers().clone();
    let body_bytes = to_bytes(req.into_body()).await.map_err(|_| StatusCode::BAD_GATEWAY)?;

    let mut request = state.client.request(method, target);

    for (name, value) in headers.iter() {
        if name == http::header::HOST || name == http::header::CONTENT_LENGTH {
            continue;
        }
        request = request.header(name, value);
    }

    let response = request
        .body(body_bytes)
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let status = response.status();
    let headers = response.headers().clone();
    let bytes = response.bytes().await.map_err(|_| StatusCode::BAD_GATEWAY)?;

    let mut builder = Response::builder().status(status);
    for (name, value) in headers.iter() {
        builder = builder.header(name, value);
    }

    builder
        .body(Body::from(bytes))
        .map_err(|_| StatusCode::BAD_GATEWAY)
}

async fn to_bytes(body: Body) -> Result<Bytes, axum::Error> {
    axum::body::to_bytes(body, usize::MAX).await
}
