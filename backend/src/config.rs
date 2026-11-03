use std::{
    env,
    net::SocketAddr,
    path::PathBuf,
    str::{FromStr, ParseBoolError},
};

use email_address::EmailAddress;
use thiserror::Error;
use url::Url;

#[derive(Clone)]
pub struct Config {
    pub application_database_url: String,
    pub csrf_cookie_key: String,
    pub identity_database_url: String,
    pub listen_address: SocketAddr,
    pub media_root: PathBuf,
    pub public_origin: String,
    pub session_cookie_secure: bool,
}

pub struct BootstrapAdminConfig {
    pub normalized_email: String,
    pub password_file: PathBuf,
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("{0} must be set")]
    Missing(&'static str),
    #[error("LISTEN_ADDRESS must be a socket address: {0}")]
    InvalidListenAddress(#[source] std::net::AddrParseError),
    #[error("SESSION_COOKIE_SECURE must be true or false: {0}")]
    InvalidSessionCookieSecure(#[source] ParseBoolError),
    #[error("CSRF_COOKIE_KEY must contain at least 64 bytes of secret material")]
    InvalidCsrfCookieKey,
    #[error("PUBLIC_ORIGIN must be an absolute HTTP or HTTPS origin")]
    InvalidPublicOrigin,
    #[error("BOOTSTRAP_ADMIN_EMAIL must be a valid email address")]
    InvalidBootstrapAdminEmail,
}

impl BootstrapAdminConfig {
    pub fn from_environment() -> Result<Self, ConfigError> {
        let normalized_email = normalize_email(&required("BOOTSTRAP_ADMIN_EMAIL")?)?;

        Ok(Self {
            normalized_email,
            password_file: PathBuf::from(required("BOOTSTRAP_ADMIN_PASSWORD_FILE")?),
        })
    }
}

pub fn normalize_email(email: &str) -> Result<String, ConfigError> {
    let normalized_email = email.trim().to_lowercase();
    if EmailAddress::from_str(&normalized_email).is_err() {
        return Err(ConfigError::InvalidBootstrapAdminEmail);
    }

    Ok(normalized_email)
}

impl Config {
    pub fn from_environment() -> Result<Self, ConfigError> {
        Ok(Self {
            application_database_url: required("APPLICATION_DATABASE_URL")?,
            csrf_cookie_key: csrf_cookie_key()?,
            identity_database_url: required("IDENTITY_DATABASE_URL")?,
            listen_address: env::var("LISTEN_ADDRESS")
                .unwrap_or_else(|_| "0.0.0.0:3000".to_owned())
                .parse()
                .map_err(ConfigError::InvalidListenAddress)?,
            media_root: env::var("MEDIA_ROOT")
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from("/var/lib/wicked-learning/media")),
            public_origin: public_origin()?,
            session_cookie_secure: env::var("SESSION_COOKIE_SECURE")
                .unwrap_or_else(|_| "true".to_owned())
                .parse()
                .map_err(ConfigError::InvalidSessionCookieSecure)?,
        })
    }
}

fn public_origin() -> Result<String, ConfigError> {
    normalize_public_origin(&required("PUBLIC_ORIGIN")?)
}

fn normalize_public_origin(value: &str) -> Result<String, ConfigError> {
    let parsed = Url::parse(value).map_err(|_| ConfigError::InvalidPublicOrigin)?;
    if !matches!(parsed.scheme(), "http" | "https")
        || !matches!(parsed.origin(), url::Origin::Tuple(_, _, _))
        || parsed.path() != "/"
        || parsed.query().is_some()
        || parsed.fragment().is_some()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err(ConfigError::InvalidPublicOrigin);
    }

    Ok(parsed.origin().ascii_serialization())
}

fn csrf_cookie_key() -> Result<String, ConfigError> {
    validate_csrf_cookie_key(required("CSRF_COOKIE_KEY")?)
}

fn validate_csrf_cookie_key(key: String) -> Result<String, ConfigError> {
    if key.as_bytes().len() < 64 {
        return Err(ConfigError::InvalidCsrfCookieKey);
    }

    Ok(key)
}

fn required(name: &'static str) -> Result<String, ConfigError> {
    env::var(name).map_err(|_| ConfigError::Missing(name))
}

#[cfg(test)]
mod tests {
    use super::{ConfigError, normalize_email, normalize_public_origin, validate_csrf_cookie_key};

    #[test]
    fn bootstrap_email_is_trimmed_and_normalized() {
        assert_eq!(
            normalize_email("  ADMIN@EXAMPLE.TEST ").expect("valid bootstrap email"),
            "admin@example.test"
        );
        assert!(normalize_email("not-an-email").is_err());
    }

    #[test]
    fn csrf_cookie_key_requires_enough_secret_material() {
        assert!(matches!(
            validate_csrf_cookie_key("too-short".to_owned()),
            Err(ConfigError::InvalidCsrfCookieKey)
        ));
    }

    #[test]
    fn public_origin_is_an_http_origin_without_a_path_or_credentials() {
        assert_eq!(
            normalize_public_origin("https://example.test:8443/").expect("valid public origin"),
            "https://example.test:8443"
        );
        assert!(normalize_public_origin("https://example.test/app").is_err());
        assert!(normalize_public_origin("https://user@example.test").is_err());
        assert!(normalize_public_origin("mailto:admin@example.test").is_err());
    }
}
