use std::{
    env,
    net::SocketAddr,
    path::PathBuf,
    str::{FromStr, ParseBoolError},
};

use base64::{Engine as _, engine::general_purpose::STANDARD};
use email_address::EmailAddress;
use thiserror::Error;
use url::Url;

#[derive(Clone)]
pub struct Config {
    pub ai_credential_encryption_key: [u8; 32],
    pub application_database_url: String,
    pub csrf_cookie_key: String,
    pub email: EmailConfig,
    pub identity_database_url: String,
    pub listen_address: SocketAddr,
    pub media_root: PathBuf,
    pub public_origin: String,
    pub session_cookie_secure: bool,
    pub totp_encryption_key: [u8; 32],
}

#[derive(Clone)]
pub struct EmailConfig {
    pub from_address: String,
    pub from_name: String,
    pub smtp_host: String,
    pub smtp_password: Option<String>,
    pub smtp_port: u16,
    pub smtp_security: SmtpSecurity,
    pub smtp_username: Option<String>,
}

#[derive(Clone, Copy)]
pub enum SmtpSecurity {
    None,
    StartTls,
}

pub struct BootstrapAdminConfig {
    pub normalized_email: String,
    pub password_file: PathBuf,
}

pub struct RegistrationTokenConfig {
    pub note: Option<String>,
    pub output_file: PathBuf,
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
    #[error("TOTP_ENCRYPTION_KEY must be a Base64-encoded 32-byte key")]
    InvalidTotpEncryptionKey,
    #[error("AI_CREDENTIAL_ENCRYPTION_KEY must be a Base64-encoded 32-byte key")]
    InvalidAiCredentialEncryptionKey,
    #[error("PUBLIC_ORIGIN must be an absolute HTTP or HTTPS origin")]
    InvalidPublicOrigin,
    #[error("MAIL_FROM_ADDRESS must be a valid email address")]
    InvalidMailFromAddress,
    #[error("MAIL_FROM_NAME must not be blank or exceed 255 characters")]
    InvalidMailFromName,
    #[error("SMTP_HOST must not be blank or exceed 255 characters")]
    InvalidSmtpHost,
    #[error("SMTP_PORT must be a valid TCP port: {0}")]
    InvalidSmtpPort(#[source] std::num::ParseIntError),
    #[error("SMTP_SECURITY must be either none or starttls")]
    InvalidSmtpSecurity,
    #[error("SMTP_USERNAME and SMTP_PASSWORD must be set together")]
    IncompleteSmtpCredentials,
    #[error("BOOTSTRAP_ADMIN_EMAIL must be a valid email address")]
    InvalidBootstrapAdminEmail,
    #[error("REGISTRATION_TOKEN_NOTE must contain at most 500 characters")]
    InvalidRegistrationTokenNote,
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

impl RegistrationTokenConfig {
    pub fn from_environment() -> Result<Self, ConfigError> {
        let note = env::var("REGISTRATION_TOKEN_NOTE")
            .ok()
            .map(|note| note.trim().to_owned())
            .filter(|note| !note.is_empty());
        if note.as_ref().is_some_and(|note| note.chars().count() > 500) {
            return Err(ConfigError::InvalidRegistrationTokenNote);
        }

        Ok(Self {
            note,
            output_file: PathBuf::from(required("REGISTRATION_TOKEN_OUTPUT_FILE")?),
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
            ai_credential_encryption_key: ai_credential_encryption_key()?,
            application_database_url: required("APPLICATION_DATABASE_URL")?,
            csrf_cookie_key: csrf_cookie_key()?,
            email: email_config()?,
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
            totp_encryption_key: totp_encryption_key()?,
        })
    }
}

fn email_config() -> Result<EmailConfig, ConfigError> {
    let from_address = env::var("MAIL_FROM_ADDRESS")
        .map_err(|_| ConfigError::Missing("MAIL_FROM_ADDRESS"))?
        .trim()
        .to_lowercase();
    if EmailAddress::from_str(&from_address).is_err() {
        return Err(ConfigError::InvalidMailFromAddress);
    }
    let from_name = env::var("MAIL_FROM_NAME")
        .map_err(|_| ConfigError::Missing("MAIL_FROM_NAME"))?
        .trim()
        .to_owned();
    if from_name.is_empty() || from_name.chars().count() > 255 {
        return Err(ConfigError::InvalidMailFromName);
    }
    let smtp_host = env::var("SMTP_HOST")
        .map_err(|_| ConfigError::Missing("SMTP_HOST"))?
        .trim()
        .to_owned();
    if smtp_host.is_empty() || smtp_host.len() > 255 {
        return Err(ConfigError::InvalidSmtpHost);
    }
    let smtp_port = env::var("SMTP_PORT")
        .map_err(|_| ConfigError::Missing("SMTP_PORT"))?
        .parse()
        .map_err(ConfigError::InvalidSmtpPort)?;
    let smtp_security = match env::var("SMTP_SECURITY")
        .map_err(|_| ConfigError::Missing("SMTP_SECURITY"))?
        .as_str()
    {
        "none" => SmtpSecurity::None,
        "starttls" => SmtpSecurity::StartTls,
        _ => return Err(ConfigError::InvalidSmtpSecurity),
    };
    let smtp_username = env::var("SMTP_USERNAME")
        .ok()
        .filter(|value| !value.is_empty());
    let smtp_password = env::var("SMTP_PASSWORD")
        .ok()
        .filter(|value| !value.is_empty());
    if smtp_username.is_some() != smtp_password.is_some() {
        return Err(ConfigError::IncompleteSmtpCredentials);
    }

    Ok(EmailConfig {
        from_address,
        from_name,
        smtp_host,
        smtp_password,
        smtp_port,
        smtp_security,
        smtp_username,
    })
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

fn totp_encryption_key() -> Result<[u8; 32], ConfigError> {
    validate_totp_encryption_key(required("TOTP_ENCRYPTION_KEY")?)
}

fn ai_credential_encryption_key() -> Result<[u8; 32], ConfigError> {
    validate_ai_credential_encryption_key(required("AI_CREDENTIAL_ENCRYPTION_KEY")?)
}

fn validate_totp_encryption_key(value: String) -> Result<[u8; 32], ConfigError> {
    let decoded = STANDARD
        .decode(value)
        .map_err(|_| ConfigError::InvalidTotpEncryptionKey)?;

    decoded
        .try_into()
        .map_err(|_| ConfigError::InvalidTotpEncryptionKey)
}

fn validate_ai_credential_encryption_key(value: String) -> Result<[u8; 32], ConfigError> {
    STANDARD
        .decode(value)
        .map_err(|_| ConfigError::InvalidAiCredentialEncryptionKey)?
        .try_into()
        .map_err(|_| ConfigError::InvalidAiCredentialEncryptionKey)
}

fn required(name: &'static str) -> Result<String, ConfigError> {
    env::var(name).map_err(|_| ConfigError::Missing(name))
}

#[cfg(test)]
mod tests {
    use super::{
        ConfigError, normalize_email, normalize_public_origin,
        validate_ai_credential_encryption_key, validate_csrf_cookie_key,
        validate_totp_encryption_key,
    };

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

    #[test]
    fn totp_encryption_key_requires_exactly_thirty_two_base64_encoded_bytes() {
        assert_eq!(
            validate_totp_encryption_key("d2lja2VkLWxlYXJuaW5nLWxvY2FsLXRvdHAta2V5LTA=".to_owned())
                .expect("a 32-byte key"),
            *b"wicked-learning-local-totp-key-0"
        );
        assert!(matches!(
            validate_totp_encryption_key("not-base64".to_owned()),
            Err(ConfigError::InvalidTotpEncryptionKey)
        ));
        assert!(matches!(
            validate_totp_encryption_key("dG9vLXNob3J0".to_owned()),
            Err(ConfigError::InvalidTotpEncryptionKey)
        ));
    }

    #[test]
    fn ai_credential_key_is_separate_and_requires_exactly_thirty_two_bytes() {
        assert_eq!(
            validate_ai_credential_encryption_key(
                "d2lja2VkLWxlYXJuaW5nLWxvY2FsLWFpLWtleS0wMDE=".to_owned()
            )
            .expect("a 32-byte key"),
            *b"wicked-learning-local-ai-key-001"
        );
        assert!(matches!(
            validate_ai_credential_encryption_key("not-base64".to_owned()),
            Err(ConfigError::InvalidAiCredentialEncryptionKey)
        ));
    }
}
