use oauth2::{
    basic::BasicClient, AuthUrl, ClientId, ClientSecret, RedirectUrl, TokenUrl,
};

pub fn build_google_client(
    client_id: &str,
    client_secret: &str,
    redirect_url: &str,
) -> Result<BasicClient, oauth2::url::ParseError> {
    let auth_url = AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".to_string())?;
    let token_url = TokenUrl::new("https://oauth2.googleapis.com/token".to_string())?;

    Ok(BasicClient::new(
        ClientId::new(client_id.to_string()),
        Some(ClientSecret::new(client_secret.to_string())),
        auth_url,
        Some(token_url),
    )
    .set_redirect_uri(RedirectUrl::new(redirect_url.to_string())?))
}
