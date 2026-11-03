use std::net::IpAddr;

use axum::http::Request;
use tower_governor::{GovernorError, key_extractor::KeyExtractor};

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
