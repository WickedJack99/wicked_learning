use axum::extract::Multipart;

use crate::error::ApiError;

pub const MAX_IMAGE_BYTES: usize = 5 * 1024 * 1024;

pub async fn single_image_upload(multipart: &mut Multipart) -> Result<Vec<u8>, ApiError> {
    let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| ApiError::profile_image_rejected())?
    else {
        return Err(ApiError::profile_image_rejected());
    };
    if field.name() != Some("file") {
        return Err(ApiError::profile_image_rejected());
    }
    let bytes = field
        .bytes()
        .await
        .map_err(|_| ApiError::profile_image_rejected())?;
    if bytes.is_empty() || bytes.len() > MAX_IMAGE_BYTES {
        return Err(ApiError::profile_image_rejected());
    }
    if multipart
        .next_field()
        .await
        .map_err(|_| ApiError::profile_image_rejected())?
        .is_some()
    {
        return Err(ApiError::profile_image_rejected());
    }
    Ok(bytes.to_vec())
}

pub fn image_content_type(bytes: &[u8]) -> Option<&'static str> {
    match infer::get(bytes).map(|kind| kind.mime_type()) {
        Some("image/gif") => Some("image/gif"),
        Some("image/jpeg") => Some("image/jpeg"),
        Some("image/png") => Some("image/png"),
        Some("image/webp") => Some("image/webp"),
        _ if looks_like_svg(bytes) => Some("image/svg+xml"),
        _ => None,
    }
}

fn looks_like_svg(bytes: &[u8]) -> bool {
    let Ok(prefix) = std::str::from_utf8(&bytes[..bytes.len().min(1024)]) else {
        return false;
    };
    let prefix = prefix.trim_start_matches(['\u{feff}', ' ', '\n', '\r', '\t']);
    prefix.starts_with("<svg") || (prefix.starts_with("<?xml") && prefix.contains("<svg"))
}
