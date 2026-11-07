use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use uuid::Uuid;
use wicked_learning_application::access_link::{
    AccessLinkForm, AccessLinkItemGrant, AccessLinksCommand, AccessLinksQuery,
};
use wicked_learning_domain::access_link::{
    AccessLinkAdminData, AccessLinkPurpose, AccessLinkSummary, AccessLinkUsagePolicy,
};
use wicked_learning_persistence::access_link::PostgresAccessLinkRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct CreateAccessLinkRequest {
    expires_at: String,
    #[serde(default)]
    item_grants: Vec<ItemGrantRequest>,
    note: Option<String>,
    purpose: AccessLinkPurpose,
    tool_id: Option<String>,
    #[serde(default = "one_time")]
    usage_policy: AccessLinkUsagePolicy,
}

#[derive(Deserialize)]
pub struct ItemGrantRequest {
    item_id: String,
    quantity: i32,
}

#[derive(Deserialize)]
pub struct SetAccessLinkEnabledRequest {
    enabled: bool,
}

#[derive(Serialize)]
pub struct AccessLinkCreatedResponse {
    pub link: AccessLinkSummary,
    pub redeem_url: String,
}

#[derive(Serialize)]
pub struct AccessLinkResponse {
    pub link: AccessLinkSummary,
}

pub async fn preview(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<Json<wicked_learning_domain::access_link::AccessLinkPreview>, ApiError> {
    if token.trim().is_empty() || token.len() > 200 {
        return Err(ApiError::not_found());
    }
    let repository = PostgresAccessLinkRepository::new(&state.application_database);
    AccessLinksCommand::new(&repository)
        .preview(&hex_sha256(token.trim()))
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn index(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<AccessLinkAdminData>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAccessLinkRepository::new(&state.application_database);
    AccessLinksQuery::new(&repository)
        .list(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<CreateAccessLinkRequest>,
) -> Result<(StatusCode, Json<AccessLinkCreatedResponse>), ApiError> {
    let form = form_from_request(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let token = new_token();
    let repository = PostgresAccessLinkRepository::new(&state.application_database);
    let link = AccessLinksCommand::new(&repository)
        .create(&principal, &form, &hex_sha256(&token))
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(AccessLinkCreatedResponse {
            link,
            redeem_url: format!("{}/access-links/{token}", state.public_origin),
        }),
    ))
}

pub async fn set_enabled(
    State(state): State<AppState>,
    Path(link_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SetAccessLinkEnabledRequest>,
) -> Result<Json<AccessLinkResponse>, ApiError> {
    let link_id = Uuid::parse_str(&link_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAccessLinkRepository::new(&state.application_database);
    AccessLinksCommand::new(&repository)
        .set_enabled(&principal, link_id, request.enabled)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|link| Json(AccessLinkResponse { link }))
        .ok_or_else(ApiError::not_found)
}

pub async fn redeem(
    State(state): State<AppState>,
    Path(token): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    if token.trim().is_empty() || token.len() > 200 {
        return Err(ApiError::not_found());
    }
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAccessLinkRepository::new(&state.application_database);
    let redeemed = AccessLinksCommand::new(&repository)
        .redeem(&principal, &hex_sha256(token.trim()))
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    redeemed
        .then_some(StatusCode::NO_CONTENT)
        .ok_or_else(ApiError::not_found)
}

fn form_from_request(request: CreateAccessLinkRequest) -> Result<AccessLinkForm, ApiError> {
    let expires_at = OffsetDateTime::parse(&request.expires_at, &Rfc3339)
        .ok()
        .filter(|expires_at| *expires_at > OffsetDateTime::now_utc())
        .map(|expires_at| expires_at.format(&Rfc3339))
        .transpose()
        .map_err(|_| ApiError::invalid_request())?
        .ok_or_else(ApiError::invalid_request)?;
    let note = request
        .note
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .filter(|value| value.chars().count() <= 500)
        .map(str::to_owned);
    if request.note.is_some()
        && note.is_none()
        && request
            .note
            .as_deref()
            .is_some_and(|value| value.trim().chars().count() > 500)
    {
        return Err(ApiError::invalid_request());
    }
    let item_grants = request
        .item_grants
        .into_iter()
        .map(|grant| {
            Uuid::parse_str(&grant.item_id)
                .map(|item_id| AccessLinkItemGrant {
                    item_id,
                    quantity: grant.quantity,
                })
                .map_err(|_| ApiError::invalid_request())
        })
        .collect::<Result<Vec<_>, _>>()?;
    let tool_id = request
        .tool_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(|value| Uuid::parse_str(value).map_err(|_| ApiError::invalid_request()))
        .transpose()?;
    Ok(AccessLinkForm {
        expires_at,
        item_grants,
        note,
        purpose: request.purpose,
        tool_id,
        usage_policy: request.usage_policy,
    })
}

fn one_time() -> AccessLinkUsagePolicy {
    AccessLinkUsagePolicy::OneTime
}

fn new_token() -> String {
    format!(
        "wlal_{}{}",
        Uuid::new_v4().simple(),
        Uuid::new_v4().simple()
    )
}

fn hex_sha256(value: &str) -> String {
    Sha256::digest(value.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{hex_sha256, new_token};

    #[test]
    fn access_link_tokens_are_opaque_and_only_the_digest_is_persistable() {
        let token = new_token();
        assert!(token.starts_with("wlal_"));
        assert_eq!(token.len(), 69);
        assert_ne!(hex_sha256(&token), token);
        assert_eq!(hex_sha256(&token).len(), 64);
    }
}
