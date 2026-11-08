use axum::extract::Multipart;

use crate::error::ApiError;

pub const MAX_AUDIO_BYTES: usize = 20 * 1024 * 1024;

pub struct AudioUpload {
    pub bytes: Vec<u8>,
    pub content_type: &'static str,
}

/// Mirrors the source sound uploader's bounded extension contract while
/// retaining server-derived MIME metadata for MediaStore delivery.
pub async fn single_audio_upload(multipart: &mut Multipart) -> Result<AudioUpload, ApiError> {
    let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| ApiError::invalid_request())?
    else {
        return Err(ApiError::invalid_request());
    };
    if field.name() != Some("file") {
        return Err(ApiError::invalid_request());
    }
    let content_type =
        audio_content_type(field.file_name()).ok_or_else(ApiError::invalid_request)?;
    let bytes = field
        .bytes()
        .await
        .map_err(|_| ApiError::invalid_request())?
        .to_vec();
    if bytes.is_empty() || bytes.len() > MAX_AUDIO_BYTES {
        return Err(ApiError::invalid_request());
    }
    if multipart
        .next_field()
        .await
        .map_err(|_| ApiError::invalid_request())?
        .is_some()
    {
        return Err(ApiError::invalid_request());
    }

    Ok(AudioUpload {
        bytes,
        content_type,
    })
}

pub fn audio_content_type(file_name: Option<&str>) -> Option<&'static str> {
    let extension = file_name?.rsplit_once('.')?.1.to_ascii_lowercase();
    match extension.as_str() {
        "aac" => Some("audio/aac"),
        "flac" => Some("audio/flac"),
        "m4a" => Some("audio/mp4"),
        "mp3" => Some("audio/mpeg"),
        "ogg" => Some("audio/ogg"),
        "wav" => Some("audio/wav"),
        "webm" => Some("audio/webm"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::audio_content_type;

    #[test]
    fn allows_only_the_source_sound_extensions() {
        assert_eq!(audio_content_type(Some("quiet.WAV")), Some("audio/wav"));
        assert_eq!(audio_content_type(Some("voice.webm")), Some("audio/webm"));
        assert_eq!(audio_content_type(Some("image.png")), None);
    }
}
