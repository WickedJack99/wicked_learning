use std::net::IpAddr;

use axum::http::{HeaderMap, Request};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use tower_governor::{GovernorError, key_extractor::KeyExtractor};

const PASSWORD_LOGIN_BURST_SIZE: i16 = 5;

#[derive(Clone)]
pub struct TrustedProxyClientIp;

impl KeyExtractor for TrustedProxyClientIp {
    type Key = IpAddr;

    fn extract<T>(&self, request: &Request<T>) -> Result<Self::Key, GovernorError> {
        trusted_proxy_client_ip(request.headers()).ok_or(GovernorError::UnableToExtractKey)
    }
}

/// Resolves only the proxy-controlled client address that Nginx supplies to
/// the private backend. The raw address is used for one request only; the
/// shared identity-database limiter persists a keyed digest instead.
pub fn trusted_proxy_client_ip(headers: &HeaderMap) -> Option<IpAddr> {
    headers
        .get("x-real-ip")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse().ok())
}

/// Reserves one login attempt for the proxy-confirmed client across all Rust
/// replicas. A successful password never clears this row, so it cannot turn a
/// correct guess into a way to bypass the shared client burst.
pub async fn claim_client_ip_login_attempt(
    identity_database: &PgPool,
    login_rate_limit_key: &[u8; 32],
    client_ip: IpAddr,
) -> Result<bool, sqlx::Error> {
    let client_key_hash = client_ip_login_key(login_rate_limit_key, client_ip);
    let attempt_count = sqlx::query_scalar::<_, i16>(
        r#"
        WITH expired AS (
            DELETE FROM identity_client_ip_login_rate_limits
            WHERE expires_at <= NOW()
        ), claimed AS (
            INSERT INTO identity_client_ip_login_rate_limits (
                client_key_hash,
                attempt_count,
                window_started_at,
                expires_at
            )
            VALUES ($1, 1, NOW(), NOW() + INTERVAL '1 minute')
            ON CONFLICT (client_key_hash) DO UPDATE
            SET attempt_count = identity_client_ip_login_rate_limits.attempt_count + 1,
                updated_at = NOW()
            WHERE identity_client_ip_login_rate_limits.attempt_count < $2
                AND identity_client_ip_login_rate_limits.expires_at > NOW()
            RETURNING attempt_count
        )
        SELECT attempt_count FROM claimed
        "#,
    )
    .bind(client_key_hash)
    .bind(PASSWORD_LOGIN_BURST_SIZE)
    .fetch_optional(identity_database)
    .await?;

    Ok(attempt_count.is_some())
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
    keyed_login_rate_limit_digest(
        login_rate_limit_key,
        b"account",
        normalized_email.as_bytes(),
    )
}

fn client_ip_login_key(login_rate_limit_key: &[u8; 32], client_ip: IpAddr) -> String {
    keyed_login_rate_limit_digest(
        login_rate_limit_key,
        b"client-ip",
        client_ip.to_string().as_bytes(),
    )
}

fn keyed_login_rate_limit_digest(
    login_rate_limit_key: &[u8; 32],
    kind: &[u8],
    value: &[u8],
) -> String {
    let mut digest = Sha256::new();
    digest.update(login_rate_limit_key);
    digest.update([0]);
    digest.update(kind);
    digest.update([0]);
    digest.update(value);
    digest
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[cfg(test)]
mod tests {
    use std::net::{IpAddr, Ipv4Addr};

    use axum::http::{HeaderMap, HeaderValue};

    use super::{client_ip_login_key, password_login_account_key, trusted_proxy_client_ip};

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

    #[test]
    fn client_ip_key_is_keyed_and_separated_from_account_keys() {
        let key = [7; 32];
        let client_ip = IpAddr::V4(Ipv4Addr::new(203, 0, 113, 10));
        let first = client_ip_login_key(&key, client_ip);

        assert_eq!(first, client_ip_login_key(&key, client_ip));
        assert_ne!(
            first,
            client_ip_login_key(&key, IpAddr::V4(Ipv4Addr::LOCALHOST))
        );
        assert_ne!(first, client_ip_login_key(&[8; 32], client_ip));
        assert_ne!(first, password_login_account_key(&key, "203.0.113.10"));
        assert_eq!(first.len(), 64);
        assert!(!first.contains("203"));
    }

    #[test]
    fn only_a_valid_proxy_controlled_ip_header_is_accepted() {
        let mut headers = HeaderMap::new();
        headers.insert("x-real-ip", HeaderValue::from_static("203.0.113.10"));
        assert_eq!(
            trusted_proxy_client_ip(&headers),
            Some(IpAddr::V4(Ipv4Addr::new(203, 0, 113, 10)))
        );

        headers.insert("x-real-ip", HeaderValue::from_static("not-an-ip"));
        assert_eq!(trusted_proxy_client_ip(&headers), None);
    }
}
