use tracing_subscriber::EnvFilter;
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let chatbot = Arc::new(chatbot::ChatbotService::new());
    let state = chatbot::AppState { chatbot };
    let app = chatbot::build_router(state);

    let addr = "127.0.0.1:8004";
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("chatbot service listening on {}", addr);
    axum::serve(listener, app).await?;
    Ok(())
}
