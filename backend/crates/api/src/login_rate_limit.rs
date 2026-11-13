use std::net::IpAddr;

use axum::http::Request;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use tower_governor::{GovernorError, key_extractor::KeyExtractor};

const PASSWORD_LOGIN_BURST_SIZE: i16 = 5;

#[derive(Clone)]
pub struct TrustedProxyClientIp;

impl KeyExtractor for TrustedProxyClientIp {
    type Key = IpAddr;

    fn extract<T>(&self, request: &Request<T>) -> Result<Self::Key, GovernorError> {
        request
            .headers()
            .get("x-real-ip")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.parse().ok())
            .ok_or(GovernorError::UnableToExtractKey)
    }
}

/// Reserves one password-verification attempt for an account. The stored key
/// is a keyed digest, so the identity database does not retain an email
/// address solely for rate limiting. A correct password clears the short-lived
/// record; callers intentionally keep credential responses generic.
pub async fn claim_password_login_attempt(
    identity_database: &PgPool,
    login_rate_limit_key: &[u8; 32],
    normalized_email: &str,
) -> Result<bool, sqlx::Error> {
    let account_key_hash = password_login_account_key(login_rate_limit_key, normalized_email);
    let attempt_count = sqlx::query_scalar::<_, i16>(
        r#"
        WITH expired AS (
            DELETE FROM identity_password_login_rate_limits
            WHERE expires_at <= NOW()
        ), claimed AS (
            INSERT INTO identity_password_login_rate_limits (
                account_key_hash,
                attempt_count,
                window_started_at,
                expires_at
            )
            VALUES ($1, 1, NOW(), NOW() + INTERVAL '1 minute')
            ON CONFLICT (account_key_hash) DO UPDATE
            SET attempt_count = identity_password_login_rate_limits.attempt_count + 1,
                updated_at = NOW()
            WHERE identity_password_login_rate_limits.attempt_count < $2
                AND identity_password_login_rate_limits.expires_at > NOW()
            RETURNING attempt_count
        )
        SELECT attempt_count FROM claimed
        "#,
    )
    .bind(account_key_hash)
    .bind(PASSWORD_LOGIN_BURST_SIZE)
    .fetch_optional(identity_database)
    .await?;

    Ok(attempt_count.is_some())
}

pub async fn clear_password_login_attempts(
    identity_database: &PgPool,
    login_rate_limit_key: &[u8; 32],
    normalized_email: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM identity_password_login_rate_limits WHERE account_key_hash = $1")
        .bind(password_login_account_key(
            login_rate_limit_key,
            normalized_email,
        ))
        .execute(identity_database)
        .await?;

    Ok(())
}

fn password_login_account_key(login_rate_limit_key: &[u8; 32], normalized_email: &str) -> String {
    let mut digest = Sha256::new();
    digest.update(login_rate_limit_key);
    digest.update([0]);
    digest.update(normalized_email.as_bytes());
    digest
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::password_login_account_key;

    #[test]
    fn password_login_account_key_is_stable_keyed_and_non_email_shaped() {
        let key = [7; 32];
        let first = password_login_account_key(&key, "learner@example.test");

        assert_eq!(
            first,
            password_login_account_key(&key, "learner@example.test")
        );
        assert_ne!(
            first,
            password_login_account_key(&key, "other@example.test")
        );
        assert_ne!(
            first,
            password_login_account_key(&[8; 32], "learner@example.test")
        );
        assert_eq!(first.len(), 64);
        assert!(!first.contains("learner"));
    }
}
