use axum::{
    Json,
    extract::State,
    http::{HeaderMap, HeaderValue, header},
    response::IntoResponse,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use totp_rs::{Builder, Totp};
use uuid::Uuid;

use crate::{
    AppState, account_password_confirmation, csrf, error::ApiError, identity::IdentityBackend,
};

const ISSUER: &str = "Wicked Learning";
const MAX_PENDING_AGE_MINUTES: i32 = 15;
const RECOVERY_CODE_COUNT: usize = 10;

#[derive(Serialize)]
pub struct PendingTwoFactorSetupResponse {
    pub manual_setup_key: String,
    pub provisioning_url: String,
}

#[derive(Deserialize)]
pub struct ConfirmTwoFactorSetupRequest {
    code: String,
}

#[derive(Serialize)]
pub struct RecoveryCodesResponse {
    pub recovery_codes: Vec<String>,
}

#[derive(Serialize)]
pub struct TwoFactorStatusResponse {
    pub enabled: bool,
}

#[derive(FromRow)]
struct PendingFactorRow {
    pending_encrypted_secret: Vec<u8>,
    pending_encryption_nonce: Vec<u8>,
}

#[derive(FromRow)]
struct RecoveryCodeRow {
    encrypted_code: Vec<u8>,
    encryption_nonce: Vec<u8>,
}

struct RecoveryCodeMaterial {
    code_hash: String,
    encrypted_code: crate::totp_crypto::EncryptedTotpSecret,
}

/// Reports whether the authenticated owner has a confirmed factor. This
/// intentionally exposes no secret or recovery-code material.
pub async fn status(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<TwoFactorStatusResponse>, ApiError> {
    let subject = auth_session
        .user
        .as_ref()
        .ok_or_else(ApiError::authentication_required)?;
    let enabled = factor_is_confirmed(&state.identity_database, subject.subject_id())
        .await
        .map_err(|_| ApiError::service_unavailable())?;

    Ok(Json(TwoFactorStatusResponse { enabled }))
}

/// Lists the owner's still-usable recovery codes, matching the source
/// security control. The values are never cached by an intermediary.
pub async fn recovery_codes(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<impl IntoResponse, ApiError> {
    let subject = auth_session
        .user
        .as_ref()
        .ok_or_else(ApiError::authentication_required)?;
    account_password_confirmation::require(&auth_session).await?;
    let recovery_codes = load_recovery_codes(
        &state.identity_database,
        &state.totp_secret_cipher,
        subject.subject_id(),
    )
    .await
    .map_err(|_| ApiError::service_unavailable())?;

    Ok(no_store_recovery_codes(recovery_codes))
}

/// Replaces every remaining recovery code with a fresh source-sized set.
pub async fn regenerate_recovery_codes(
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
    account_password_confirmation::require(&auth_session).await?;
    if !factor_is_confirmed(&state.identity_database, subject.subject_id())
        .await
        .map_err(|_| ApiError::service_unavailable())?
    {
        return Err(ApiError::not_found());
    }
    let recovery_codes = replace_recovery_codes(
        &state.identity_database,
        &state.totp_secret_cipher,
        subject.subject_id(),
    )
    .await
    .map_err(|_| ApiError::service_unavailable())?;

    Ok(no_store_recovery_codes(recovery_codes))
}

/// Removes the confirmed factor and every recovery-code verifier for the
/// authenticated owner. The foreign-key cascade ensures a disabled factor
/// cannot leave a usable emergency credential behind.
pub async fn disable(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<TwoFactorStatusResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let subject = auth_session
        .user
        .as_ref()
        .ok_or_else(ApiError::authentication_required)?;
    account_password_confirmation::require(&auth_session).await?;
    sqlx::query("DELETE FROM identity_totp_factors WHERE subject_id = $1")
        .bind(subject.subject_id())
        .execute(&state.identity_database)
        .await
        .map_err(|_| ApiError::service_unavailable())?;

    Ok(Json(TwoFactorStatusResponse { enabled: false }))
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
    account_password_confirmation::require(&auth_session).await?;
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

/// Confirms the short-lived pending enrollment and exposes fresh emergency
/// codes exactly once. Until the future login-challenge slice consumes the
/// confirmed factor, no ordinary password-login behavior changes.
pub async fn confirm_setup(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<ConfirmTwoFactorSetupRequest>,
) -> Result<impl IntoResponse, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let subject = auth_session
        .user
        .as_ref()
        .ok_or_else(ApiError::authentication_required)?;
    account_password_confirmation::require(&auth_session).await?;
    if !is_six_digit_code(&request.code) {
        return Err(ApiError::two_factor_setup_rejected());
    }

    let recovery_codes = confirm_pending_enrollment(
        &state.identity_database,
        &state.totp_secret_cipher,
        subject.subject_id(),
        &request.code,
    )
    .await
    .map_err(|error| match error {
        ConfirmEnrollmentError::Rejected => ApiError::two_factor_setup_rejected(),
        ConfirmEnrollmentError::Unavailable => ApiError::service_unavailable(),
    })?;

    let mut response_headers = HeaderMap::new();
    response_headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));

    Ok((
        response_headers,
        Json(RecoveryCodesResponse { recovery_codes }),
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

enum ConfirmEnrollmentError {
    Rejected,
    Unavailable,
}

async fn confirm_pending_enrollment(
    identity_database: &PgPool,
    cipher: &crate::totp_crypto::TotpSecretCipher,
    subject_id: Uuid,
    code: &str,
) -> Result<Vec<String>, ConfirmEnrollmentError> {
    let mut transaction = identity_database
        .begin()
        .await
        .map_err(|_| ConfirmEnrollmentError::Unavailable)?;
    let pending = sqlx::query_as::<_, PendingFactorRow>(
        "SELECT pending_encrypted_secret, pending_encryption_nonce \
         FROM identity_totp_factors \
         WHERE subject_id = $1 \
           AND pending_created_at > NOW() - ($2 * INTERVAL '1 minute') \
         FOR UPDATE",
    )
    .bind(subject_id)
    .bind(MAX_PENDING_AGE_MINUTES)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| ConfirmEnrollmentError::Unavailable)?
    .ok_or(ConfirmEnrollmentError::Rejected)?;
    let nonce = pending
        .pending_encryption_nonce
        .as_slice()
        .try_into()
        .map_err(|_| ConfirmEnrollmentError::Unavailable)?;
    let secret = cipher
        .decrypt(&pending.pending_encrypted_secret, nonce)
        .map_err(|_| ConfirmEnrollmentError::Unavailable)?;
    let totp = Builder::new()
        .with_secret(secret)
        .build()
        .map_err(|_| ConfirmEnrollmentError::Unavailable)?;
    if totp.check_current(code).is_none() {
        return Err(ConfirmEnrollmentError::Rejected);
    }

    let (recovery_codes, recovery_code_material) =
        new_recovery_code_material(cipher).map_err(|_| ConfirmEnrollmentError::Unavailable)?;
    sqlx::query(
        "UPDATE identity_totp_factors SET \
             encrypted_secret = pending_encrypted_secret, \
             encryption_nonce = pending_encryption_nonce, \
             confirmed_at = NOW(), \
             pending_encrypted_secret = NULL, \
             pending_encryption_nonce = NULL, \
             pending_created_at = NULL, \
             updated_at = NOW() \
         WHERE subject_id = $1",
    )
    .bind(subject_id)
    .execute(&mut *transaction)
    .await
    .map_err(|_| ConfirmEnrollmentError::Unavailable)?;
    save_recovery_code_material(&mut transaction, subject_id, recovery_code_material)
        .await
        .map_err(|_| ConfirmEnrollmentError::Unavailable)?;
    transaction
        .commit()
        .await
        .map_err(|_| ConfirmEnrollmentError::Unavailable)?;

    Ok(recovery_codes)
}

fn no_store_recovery_codes(
    recovery_codes: Vec<String>,
) -> (HeaderMap, Json<RecoveryCodesResponse>) {
    let mut response_headers = HeaderMap::new();
    response_headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));

    (
        response_headers,
        Json(RecoveryCodesResponse { recovery_codes }),
    )
}

async fn factor_is_confirmed(
    identity_database: &PgPool,
    subject_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM identity_totp_factors WHERE subject_id = $1 AND confirmed_at IS NOT NULL)",
    )
    .bind(subject_id)
    .fetch_one(identity_database)
    .await
}

async fn replace_recovery_codes(
    identity_database: &PgPool,
    cipher: &crate::totp_crypto::TotpSecretCipher,
    subject_id: Uuid,
) -> Result<Vec<String>, ()> {
    let (recovery_codes, material) = new_recovery_code_material(cipher)?;
    let mut transaction = identity_database.begin().await.map_err(|_| ())?;
    save_recovery_code_material(&mut transaction, subject_id, material)
        .await
        .map_err(|_| ())?;
    transaction.commit().await.map_err(|_| ())?;

    Ok(recovery_codes)
}

fn new_recovery_code_material(
    cipher: &crate::totp_crypto::TotpSecretCipher,
) -> Result<(Vec<String>, Vec<RecoveryCodeMaterial>), ()> {
    let recovery_codes = generate_recovery_codes();
    let material = recovery_codes
        .iter()
        .map(|code| {
            Ok(RecoveryCodeMaterial {
                code_hash: crate::passwords::hash(code).map_err(|_| ())?,
                encrypted_code: cipher.encrypt(code.as_bytes()).map_err(|_| ())?,
            })
        })
        .collect::<Result<Vec<_>, ()>>()?;

    Ok((recovery_codes, material))
}

async fn save_recovery_code_material(
    transaction: &mut Transaction<'_, Postgres>,
    subject_id: Uuid,
    material: Vec<RecoveryCodeMaterial>,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM identity_totp_recovery_code_verifiers WHERE subject_id = $1")
        .bind(subject_id)
        .execute(&mut **transaction)
        .await?;
    for recovery_code in material {
        sqlx::query(
            "INSERT INTO identity_totp_recovery_code_verifiers \
             (id, subject_id, code_hash, encrypted_code, encryption_nonce) \
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(Uuid::new_v4())
        .bind(subject_id)
        .bind(recovery_code.code_hash)
        .bind(recovery_code.encrypted_code.ciphertext)
        .bind(recovery_code.encrypted_code.nonce.as_slice())
        .execute(&mut **transaction)
        .await?;
    }

    Ok(())
}

async fn load_recovery_codes(
    identity_database: &PgPool,
    cipher: &crate::totp_crypto::TotpSecretCipher,
    subject_id: Uuid,
) -> Result<Vec<String>, ()> {
    let rows = sqlx::query_as::<_, RecoveryCodeRow>(
        "SELECT encrypted_code, encryption_nonce \
         FROM identity_totp_recovery_code_verifiers \
         WHERE subject_id = $1 AND used_at IS NULL AND encrypted_code IS NOT NULL \
         ORDER BY created_at, id",
    )
    .bind(subject_id)
    .fetch_all(identity_database)
    .await
    .map_err(|_| ())?;
    rows.into_iter()
        .map(|row| {
            let nonce = row.encryption_nonce.as_slice().try_into().map_err(|_| ())?;
            let plaintext = cipher.decrypt(&row.encrypted_code, nonce).map_err(|_| ())?;
            String::from_utf8(plaintext).map_err(|_| ())
        })
        .collect()
}

fn is_six_digit_code(value: &str) -> bool {
    value.len() == 6 && value.bytes().all(|byte| byte.is_ascii_digit())
}

fn generate_recovery_codes() -> Vec<String> {
    use aes_gcm::aead::rand_core::RngCore;
    use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};

    (0..RECOVERY_CODE_COUNT)
        .map(|_| {
            let mut bytes = [0_u8; 18];
            aes_gcm::aead::OsRng.fill_bytes(&mut bytes);
            URL_SAFE_NO_PAD.encode(bytes)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{
        ISSUER, RECOVERY_CODE_COUNT, enrollment_totp, generate_recovery_codes, is_six_digit_code,
        new_recovery_code_material,
    };

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

    #[test]
    fn confirmation_only_accepts_six_numeric_digits_and_recovery_codes_are_unguessable() {
        assert!(is_six_digit_code("123456"));
        assert!(!is_six_digit_code("12345"));
        assert!(!is_six_digit_code("12345x"));

        let codes = generate_recovery_codes();
        assert_eq!(codes.len(), RECOVERY_CODE_COUNT);
        assert!(codes.iter().all(|code| code.len() == 24));
        assert_eq!(
            codes
                .iter()
                .collect::<std::collections::BTreeSet<_>>()
                .len(),
            codes.len()
        );
    }

    #[test]
    fn recovery_codes_keep_a_verifier_for_login_and_an_encrypted_owner_display_copy() {
        let cipher =
            crate::totp_crypto::TotpSecretCipher::new(*b"test-totp-encryption-key-0000000");
        let (codes, material) =
            new_recovery_code_material(&cipher).expect("recovery-code material is generated");

        assert_eq!(codes.len(), RECOVERY_CODE_COUNT);
        assert_eq!(material.len(), RECOVERY_CODE_COUNT);
        for (code, recovery_code) in codes.iter().zip(material.iter()) {
            assert!(
                crate::passwords::verify(code, &recovery_code.code_hash)
                    .expect("the generated verifier is valid")
            );
            assert_eq!(
                cipher
                    .decrypt(
                        &recovery_code.encrypted_code.ciphertext,
                        recovery_code.encrypted_code.nonce,
                    )
                    .expect("the identity display copy decrypts"),
                code.as_bytes()
            );
        }
    }
}
