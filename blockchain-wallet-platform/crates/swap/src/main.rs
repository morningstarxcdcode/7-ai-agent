use tracing_subscriber::EnvFilter;
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let swap_service = Arc::new(swap_service::SwapService::new());
    let state = swap_service::AppState { swap_service };
    let app = swap_service::build_router(state);

    let addr = "127.0.0.1:8003";
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("swap-service listening on {}", addr);
    axum::serve(listener, app).await?;
    Ok(())
}
