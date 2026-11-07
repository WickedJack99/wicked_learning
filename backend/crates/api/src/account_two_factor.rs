use axum::{
    Json,
    extract::State,
    http::{HeaderMap, HeaderValue, header},
    response::IntoResponse,
};
use axum_login::AuthSession;
use serde::Serialize;
use sqlx::PgPool;
use totp_rs::{Builder, Totp};
use uuid::Uuid;

use crate::{AppState, csrf, error::ApiError, identity::IdentityBackend};

const ISSUER: &str = "Wicked Learning";

#[derive(Serialize)]
pub struct PendingTwoFactorSetupResponse {
    pub manual_setup_key: String,
    pub provisioning_url: String,
}

/// Starts a replacement-safe, unconfirmed authenticator enrollment. The
/// browser receives the secret only in this response; the identity database
/// receives only its authenticated encryption output.
pub async fn start_setup(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<impl IntoResponse, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let subject = auth_session
        .user
        .as_ref()
        .ok_or_else(ApiError::authentication_required)?;
    let totp =
        enrollment_totp(subject.normalized_email()).map_err(|_| ApiError::service_unavailable())?;
    let encrypted = state
        .totp_secret_cipher
        .encrypt(totp.secret().as_bytes())
        .map_err(|_| ApiError::service_unavailable())?;

    save_pending_enrollment(
        &state.identity_database,
        subject.subject_id(),
        &encrypted.ciphertext,
        &encrypted.nonce,
    )
    .await
    .map_err(|_| ApiError::service_unavailable())?;

    let mut response_headers = HeaderMap::new();
    response_headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));

    Ok((
        response_headers,
        Json(PendingTwoFactorSetupResponse {
            manual_setup_key: totp.secret().to_base32(),
            provisioning_url: totp.to_url().map_err(|_| ApiError::service_unavailable())?,
        }),
    ))
}

fn enrollment_totp(normalized_email: &str) -> Result<Totp, totp_rs::TotpError> {
    Builder::new()
        .with_account_name(normalized_email)
        .with_issuer(Some(ISSUER))
        .build()
}

async fn save_pending_enrollment(
    identity_database: &PgPool,
    subject_id: Uuid,
    encrypted_secret: &[u8],
    encryption_nonce: &[u8; 12],
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO identity_totp_factors (subject_id, pending_encrypted_secret, pending_encryption_nonce, pending_created_at) \
         VALUES ($1, $2, $3, NOW()) \
         ON CONFLICT (subject_id) DO UPDATE SET \
             pending_encrypted_secret = EXCLUDED.pending_encrypted_secret, \
             pending_encryption_nonce = EXCLUDED.pending_encryption_nonce, \
             pending_created_at = EXCLUDED.pending_created_at, \
             updated_at = NOW()",
    )
    .bind(subject_id)
    .bind(encrypted_secret)
    .bind(encryption_nonce.as_slice())
    .execute(identity_database)
    .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{ISSUER, enrollment_totp};

    #[test]
    fn enrollment_uses_the_source_interoperable_authenticator_profile() {
        let totp = enrollment_totp("learner@example.test")
            .expect("a valid subject builds an enrollment TOTP");

        assert_eq!(totp.digits(), 6);
        assert_eq!(totp.step(), 30);
        assert_eq!(totp.issuer(), Some(ISSUER));
        assert_eq!(totp.account_name(), "learner@example.test");
        assert!(!totp.secret().to_base32().is_empty());
        assert!(
            totp.to_url()
                .expect("a configured authenticator URL")
                .starts_with("otpauth://totp/")
        );
    }
}
