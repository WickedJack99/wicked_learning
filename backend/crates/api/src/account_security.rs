use axum::{Json, extract::State};
use axum_login::AuthSession;
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

use crate::{AppState, error::ApiError, identity::IdentityBackend};

const SOURCE_PASSWORD_RULES: &str = "minlength: 12";

#[derive(Serialize)]
pub struct SecuritySettingsResponse {
    pub can_manage_passkeys: bool,
    pub can_manage_two_factor: bool,
    pub passkeys: Vec<SecurityPasskeySummary>,
    pub password_rules: &'static str,
    pub requires_confirmation: bool,
    pub two_factor_enabled: bool,
}

#[derive(FromRow, Serialize)]
pub struct SecurityPasskeySummary {
    pub authenticator: Option<String>,
    pub created_at_diff: String,
    pub id: Uuid,
    pub last_used_at_diff: Option<String>,
    pub name: String,
}

#[derive(FromRow)]
struct TwoFactorEnabledRow {
    enabled: bool,
}

/// Reads the complete, non-secret prop set consumed by the copied direct
/// Security page. Unlike the sensitive passkey and recovery-code commands,
/// this is only an owner-scoped display projection; no recent-password
/// confirmation is required just to see enrolled credential labels.
pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<SecuritySettingsResponse>, ApiError> {
    let subject = auth_session
        .user
        .as_ref()
        .ok_or_else(ApiError::authentication_required)?;
    let passkeys = sqlx::query_as::<_, SecurityPasskeySummary>(
        "SELECT id, name, NULL::text AS authenticator, \
         CASE \
           WHEN NOW() - created_at < INTERVAL '1 minute' THEN 'just now' \
           WHEN NOW() - created_at < INTERVAL '1 hour' THEN CONCAT(FLOOR(EXTRACT(EPOCH FROM NOW() - created_at) / 60)::text, CASE WHEN FLOOR(EXTRACT(EPOCH FROM NOW() - created_at) / 60) = 1 THEN ' minute ago' ELSE ' minutes ago' END) \
           WHEN NOW() - created_at < INTERVAL '1 day' THEN CONCAT(FLOOR(EXTRACT(EPOCH FROM NOW() - created_at) / 3600)::text, CASE WHEN FLOOR(EXTRACT(EPOCH FROM NOW() - created_at) / 3600) = 1 THEN ' hour ago' ELSE ' hours ago' END) \
           ELSE CONCAT(FLOOR(EXTRACT(EPOCH FROM NOW() - created_at) / 86400)::text, CASE WHEN FLOOR(EXTRACT(EPOCH FROM NOW() - created_at) / 86400) = 1 THEN ' day ago' ELSE ' days ago' END) \
         END AS created_at_diff, \
         CASE \
           WHEN last_used_at IS NULL THEN NULL \
           WHEN NOW() - last_used_at < INTERVAL '1 minute' THEN 'just now' \
           WHEN NOW() - last_used_at < INTERVAL '1 hour' THEN CONCAT(FLOOR(EXTRACT(EPOCH FROM NOW() - last_used_at) / 60)::text, CASE WHEN FLOOR(EXTRACT(EPOCH FROM NOW() - last_used_at) / 60) = 1 THEN ' minute ago' ELSE ' minutes ago' END) \
           WHEN NOW() - last_used_at < INTERVAL '1 day' THEN CONCAT(FLOOR(EXTRACT(EPOCH FROM NOW() - last_used_at) / 3600)::text, CASE WHEN FLOOR(EXTRACT(EPOCH FROM NOW() - last_used_at) / 3600) = 1 THEN ' hour ago' ELSE ' hours ago' END) \
           ELSE CONCAT(FLOOR(EXTRACT(EPOCH FROM NOW() - last_used_at) / 86400)::text, CASE WHEN FLOOR(EXTRACT(EPOCH FROM NOW() - last_used_at) / 86400) = 1 THEN ' day ago' ELSE ' days ago' END) \
         END AS last_used_at_diff \
         FROM identity_passkeys WHERE subject_id = $1 ORDER BY created_at DESC, id DESC",
    )
    .bind(subject.subject_id())
    .fetch_all(&state.identity_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?;
    let factor = sqlx::query_as::<_, TwoFactorEnabledRow>(
        "SELECT EXISTS(SELECT 1 FROM identity_totp_factors WHERE subject_id = $1) AS enabled",
    )
    .bind(subject.subject_id())
    .fetch_one(&state.identity_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?;

    Ok(Json(SecuritySettingsResponse {
        // Rust exposes both capabilities for every authenticated identity: the
        // endpoint set itself is the equivalent of the pinned source feature
        // flags, and each sensitive command still enforces confirmation.
        can_manage_passkeys: true,
        can_manage_two_factor: true,
        passkeys,
        password_rules: SOURCE_PASSWORD_RULES,
        requires_confirmation: true,
        two_factor_enabled: factor.enabled,
    }))
}

#[cfg(test)]
mod tests {
    use super::{SOURCE_PASSWORD_RULES, SecurityPasskeySummary, SecuritySettingsResponse};
    use uuid::Uuid;

    #[test]
    fn source_security_projection_contains_only_non_secret_page_props() {
        let response = SecuritySettingsResponse {
            can_manage_passkeys: true,
            can_manage_two_factor: true,
            passkeys: vec![SecurityPasskeySummary {
                authenticator: None,
                created_at_diff: "1 minute ago".to_owned(),
                id: Uuid::nil(),
                last_used_at_diff: None,
                name: "Laptop".to_owned(),
            }],
            password_rules: SOURCE_PASSWORD_RULES,
            requires_confirmation: true,
            two_factor_enabled: false,
        };

        let value = serde_json::to_value(response).expect("security projection serializes");
        assert_eq!(value["password_rules"], SOURCE_PASSWORD_RULES);
        assert_eq!(value["passkeys"][0]["id"], Uuid::nil().to_string());
        assert!(value["passkeys"][0].get("credential").is_none());
        assert!(value.get("recovery_codes").is_none());
    }
}
