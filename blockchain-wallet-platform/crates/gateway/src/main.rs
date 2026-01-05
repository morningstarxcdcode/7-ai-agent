use tracing_subscriber::EnvFilter;

use gateway::{build_router, build_state, Settings};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let settings = Settings::from_env()?;
    let server_addr = settings.server_addr.clone();
    let state = build_state(settings);
    let app = build_router(state);

    let listener = tokio::net::TcpListener::bind(&server_addr).await?;
    tracing::info!("gateway listening on {}", server_addr);
    axum::serve(listener, app).await?;
    Ok(())
}
