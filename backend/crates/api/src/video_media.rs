use std::ops::Range;

use crate::{AppState, error::ApiError, media_store::MediaObjectKey};
use axum::{
    body::Body,
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::Response,
};

pub fn content_type(bytes: &[u8]) -> Option<&'static str> {
    match infer::get(bytes).map(|kind| kind.mime_type()) {
        Some(kind @ ("video/mp4" | "video/x-m4v" | "video/quicktime" | "video/webm")) => Some(kind),
        // infer classifies the Ogg container as audio. Its first page must
        // actually identify a Theora video stream before accepting video/ogg.
        Some("audio/ogg")
            if bytes[..bytes.len().min(4096)]
                .windows(7)
                .any(|part| part == b"\x80theora") =>
        {
            Some("video/ogg")
        }
        _ => None,
    }
}

fn byte_range(value: &str, size: u64) -> Option<Range<u64>> {
    let (start, end) = value.strip_prefix("bytes=")?.split_once('-')?;
    if size == 0 {
        return None;
    }
    if start.is_empty() {
        let suffix: u64 = end.parse().ok()?;
        return (suffix > 0).then(|| size.saturating_sub(suffix)..size);
    }
    let start: u64 = start.parse().ok()?;
    let end = if end.is_empty() {
        size
    } else {
        end.parse::<u64>().ok()?.saturating_add(1).min(size)
    };
    (start < end && start < size).then_some(start..end)
}

/// The caller must authorize the saved reference or scoped creator preview
/// before entering this helper. Range headers never bypass that boundary.
pub async fn response(
    state: &AppState,
    object_key: &str,
    content_type: &str,
    request: &HeaderMap,
) -> Result<Response, ApiError> {
    let key = MediaObjectKey::from_stored_value(object_key).ok_or_else(ApiError::not_found)?;
    let size = state
        .media_store
        .size(&key)
        .await
        .map_err(|_| ApiError::not_found())?;
    let selected = if let Some(value) = request.get(header::RANGE) {
        let Some(range) = value
            .to_str()
            .ok()
            .and_then(|value| byte_range(value, size))
        else {
            let mut response = Response::new(Body::empty());
            *response.status_mut() = StatusCode::RANGE_NOT_SATISFIABLE;
            response.headers_mut().insert(
                header::CONTENT_RANGE,
                HeaderValue::from_str(&format!("bytes */{size}"))
                    .map_err(|_| ApiError::internal_server_error())?,
            );
            return Ok(response);
        };
        Some(range)
    } else {
        None
    };
    let range = selected.clone().unwrap_or(0..size);
    let bytes = state
        .media_store
        .get_range(&key, range.clone())
        .await
        .map_err(|_| ApiError::not_found())?
        .bytes()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let mut response = Response::new(Body::from(bytes));
    let headers = response.headers_mut();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(content_type).map_err(|_| ApiError::internal_server_error())?,
    );
    headers.insert(
        header::CONTENT_LENGTH,
        HeaderValue::from_str(&(range.end - range.start).to_string())
            .map_err(|_| ApiError::internal_server_error())?,
    );
    headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, max-age=300"),
    );
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static("sandbox; default-src 'none'; media-src 'self'"),
    );
    if selected.is_some() {
        headers.insert(
            header::CONTENT_RANGE,
            HeaderValue::from_str(&format!("bytes {}-{}/{size}", range.start, range.end - 1))
                .map_err(|_| ApiError::internal_server_error())?,
        );
        *response.status_mut() = StatusCode::PARTIAL_CONTENT;
    }
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::{byte_range, content_type};
    #[test]
    fn supports_bounded_open_and_suffix_ranges_without_overflow() {
        assert_eq!(byte_range("bytes=0-0", 100), Some(0..1));
        assert_eq!(byte_range("bytes=90-200", 100), Some(90..100));
        assert_eq!(byte_range("bytes=90-", 100), Some(90..100));
        assert_eq!(byte_range("bytes=-10", 100), Some(90..100));
        assert_eq!(byte_range("bytes=-200", 100), Some(0..100));
        for value in [
            "bytes=-0",
            "bytes=100-",
            "bytes=20-10",
            "bytes=0-1,3-4",
            "bytes=x-y",
            "items=0-1",
            "bytes=18446744073709551616-",
        ] {
            assert_eq!(byte_range(value, 100), None, "{value}");
        }
        assert_eq!(byte_range("bytes=0-", 0), None);
    }
    #[test]
    fn rejects_disguised_html_audio_and_unrecognized_binary() {
        for bytes in [
            b"<html>not a video</html>".as_slice(),
            b"OggS unrelated audio",
            b"not a video",
        ] {
            assert_eq!(content_type(bytes), None);
        }
    }
}
