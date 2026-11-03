use std::{
    env,
    net::SocketAddr,
    path::PathBuf,
    str::{FromStr, ParseBoolError},
};

use email_address::EmailAddress;
use thiserror::Error;

#[derive(Clone)]
pub struct Config {
    pub application_database_url: String,
    pub identity_database_url: String,
    pub listen_address: SocketAddr,
    pub media_root: PathBuf,
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
            identity_database_url: required("IDENTITY_DATABASE_URL")?,
            listen_address: env::var("LISTEN_ADDRESS")
                .unwrap_or_else(|_| "0.0.0.0:3000".to_owned())
                .parse()
                .map_err(ConfigError::InvalidListenAddress)?,
            media_root: env::var("MEDIA_ROOT")
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from("/var/lib/wicked-learning/media")),
            session_cookie_secure: env::var("SESSION_COOKIE_SECURE")
                .unwrap_or_else(|_| "true".to_owned())
                .parse()
                .map_err(ConfigError::InvalidSessionCookieSecure)?,
        })
    }
}

fn required(name: &'static str) -> Result<String, ConfigError> {
    env::var(name).map_err(|_| ConfigError::Missing(name))
}

#[cfg(test)]
mod tests {
    use super::normalize_email;

    #[test]
    fn bootstrap_email_is_trimmed_and_normalized() {
        assert_eq!(
            normalize_email("  ADMIN@EXAMPLE.TEST ").expect("valid bootstrap email"),
            "admin@example.test"
        );
        assert!(normalize_email("not-an-email").is_err());
    }
}
