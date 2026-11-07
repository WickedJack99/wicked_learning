use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use tracing::warn;
use uuid::Uuid;
use webauthn_rs::prelude::{
    CreationChallengeResponse, DiscoverableAuthentication, DiscoverableKey, Passkey,
    PasskeyAuthentication, PasskeyRegistration, PublicKeyCredential, RegisterPublicKeyCredential,
};
use webauthn_rs_proto::options::ResidentKeyRequirement;

use crate::{
    AppState, account_password_confirmation, csrf, error::ApiError, identity::IdentityBackend,
    security_access_audit,
};

const REGISTRATION_KEY: &str = "wicked_passkey_registration";
const DISCOVERABLE_AUTHENTICATION_KEY: &str = "wicked_passkey_discoverable_authentication";
const CONFIRMATION_KEY: &str = "wicked_passkey_confirmation";
const MAX_PASSKEY_NAME_CHARACTERS: usize = 255;
const CEREMONY_TIMEOUT_SECONDS: i64 = 60;

#[derive(Clone, Deserialize, Serialize)]
struct PendingRegistration {
    started_at_unix_seconds: i64,
    state: PasskeyRegistration,
    subject_id: Uuid,
}

#[derive(Clone, Deserialize, Serialize)]
struct PendingDiscoverableAuthentication {
    started_at_unix_seconds: i64,
    state: DiscoverableAuthentication,
}

#[derive(Clone, Deserialize, Serialize)]
struct PendingConfirmation {
    started_at_unix_seconds: i64,
    state: PasskeyAuthentication,
    subject_id: Uuid,
}

#[derive(Deserialize)]
pub struct RegisterPasskeyRequest {
    credential: RegisterPublicKeyCredential,
    name: String,
}

#[derive(Serialize)]
pub struct PasskeyOptionsResponse {
    pub options: Value,
}

#[derive(Serialize)]
pub struct PasskeySummary {
    pub authenticator: Option<String>,
    pub created_at: String,
    pub id: Uuid,
    pub last_used_at: Option<String>,
    pub name: String,
}

#[derive(FromRow)]
struct PasskeyRow {
    created_at: String,
    id: Uuid,
    last_used_at: Option<String>,
    name: String,
}

#[derive(FromRow)]
struct StoredCredentialRow {
    credential: Value,
}

async fn owner_passkeys(state: &AppState, subject_id: Uuid) -> Result<Vec<Passkey>, ApiError> {
    let rows = sqlx::query_scalar::<_, Value>("SELECT credential FROM identity_passkeys WHERE subject_id = $1 ORDER BY created_at DESC, id DESC")
        .bind(subject_id).fetch_all(&state.identity_database).await
        .map_err(|_| ApiError::service_unavailable())?;
    rows.into_iter()
        .map(|credential| {
            serde_json::from_value(credential).map_err(|_| ApiError::service_unavailable())
        })
        .collect()
}

pub async fn list(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<Vec<PasskeySummary>>, ApiError> {
    let subject = auth_session
        .user
        .as_ref()
        .ok_or_else(ApiError::authentication_required)?;
    account_password_confirmation::require(&auth_session).await?;
    let rows = sqlx::query_as::<_, PasskeyRow>(
        "SELECT id, name, \
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, \
         to_char(last_used_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS last_used_at \
         FROM identity_passkeys WHERE subject_id = $1 ORDER BY created_at DESC, id DESC",
    )
    .bind(subject.subject_id())
    .fetch_all(&state.identity_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?;
    Ok(Json(
        rows.into_iter()
            .map(|row| PasskeySummary {
                authenticator: None,
                created_at: row.created_at,
                id: row.id,
                last_used_at: row.last_used_at,
                name: row.name,
            })
            .collect(),
    ))
}

pub async fn delete(
    State(state): State<AppState>,
    Path(passkey_id): Path<Uuid>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<(), ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let subject = auth_session
        .user
        .as_ref()
        .ok_or_else(ApiError::authentication_required)?;
    account_password_confirmation::require(&auth_session).await?;
    let mut transaction = state
        .identity_database
        .begin()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let deleted = sqlx::query("DELETE FROM identity_passkeys WHERE id = $1 AND subject_id = $2")
        .bind(passkey_id)
        .bind(subject.subject_id())
        .execute(&mut *transaction)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    if deleted.rows_affected() != 1 {
        return Err(ApiError::not_found());
    }
    security_access_audit::queue_passkey_change(&mut transaction, subject.subject_id(), false)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    transaction
        .commit()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    if let Err(error) = security_access_audit::deliver_pending(
        &state.identity_database,
        &state.application_database,
    )
    .await
    {
        warn!(%error, "passkey deletion audit delivery will be retried");
    }
    Ok(())
}

pub async fn login_options(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<PasskeyOptionsResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    if auth_session.user.is_some() {
        return Err(ApiError::forbidden());
    }
    let (challenge, ceremony) = state
        .webauthn
        .start_discoverable_authentication()
        .map_err(|_| ApiError::service_unavailable())?;
    auth_session
        .session
        .insert(
            DISCOVERABLE_AUTHENTICATION_KEY,
            PendingDiscoverableAuthentication {
                started_at_unix_seconds: time::OffsetDateTime::now_utc().unix_timestamp(),
                state: ceremony,
            },
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(Json(PasskeyOptionsResponse {
        options: serde_json::to_value(challenge.public_key)
            .map_err(|_| ApiError::service_unavailable())?,
    }))
}

pub async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    mut auth_session: AuthSession<IdentityBackend>,
    Json(credential): Json<PublicKeyCredential>,
) -> Result<Json<crate::session_status::SessionStatusResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    if auth_session.user.is_some() {
        return Err(ApiError::forbidden());
    }
    let pending = auth_session
        .session
        .remove::<PendingDiscoverableAuthentication>(DISCOVERABLE_AUTHENTICATION_KEY)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .filter(|pending| ceremony_is_fresh(pending.started_at_unix_seconds));
    let Some(pending) = pending else {
        return Err(ApiError::invalid_credentials());
    };
    let (subject_id, credential_id) = state
        .webauthn
        .identify_discoverable_authentication(&credential)
        .map_err(|_| ApiError::invalid_credentials())?;
    let mut transaction = state
        .identity_database
        .begin()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let row = sqlx::query_as::<_, StoredCredentialRow>("SELECT credential FROM identity_passkeys WHERE subject_id = $1 AND credential_id = $2 FOR UPDATE")
        .bind(subject_id).bind(credential_id).fetch_optional(&mut *transaction).await
        .map_err(|_| ApiError::service_unavailable())?.ok_or_else(ApiError::invalid_credentials)?;
    let mut passkey: Passkey =
        serde_json::from_value(row.credential).map_err(|_| ApiError::service_unavailable())?;
    let authentication = state
        .webauthn
        .finish_discoverable_authentication_v2(
            &credential,
            pending.state,
            DiscoverableKey::from(&passkey),
        )
        .map_err(|_| ApiError::invalid_credentials())?;
    passkey
        .update_credential(&authentication)
        .ok_or_else(ApiError::invalid_credentials)?;
    sqlx::query("UPDATE identity_passkeys SET credential = $3, last_used_at = NOW() WHERE subject_id = $1 AND credential_id = $2")
        .bind(subject_id).bind(credential_id).bind(serde_json::to_value(&passkey).map_err(|_| ApiError::service_unavailable())?)
        .execute(&mut *transaction).await.map_err(|_| ApiError::service_unavailable())?;
    transaction
        .commit()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let subject = auth_session
        .backend
        .active_subject_for_id(subject_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::invalid_credentials)?;
    auth_session
        .login(&subject)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(Json(crate::session_status::SessionStatusResponse {
        authenticated: true,
        subject_id: Some(subject_id),
        two_factor_required: false,
    }))
}

pub async fn confirmation_options(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<PasskeyOptionsResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let subject = auth_session
        .user
        .as_ref()
        .ok_or_else(ApiError::authentication_required)?;
    let passkeys = owner_passkeys(&state, subject.subject_id()).await?;
    if passkeys.is_empty() {
        return Err(ApiError::not_found());
    }
    let (challenge, ceremony) = state
        .webauthn
        .start_passkey_authentication(&passkeys)
        .map_err(|_| ApiError::service_unavailable())?;
    auth_session
        .session
        .insert(
            CONFIRMATION_KEY,
            PendingConfirmation {
                started_at_unix_seconds: time::OffsetDateTime::now_utc().unix_timestamp(),
                state: ceremony,
                subject_id: subject.subject_id(),
            },
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(Json(PasskeyOptionsResponse {
        options: serde_json::to_value(challenge.public_key)
            .map_err(|_| ApiError::service_unavailable())?,
    }))
}

pub async fn confirm(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(credential): Json<PublicKeyCredential>,
) -> Result<Json<crate::account_password_confirmation::PasswordConfirmationStatusResponse>, ApiError>
{
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let subject = auth_session
        .user
        .as_ref()
        .ok_or_else(ApiError::authentication_required)?;
    let pending = auth_session
        .session
        .remove::<PendingConfirmation>(CONFIRMATION_KEY)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .filter(|pending| {
            pending.subject_id == subject.subject_id()
                && ceremony_is_fresh(pending.started_at_unix_seconds)
        });
    let Some(pending) = pending else {
        return Err(ApiError::invalid_request());
    };
    let authentication = state
        .webauthn
        .finish_passkey_authentication(&credential, &pending.state)
        .map_err(|_| ApiError::invalid_request())?;
    let mut transaction = state
        .identity_database
        .begin()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let row = sqlx::query_as::<_, StoredCredentialRow>("SELECT credential FROM identity_passkeys WHERE subject_id = $1 AND credential_id = $2 FOR UPDATE")
        .bind(subject.subject_id()).bind(authentication.cred_id()).fetch_optional(&mut *transaction).await
        .map_err(|_| ApiError::service_unavailable())?.ok_or_else(ApiError::invalid_request)?;
    let mut passkey: Passkey =
        serde_json::from_value(row.credential).map_err(|_| ApiError::service_unavailable())?;
    passkey
        .update_credential(&authentication)
        .ok_or_else(ApiError::invalid_request)?;
    sqlx::query("UPDATE identity_passkeys SET credential = $3, last_used_at = NOW() WHERE subject_id = $1 AND credential_id = $2")
        .bind(subject.subject_id()).bind(authentication.cred_id()).bind(serde_json::to_value(&passkey).map_err(|_| ApiError::service_unavailable())?)
        .execute(&mut *transaction).await.map_err(|_| ApiError::service_unavailable())?;
    transaction
        .commit()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(Json(
        account_password_confirmation::confirm_with_passkey(&auth_session).await?,
    ))
}

pub async fn registration_options(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<PasskeyOptionsResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let subject = auth_session
        .user
        .as_ref()
        .ok_or_else(ApiError::authentication_required)?;
    account_password_confirmation::require(&auth_session).await?;
    let display_name = sqlx::query_scalar::<_, String>(
        "SELECT display_name FROM identity_profiles WHERE subject_id = $1",
    )
    .bind(subject.subject_id())
    .fetch_optional(&state.identity_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::authentication_required)?;
    let credential_ids = sqlx::query_scalar::<_, Vec<u8>>(
        "SELECT credential_id FROM identity_passkeys WHERE subject_id = $1 ORDER BY created_at DESC, id DESC",
    )
    .bind(subject.subject_id())
    .fetch_all(&state.identity_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?;
    let (mut challenge, ceremony) = state
        .webauthn
        .start_passkey_registration(
            subject.subject_id(),
            subject.normalized_email(),
            &display_name,
            Some(credential_ids),
        )
        .map_err(|_| ApiError::invalid_request())?;
    require_discoverable_credential(&mut challenge);
    auth_session
        .session
        .insert(
            REGISTRATION_KEY,
            PendingRegistration {
                started_at_unix_seconds: time::OffsetDateTime::now_utc().unix_timestamp(),
                state: ceremony,
                subject_id: subject.subject_id(),
            },
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(Json(PasskeyOptionsResponse {
        options: serde_json::to_value(challenge.public_key)
            .map_err(|_| ApiError::service_unavailable())?,
    }))
}

pub async fn register(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<RegisterPasskeyRequest>,
) -> Result<Json<PasskeySummary>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let subject = auth_session
        .user
        .as_ref()
        .ok_or_else(ApiError::authentication_required)?;
    account_password_confirmation::require(&auth_session).await?;
    let name = request.name.trim();
    if name.is_empty() || name.chars().count() > MAX_PASSKEY_NAME_CHARACTERS {
        return Err(ApiError::invalid_request());
    }
    let pending = auth_session
        .session
        .remove::<PendingRegistration>(REGISTRATION_KEY)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .filter(|pending| {
            pending.subject_id == subject.subject_id()
                && ceremony_is_fresh(pending.started_at_unix_seconds)
        });
    let Some(pending) = pending else {
        return Err(ApiError::invalid_request());
    };
    let passkey = state
        .webauthn
        .finish_passkey_registration(&request.credential, &pending.state)
        .map_err(|_| ApiError::invalid_request())?;
    let credential_id = passkey.cred_id().clone();
    let credential = serde_json::to_value(&passkey).map_err(|_| ApiError::service_unavailable())?;
    let id = Uuid::new_v4();
    let mut transaction = state
        .identity_database
        .begin()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    sqlx::query("INSERT INTO identity_passkeys (id, subject_id, name, credential_id, credential) VALUES ($1, $2, $3, $4, $5)")
        .bind(id).bind(subject.subject_id()).bind(name).bind(credential_id).bind(credential)
        .execute(&mut *transaction).await.map_err(|_| ApiError::invalid_request())?;
    security_access_audit::queue_passkey_change(&mut transaction, subject.subject_id(), true)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    transaction
        .commit()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    if let Err(error) = security_access_audit::deliver_pending(
        &state.identity_database,
        &state.application_database,
    )
    .await
    {
        warn!(%error, "passkey registration audit delivery will be retried");
    }
    Ok(Json(PasskeySummary {
        authenticator: None,
        id,
        name: name.to_owned(),
        created_at: time::OffsetDateTime::now_utc()
            .format(&time::format_description::well_known::Rfc3339)
            .map_err(|_| ApiError::service_unavailable())?,
        last_used_at: None,
    }))
}

fn ceremony_is_fresh(started_at: i64) -> bool {
    let now = time::OffsetDateTime::now_utc().unix_timestamp();
    now >= started_at && now - started_at <= CEREMONY_TIMEOUT_SECONDS
}

fn require_discoverable_credential(challenge: &mut CreationChallengeResponse) {
    if let Some(selection) = challenge.public_key.authenticator_selection.as_mut() {
        selection.require_resident_key = true;
        selection.resident_key = Some(ResidentKeyRequirement::Required);
    }
}

#[cfg(test)]
mod tests {
    use super::{
        CEREMONY_TIMEOUT_SECONDS, MAX_PASSKEY_NAME_CHARACTERS, ceremony_is_fresh,
        require_discoverable_credential,
    };
    use webauthn_rs::prelude::WebauthnBuilder;
    use webauthn_rs_proto::options::ResidentKeyRequirement;

    #[test]
    fn passkey_ceremonies_are_limited_to_the_source_timeout() {
        let now = time::OffsetDateTime::now_utc().unix_timestamp();
        assert!(ceremony_is_fresh(now));
        assert!(!ceremony_is_fresh(now - CEREMONY_TIMEOUT_SECONDS - 1));
    }

    #[test]
    fn passkey_labels_use_the_source_bound() {
        assert_eq!(MAX_PASSKEY_NAME_CHARACTERS, 255);
    }

    #[test]
    fn passkey_registration_requests_a_discoverable_credential() {
        let origin = url::Url::parse("http://localhost:8081").expect("a valid local origin");
        let webauthn = WebauthnBuilder::new("localhost", &origin)
            .expect("a valid local relying party")
            .build()
            .expect("a valid WebAuthn configuration");
        let (mut challenge, _) = webauthn
            .start_passkey_registration(
                uuid::Uuid::new_v4(),
                "learner@example.test",
                "Learner",
                None,
            )
            .expect("registration options");

        require_discoverable_credential(&mut challenge);

        let selection = challenge
            .public_key
            .authenticator_selection
            .expect("authentication selection");
        assert!(selection.require_resident_key);
        assert_eq!(
            selection.resident_key,
            Some(ResidentKeyRequirement::Required)
        );
    }
}
