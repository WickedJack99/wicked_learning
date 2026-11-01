use std::{env, net::SocketAddr, path::PathBuf};

use thiserror::Error;

#[derive(Clone)]
pub struct Config {
    pub application_database_url: String,
    pub identity_database_url: String,
    pub listen_address: SocketAddr,
    pub media_root: PathBuf,
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("{0} must be set")]
    Missing(&'static str),
    #[error("LISTEN_ADDRESS must be a socket address: {0}")]
    InvalidListenAddress(#[source] std::net::AddrParseError),
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
        })
    }
}

fn required(name: &'static str) -> Result<String, ConfigError> {
    env::var(name).map_err(|_| ConfigError::Missing(name))
}
