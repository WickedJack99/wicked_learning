use axum::{
    Json,
    http::{HeaderValue, header::CACHE_CONTROL},
    response::{IntoResponse, Response},
};
use axum_csrf::{CsrfConfig, CsrfLayer, CsrfToken, Key, SameSite};
use serde::Serialize;

use crate::error::ApiError;

#[derive(Serialize)]
pub struct CsrfTokenResponse {
    pub token: String,
}

pub fn layer(cookie_key: &str, cookie_secure: bool) -> CsrfLayer {
    let key = Key::try_from(cookie_key.as_bytes())
        .expect("CSRF_COOKIE_KEY was validated before the router was built");

    CsrfLayer::new(
        CsrfConfig::default()
            .with_cookie_name("wicked_learning_csrf")
            .with_cookie_path("/")
            .with_cookie_same_site(SameSite::Strict)
            .with_http_only(true)
            .with_secure(cookie_secure)
            .with_key(Some(key))
            .with_prefix_with_host(cookie_secure),
    )
}

pub async fn show(token: CsrfToken) -> Result<Response, ApiError> {
    let authenticity_token = token
        .authenticity_token()
        .map_err(|_| ApiError::internal_server_error())?;
    let mut response = (
        token,
        Json(CsrfTokenResponse {
            token: authenticity_token,
        }),
    )
        .into_response();
    response
        .headers_mut()
        .insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));

    Ok(response)
}
