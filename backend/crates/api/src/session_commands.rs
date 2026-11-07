use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use totp_rs::Builder;
use uuid::Uuid;

use crate::{
    AppState, csrf,
    error::ApiError,
    identity::{IdentityBackend, PasswordCredentials},
    session_status::SessionStatusResponse,
};

const MAX_EMAIL_BYTES: usize = 320;
const MAX_PASSWORD_BYTES: usize = 1_024;
pub const MAX_PENDING_TWO_FACTOR_LOGIN_AGE_SECONDS: i64 = 15 * 60;
pub const PENDING_TWO_FACTOR_LOGIN_KEY: &str = "wicked_pending_two_factor_login";

#[derive(Clone, Deserialize, Serialize)]
pub struct PendingTwoFactorLogin {
    pub password_verifier: String,
    pub started_at_unix_seconds: i64,
    pub subject_id: Uuid,
}

pub fn pending_two_factor_login_is_fresh(pending: &PendingTwoFactorLogin, now: i64) -> bool {
    now >= pending.started_at_unix_seconds
        && now - pending.started_at_unix_seconds <= MAX_PENDING_TWO_FACTOR_LOGIN_AGE_SECONDS
}

#[derive(Deserialize)]
pub struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Deserialize)]
pub struct TwoFactorChallengeRequest {
    code: Option<String>,
    recovery_code: Option<String>,
}

enum TwoFactorChallenge<'request> {
    RecoveryCode(&'request str),
    Totp(&'request str),
}

#[derive(FromRow)]
struct ActiveFactorRow {
    encrypted_secret: Vec<u8>,
    encryption_nonce: Vec<u8>,
    last_accepted_step: Option<i64>,
}

pub async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    mut auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<SessionStatusResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let normalized_email = request.email.trim().to_lowercase();
    if normalized_email.is_empty()
        || normalized_email.len() > MAX_EMAIL_BYTES
        || request.password.len() > MAX_PASSWORD_BYTES
    {
        return Err(ApiError::invalid_credentials());
    }

    let subject = auth_session
        .authenticate(PasswordCredentials {
            normalized_email,
            password: request.password,
        })
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::invalid_credentials)?;
    if auth_session
        .backend
        .requires_two_factor(subject.subject_id())
        .await
        .map_err(|_| ApiError::service_unavailable())?
    {
        auth_session
            .session
            .cycle_id()
            .await
            .map_err(|_| ApiError::service_unavailable())?;
        auth_session
            .session
            .insert(
                PENDING_TWO_FACTOR_LOGIN_KEY,
                PendingTwoFactorLogin {
                    password_verifier: subject.password_verifier().to_owned(),
                    started_at_unix_seconds: time::OffsetDateTime::now_utc().unix_timestamp(),
                    subject_id: subject.subject_id(),
                },
            )
            .await
            .map_err(|_| ApiError::service_unavailable())?;

        return Ok(Json(SessionStatusResponse {
            authenticated: false,
            subject_id: None,
            two_factor_required: true,
        }));
    }
    auth_session
        .login(&subject)
        .await
        .map_err(|_| ApiError::service_unavailable())?;

    Ok(Json(SessionStatusResponse {
        authenticated: true,
        subject_id: Some(subject.subject_id()),
        two_factor_required: false,
    }))
}

pub async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    mut auth_session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    auth_session
        .logout()
        .await
        .map_err(|_| ApiError::service_unavailable())?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn complete_two_factor(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    mut auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<TwoFactorChallengeRequest>,
) -> Result<Json<SessionStatusResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let pending = auth_session
        .session
        .get::<PendingTwoFactorLogin>(PENDING_TWO_FACTOR_LOGIN_KEY)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::two_factor_challenge_rejected)?;
    if !pending_two_factor_login_is_fresh(
        &pending,
        time::OffsetDateTime::now_utc().unix_timestamp(),
    ) {
        let _ = auth_session
            .session
            .remove::<PendingTwoFactorLogin>(PENDING_TWO_FACTOR_LOGIN_KEY)
            .await;
        return Err(ApiError::two_factor_challenge_rejected());
    }
    let subject = auth_session
        .backend
        .active_subject_for_id(pending.subject_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::two_factor_challenge_rejected)?;
    if subject.password_verifier() != pending.password_verifier {
        return Err(ApiError::two_factor_challenge_rejected());
    }
    match parse_two_factor_challenge(&request) {
        Some(TwoFactorChallenge::Totp(code)) => {
            verify_totp(&state, subject.subject_id(), code).await?
        }
        Some(TwoFactorChallenge::RecoveryCode(code)) => {
            verify_recovery_code(&state, subject.subject_id(), code).await?
        }
        None => return Err(ApiError::two_factor_challenge_rejected()),
    }
    auth_session
        .session
        .remove::<PendingTwoFactorLogin>(PENDING_TWO_FACTOR_LOGIN_KEY)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    auth_session
        .login(&subject)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(Json(SessionStatusResponse {
        authenticated: true,
        subject_id: Some(subject.subject_id()),
        two_factor_required: false,
    }))
}

async fn verify_recovery_code(
    state: &AppState,
    subject_id: Uuid,
    code: &str,
) -> Result<(), ApiError> {
    #[derive(FromRow)]
    struct RecoveryRow {
        id: Uuid,
        code_hash: String,
    }
    let mut transaction = state
        .identity_database
        .begin()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let rows = sqlx::query_as::<_, RecoveryRow>("SELECT id, code_hash FROM identity_totp_recovery_code_verifiers WHERE subject_id = $1 AND used_at IS NULL FOR UPDATE")
        .bind(subject_id).fetch_all(&mut *transaction).await.map_err(|_| ApiError::service_unavailable())?;
    let Some(row) = rows
        .into_iter()
        .find(|row| crate::passwords::verify(code, &row.code_hash).unwrap_or(false))
    else {
        return Err(ApiError::two_factor_challenge_rejected());
    };
    let used = sqlx::query("UPDATE identity_totp_recovery_code_verifiers SET used_at = NOW() WHERE id = $1 AND used_at IS NULL")
        .bind(row.id).execute(&mut *transaction).await.map_err(|_| ApiError::service_unavailable())?;
    if used.rows_affected() != 1 {
        return Err(ApiError::two_factor_challenge_rejected());
    }
    transaction
        .commit()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(())
}

async fn verify_totp(state: &AppState, subject_id: Uuid, code: &str) -> Result<(), ApiError> {
    let mut transaction = state
        .identity_database
        .begin()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let factor = sqlx::query_as::<_, ActiveFactorRow>("SELECT encrypted_secret, encryption_nonce, last_accepted_step FROM identity_totp_factors WHERE subject_id = $1 AND confirmed_at IS NOT NULL FOR UPDATE")
        .bind(subject_id).fetch_optional(&mut *transaction).await.map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::two_factor_challenge_rejected)?;
    let nonce: [u8; 12] = factor
        .encryption_nonce
        .as_slice()
        .try_into()
        .map_err(|_| ApiError::service_unavailable())?;
    let secret = state
        .totp_secret_cipher
        .decrypt(&factor.encrypted_secret, nonce)
        .map_err(|_| ApiError::service_unavailable())?;
    let totp = Builder::new()
        .with_secret(secret)
        .build()
        .map_err(|_| ApiError::service_unavailable())?;
    let step = totp
        .check_current(code)
        .ok_or_else(ApiError::two_factor_challenge_rejected)? as i64;
    if factor.last_accepted_step.is_some_and(|last| step <= last) {
        return Err(ApiError::two_factor_challenge_rejected());
    }
    let changed = sqlx::query("UPDATE identity_totp_factors SET last_accepted_step = $2, updated_at = NOW() WHERE subject_id = $1 AND (last_accepted_step IS NULL OR last_accepted_step < $2)")
        .bind(subject_id).bind(step).execute(&mut *transaction).await.map_err(|_| ApiError::service_unavailable())?;
    if changed.rows_affected() != 1 {
        return Err(ApiError::two_factor_challenge_rejected());
    }
    transaction
        .commit()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(())
}

fn is_six_digit_code(value: &str) -> bool {
    value.len() == 6 && value.bytes().all(|byte| byte.is_ascii_digit())
}

fn parse_two_factor_challenge(
    request: &TwoFactorChallengeRequest,
) -> Option<TwoFactorChallenge<'_>> {
    match (request.code.as_deref(), request.recovery_code.as_deref()) {
        (Some(code), None) if is_six_digit_code(code) => Some(TwoFactorChallenge::Totp(code)),
        (None, Some(code)) if !code.is_empty() && code.len() <= 128 => {
            Some(TwoFactorChallenge::RecoveryCode(code))
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::{
        MAX_PENDING_TWO_FACTOR_LOGIN_AGE_SECONDS, PendingTwoFactorLogin, TwoFactorChallenge,
        TwoFactorChallengeRequest, parse_two_factor_challenge, pending_two_factor_login_is_fresh,
    };

    #[test]
    fn pending_two_factor_logins_expire_after_fifteen_minutes_and_reject_future_timestamps() {
        let pending = PendingTwoFactorLogin {
            password_verifier: "not-a-password".to_owned(),
            started_at_unix_seconds: 1_000,
            subject_id: Uuid::nil(),
        };

        assert!(pending_two_factor_login_is_fresh(&pending, 1_000));
        assert!(pending_two_factor_login_is_fresh(
            &pending,
            1_000 + MAX_PENDING_TWO_FACTOR_LOGIN_AGE_SECONDS
        ));
        assert!(!pending_two_factor_login_is_fresh(
            &pending,
            1_001 + MAX_PENDING_TWO_FACTOR_LOGIN_AGE_SECONDS
        ));
        assert!(!pending_two_factor_login_is_fresh(&pending, 999));
    }

    #[test]
    fn a_challenge_accepts_exactly_one_valid_factor_proof() {
        let totp = TwoFactorChallengeRequest {
            code: Some("123456".to_owned()),
            recovery_code: None,
        };
        assert!(matches!(
            parse_two_factor_challenge(&totp),
            Some(TwoFactorChallenge::Totp("123456"))
        ));

        let recovery = TwoFactorChallengeRequest {
            code: None,
            recovery_code: Some("emergency-code".to_owned()),
        };
        assert!(matches!(
            parse_two_factor_challenge(&recovery),
            Some(TwoFactorChallenge::RecoveryCode("emergency-code"))
        ));

        for request in [
            TwoFactorChallengeRequest {
                code: None,
                recovery_code: None,
            },
            TwoFactorChallengeRequest {
                code: Some("12345a".to_owned()),
                recovery_code: None,
            },
            TwoFactorChallengeRequest {
                code: Some("123456".to_owned()),
                recovery_code: Some("emergency-code".to_owned()),
            },
            TwoFactorChallengeRequest {
                code: None,
                recovery_code: Some(String::new()),
            },
        ] {
            assert!(parse_two_factor_challenge(&request).is_none());
        }
    }
}
