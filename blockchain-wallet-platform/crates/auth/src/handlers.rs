use axum::{extract::State, response::IntoResponse, Json};
use oauth2::{reqwest::async_http_client, AuthorizationCode, CsrfToken, Scope, TokenResponse};
use serde_json::json;
use uuid::Uuid;

use crate::{
    jwt::{create_jwt, verify_jwt},
    models::{AuthTokens, AuthUrlResponse, OAuthCallbackQuery, SessionRestoreResponse, VerifyTokenResponse},
    oauth::build_google_client,
    repository::NewUser,
    sessions::SessionStore,
    AppState,
};

#[derive(serde::Deserialize)]
struct GoogleUserInfo {
    sub: String,
    email: String,
}

pub async fn google_login(State(state): State<AppState>) -> impl IntoResponse {
    let client = match build_google_client(
        &state.settings.google_client_id,
        &state.settings.google_client_secret,
        &state.settings.google_redirect_url,
    ) {
        Ok(client) => client,
        Err(err) => {
            tracing::error!(error = %err, "oauth client error");
            return Json(json!({"error": "oauth_client_error"}));
        }
    };

    let (auth_url, _csrf_token) = client
        .authorize_url(CsrfToken::new_random)
        .add_scope(Scope::new("openid".to_string()))
        .add_scope(Scope::new("email".to_string()))
        .add_scope(Scope::new("profile".to_string()))
        .url();

    Json(AuthUrlResponse {
        auth_url: auth_url.to_string(),
    })
}

pub async fn google_callback(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<OAuthCallbackQuery>,
) -> impl IntoResponse {
    let client = match build_google_client(
        &state.settings.google_client_id,
        &state.settings.google_client_secret,
        &state.settings.google_redirect_url,
    ) {
        Ok(client) => client,
        Err(err) => {
            tracing::error!(error = %err, "oauth client error");
            return Json(json!({"error": "oauth_client_error"}));
        }
    };

    let token_result = client
        .exchange_code(AuthorizationCode::new(query.code))
        .request_async(async_http_client)
        .await;

    let token = match token_result {
        Ok(token) => token,
        Err(err) => {
            tracing::error!(error = %err, "oauth token exchange failed");
            return Json(json!({"error": "oauth_token_exchange_failed"}));
        }
    };

    let user_info = match reqwest::Client::new()
        .get("https://openidconnect.googleapis.com/v1/userinfo")
        .bearer_auth(token.access_token().secret())
        .send()
        .await
    {
        Ok(response) => match response.json::<GoogleUserInfo>().await {
            Ok(info) => info,
            Err(err) => {
                tracing::error!(error = %err, "failed to parse user info");
                return Json(json!({"error": "user_info_parse_failed"}));
            }
        },
        Err(err) => {
            tracing::error!(error = %err, "failed to fetch user info");
            return Json(json!({"error": "user_info_fetch_failed"}));
        }
    };

    let user = match state.user_repo.find_by_google_sub(&user_info.sub).await {
        Ok(Some(user)) => user,
        Ok(None) => match state
            .user_repo
            .create_user(NewUser {
                google_sub: user_info.sub,
                email: user_info.email,
            })
            .await
        {
            Ok(user) => user,
            Err(err) => {
                tracing::error!(error = %err, "failed to create user");
                return Json(json!({"error": "user_create_failed"}));
            }
        },
        Err(err) => {
            tracing::error!(error = %err, "failed to lookup user");
            return Json(json!({"error": "user_lookup_failed"}));
        }
    };

    let session_store = SessionStore::new(&state.settings.redis_url);
    let session_id = match session_store {
        Ok(store) => match store.create_session(user.id).await {
            Ok(session_id) => session_id,
            Err(err) => {
                tracing::error!(error = %err, "failed to create session");
                return Json(json!({"error": "session_creation_failed"}));
            }
        },
        Err(err) => {
            tracing::error!(error = %err, "failed to connect to redis");
            return Json(json!({"error": "redis_connection_failed"}));
        }
    };

    let access_token = match create_jwt(user.id, &state.settings.jwt_secret) {
        Ok(token) => token,
        Err(err) => {
            tracing::error!(error = %err, "failed to issue jwt");
            return Json(json!({"error": "jwt_issue_failed"}));
        }
    };

    Json(AuthTokens {
        access_token,
        session_id,
    })
}

#[derive(serde::Deserialize)]
pub struct VerifyTokenQuery {
    token: String,
}

pub async fn verify_token(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<VerifyTokenQuery>,
) -> impl IntoResponse {
    match verify_jwt(&query.token, &state.settings.jwt_secret) {
        Ok(claims) => Json(VerifyTokenResponse {
            user_id: claims.sub,
        }),
        Err(err) => {
            tracing::warn!(error = %err, "jwt verification failed");
            Json(json!({"error": "invalid_token"}))
        }
    }
}

#[derive(serde::Deserialize)]
pub struct RestoreSessionQuery {
    session_id: String,
}

pub async fn restore_session(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<RestoreSessionQuery>,
) -> impl IntoResponse {
    let store = match SessionStore::new(&state.settings.redis_url) {
        Ok(store) => store,
        Err(err) => {
            tracing::error!(error = %err, "failed to connect to redis");
            return Json(json!({"error": "redis_connection_failed"}));
        }
    };

    let user_id = match store.restore_session(&query.session_id).await {
        Ok(Some(user_id)) => user_id,
        Ok(None) => return Json(json!({"error": "session_not_found"})),
        Err(err) => {
            tracing::error!(error = %err, "failed to restore session");
            return Json(json!({"error": "session_restore_failed"}));
        }
    };

    let user = match state.user_repo.get_user(user_id).await {
        Ok(Some(user)) => user,
        Ok(None) => return Json(json!({"error": "user_not_found"})),
        Err(err) => {
            tracing::error!(error = %err, "failed to load user");
            return Json(json!({"error": "user_lookup_failed"}));
        }
    };

    Json(SessionRestoreResponse { user })
}
