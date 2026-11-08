use std::{
    collections::BTreeSet,
    io::{Cursor, Read, Write},
};

use axum::{
    body::Body,
    http::{HeaderValue, StatusCode, header},
    response::Response,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use sqlx::FromRow;
use uuid::Uuid;
use zip::{CompressionMethod, ZipArchive, ZipWriter, write::SimpleFileOptions};

use crate::{
    AppState, audio_upload::audio_content_type, error::ApiError, image_upload::image_content_type,
    media_store::MediaObjectKey,
};

pub const MAX_PACKAGE_BYTES: usize = 55 * 1024 * 1024;
const MAX_ENTRIES: usize = 2_000;
const MAX_TOTAL_UNCOMPRESSED_BYTES: usize = 50 * 1024 * 1024;
const MAX_MEDIA_BYTES: usize = 50 * 1024 * 1024;
const MANIFEST_ENTRY: &str = "manifest.json";
const MEDIA_INDEX_ENTRY: &str = "media.json";
const MEDIA_PREFIX: &str = "media/";
const MEDIA_URL_PREFIX: &str = "/api/v1/admin/media-assets/";

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PackageMedia {
    pub source_url: String,
    pub archive_path: String,
    pub content_type: Option<String>,
    pub bytes: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct TransferPackage {
    pub manifest: Value,
    pub media: Vec<PackageMedia>,
}

pub struct MaterializedPackageMedia {
    ids: Vec<Uuid>,
    object_keys: Vec<MediaObjectKey>,
    pub manifest: Vec<u8>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TransferPackageError {
    Invalid,
    Unavailable,
}

#[derive(FromRow)]
struct StoredMedia {
    object_key: String,
    content_type: String,
}

/// Reads only media explicitly declared by the already-authorized export
/// projection. A manifest cannot be used to enumerate arbitrary storage keys.
pub async fn package_response(
    state: &AppState,
    manifest: &Value,
    filename: &str,
) -> Result<Response, ApiError> {
    let mut media = Vec::new();
    for source_url in managed_media_urls(manifest).map_err(|_| ApiError::internal_server_error())? {
        let id = managed_media_id(&source_url).ok_or_else(ApiError::internal_server_error)?;
        let stored = sqlx::query_as::<_, StoredMedia>(
            "SELECT object_key, content_type FROM reusable_media_assets WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&state.application_database)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
        let object_key = MediaObjectKey::from_stored_value(&stored.object_key)
            .ok_or_else(ApiError::not_found)?;
        let bytes = state
            .media_store
            .get(&object_key)
            .await
            .map_err(|_| ApiError::service_unavailable())?
            .bytes()
            .await
            .map_err(|_| ApiError::service_unavailable())?;
        media.push(PackageMedia {
            source_url,
            archive_path: String::new(),
            content_type: Some(stored.content_type),
            bytes: bytes.to_vec(),
        });
    }
    let bytes = build_package(manifest, &media).map_err(|error| match error {
        TransferPackageError::Invalid => ApiError::invalid_request(),
        TransferPackageError::Unavailable => ApiError::service_unavailable(),
    })?;
    let mut response = Response::new(Body::from(bytes));
    *response.status_mut() = StatusCode::OK;
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/zip"),
    );
    response.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!("attachment; filename=\"{filename}\""))
            .map_err(|_| ApiError::internal_server_error())?,
    );
    Ok(response)
}

/// Materializes package bytes as fresh, server-owned media registry rows before
/// the existing import writer resolves manifest URLs. Call `cleanup_materialized`
/// on every failed import path; a successful writer creates the normal media
/// protection references in its own database transaction.
pub async fn materialize_package(
    state: &AppState,
    subject_id: Uuid,
    mut package: TransferPackage,
) -> Result<MaterializedPackageMedia, ApiError> {
    let mut ids = Vec::with_capacity(package.media.len());
    let mut object_keys = Vec::with_capacity(package.media.len());
    let mut replacements = std::collections::BTreeMap::new();
    for media in &package.media {
        let content_type = transferred_content_type(media).ok_or_else(ApiError::invalid_request)?;
        let byte_size =
            i32::try_from(media.bytes.len()).map_err(|_| ApiError::invalid_request())?;
        let object_key = state
            .media_store
            .put(media.bytes.clone().into())
            .await
            .map_err(|_| ApiError::service_unavailable())?;
        let id = Uuid::new_v4();
        let inserted = sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO reusable_media_assets (id, created_by_principal_id, object_key, content_type, byte_size, display_name) SELECT $1, id, $3, $4, $5, 'Transferred media' FROM application_principals WHERE identity_subject_id = $2 RETURNING id",
        )
        .bind(id)
        .bind(subject_id)
        .bind(object_key.stored_value())
        .bind(content_type)
        .bind(byte_size)
        .fetch_optional(&state.application_database)
        .await;
        if !matches!(inserted, Ok(Some(_))) {
            let _ = state.media_store.delete(&object_key).await;
            cleanup_materialized(
                state,
                &MaterializedPackageMedia {
                    ids,
                    object_keys,
                    manifest: Vec::new(),
                },
            )
            .await;
            return Err(ApiError::service_unavailable());
        }
        replacements.insert(media.source_url.clone(), media_content_url(id));
        ids.push(id);
        object_keys.push(object_key);
    }
    replace_references(&mut package.manifest, &replacements);
    let manifest =
        serde_json::to_vec(&package.manifest).map_err(|_| ApiError::internal_server_error())?;
    Ok(MaterializedPackageMedia {
        ids,
        object_keys,
        manifest,
    })
}

pub async fn cleanup_materialized(state: &AppState, media: &MaterializedPackageMedia) {
    if !media.ids.is_empty() {
        let _ = sqlx::query(
            "DELETE FROM reusable_media_assets WHERE id = ANY($1) AND NOT EXISTS (SELECT 1 FROM reusable_media_asset_references AS references WHERE references.asset_id = reusable_media_assets.id)",
        )
        .bind(&media.ids)
        .execute(&state.application_database)
        .await;
    }
    for object_key in &media.object_keys {
        if let Err(error) = state.media_store.delete(object_key).await {
            tracing::error!(%error, "could not remove media materialized by a failed transfer import");
        }
    }
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct MediaIndex {
    format: String,
    format_version: u8,
    media: Vec<MediaIndexEntry>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct MediaIndexEntry {
    source_url: String,
    archive_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    content_type: Option<String>,
}

/// A portable transfer package is deliberately payload-agnostic. The map,
/// World, and standalone MapAsset writers retain ownership of their semantic
/// validation and transactions; this boundary owns only bounded archive/media
/// integrity and URL replacement.
pub fn build_package(
    manifest: &Value,
    media: &[PackageMedia],
) -> Result<Vec<u8>, TransferPackageError> {
    let expected = managed_media_urls(manifest)?;
    if expected.len() != media.len()
        || media
            .iter()
            .any(|item| !expected.contains(&item.source_url))
        || media
            .iter()
            .any(|item| item.bytes.is_empty() || item.bytes.len() > MAX_MEDIA_BYTES)
    {
        return Err(TransferPackageError::Unavailable);
    }
    let total = media.iter().map(|item| item.bytes.len()).sum::<usize>();
    if total > MAX_TOTAL_UNCOMPRESSED_BYTES {
        return Err(TransferPackageError::Unavailable);
    }

    let mut archive = ZipWriter::new(Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    archive
        .start_file(MANIFEST_ENTRY, options)
        .map_err(|_| TransferPackageError::Unavailable)?;
    archive
        .write_all(
            &serde_json::to_vec_pretty(manifest).map_err(|_| TransferPackageError::Unavailable)?,
        )
        .map_err(|_| TransferPackageError::Unavailable)?;

    let mut entries = Vec::with_capacity(media.len());
    for item in media {
        let archive_path = if item.archive_path.is_empty() {
            archive_path(&item.source_url, item.content_type.as_deref())
        } else {
            item.archive_path.clone()
        };
        if !safe_media_path(&archive_path) {
            return Err(TransferPackageError::Unavailable);
        }
        entries.push(MediaIndexEntry {
            source_url: item.source_url.clone(),
            archive_path,
            content_type: item.content_type.clone(),
        });
    }
    archive
        .start_file(MEDIA_INDEX_ENTRY, options)
        .map_err(|_| TransferPackageError::Unavailable)?;
    archive
        .write_all(
            &serde_json::to_vec_pretty(&MediaIndex {
                format: "wicked-learning-map-media".to_owned(),
                format_version: 1,
                media: entries.clone(),
            })
            .map_err(|_| TransferPackageError::Unavailable)?,
        )
        .map_err(|_| TransferPackageError::Unavailable)?;
    for (item, entry) in media.iter().zip(&entries) {
        archive
            .start_file(&entry.archive_path, options)
            .map_err(|_| TransferPackageError::Unavailable)?;
        archive
            .write_all(&item.bytes)
            .map_err(|_| TransferPackageError::Unavailable)?;
    }
    let bytes = archive
        .finish()
        .map_err(|_| TransferPackageError::Unavailable)?
        .into_inner();
    if bytes.len() > MAX_PACKAGE_BYTES {
        return Err(TransferPackageError::Unavailable);
    }
    Ok(bytes)
}

pub fn read_package(bytes: Vec<u8>) -> Result<TransferPackage, TransferPackageError> {
    if bytes.is_empty() || bytes.len() > MAX_PACKAGE_BYTES {
        return Err(TransferPackageError::Invalid);
    }
    let mut archive =
        ZipArchive::new(Cursor::new(bytes)).map_err(|_| TransferPackageError::Invalid)?;
    if archive.len() > MAX_ENTRIES {
        return Err(TransferPackageError::Invalid);
    }
    let mut total = 0_usize;
    let mut names = BTreeSet::new();
    for index in 0..archive.len() {
        let file = archive
            .by_index(index)
            .map_err(|_| TransferPackageError::Invalid)?;
        let name = file
            .name()
            .map_err(|_| TransferPackageError::Invalid)?
            .into_owned();
        if !safe_entry_path(&name) || !names.insert(name) {
            return Err(TransferPackageError::Invalid);
        }
        total = total
            .checked_add(usize::try_from(file.size()).map_err(|_| TransferPackageError::Invalid)?)
            .ok_or(TransferPackageError::Invalid)?;
        if total > MAX_TOTAL_UNCOMPRESSED_BYTES {
            return Err(TransferPackageError::Invalid);
        }
    }
    let manifest = read_entry(&mut archive, MANIFEST_ENTRY, MAX_TOTAL_UNCOMPRESSED_BYTES)?;
    let manifest =
        serde_json::from_slice::<Value>(&manifest).map_err(|_| TransferPackageError::Invalid)?;
    let index = read_entry(
        &mut archive,
        MEDIA_INDEX_ENTRY,
        MAX_TOTAL_UNCOMPRESSED_BYTES,
    )?;
    let index =
        serde_json::from_slice::<MediaIndex>(&index).map_err(|_| TransferPackageError::Invalid)?;
    if index.format != "wicked-learning-map-media"
        || index.format_version != 1
        || index.media.len() > MAX_ENTRIES
    {
        return Err(TransferPackageError::Invalid);
    }
    let expected = managed_media_urls(&manifest)?;
    let mut source_urls = BTreeSet::new();
    let mut archive_paths = BTreeSet::new();
    let mut media = Vec::with_capacity(index.media.len());
    for entry in index.media {
        if !expected.contains(&entry.source_url)
            || !source_urls.insert(entry.source_url.clone())
            || !archive_paths.insert(entry.archive_path.clone())
            || !safe_media_path(&entry.archive_path)
        {
            return Err(TransferPackageError::Invalid);
        }
        let data = read_entry(&mut archive, &entry.archive_path, MAX_MEDIA_BYTES)?;
        if data.is_empty() {
            return Err(TransferPackageError::Invalid);
        }
        media.push(PackageMedia {
            source_url: entry.source_url,
            archive_path: entry.archive_path,
            content_type: entry.content_type,
            bytes: data,
        });
    }
    if source_urls != expected {
        return Err(TransferPackageError::Invalid);
    }
    Ok(TransferPackage { manifest, media })
}

pub fn is_package(bytes: &[u8]) -> bool {
    bytes.starts_with(b"PK\x03\x04")
        || bytes.starts_with(b"PK\x05\x06")
        || bytes.starts_with(b"PK\x07\x08")
}

pub fn managed_media_urls(manifest: &Value) -> Result<BTreeSet<String>, TransferPackageError> {
    let Some(references) = manifest.get("references").and_then(Value::as_object) else {
        return Err(TransferPackageError::Invalid);
    };
    let Some(urls) = references.get("mediaUrls").and_then(Value::as_array) else {
        return Err(TransferPackageError::Invalid);
    };
    let mut managed = BTreeSet::new();
    for url in urls {
        let url = url.as_str().ok_or(TransferPackageError::Invalid)?;
        if managed_media_id(url).is_some() {
            managed.insert(url.to_owned());
        }
    }
    Ok(managed)
}

pub fn managed_media_id(url: &str) -> Option<Uuid> {
    let identifier = url
        .strip_prefix(MEDIA_URL_PREFIX)?
        .strip_suffix("/content")?;
    if identifier.contains('/') || identifier.is_empty() {
        return None;
    }
    Uuid::parse_str(identifier).ok()
}

pub fn media_content_url(id: Uuid) -> String {
    format!("{MEDIA_URL_PREFIX}{id}/content")
}

pub fn replace_references(
    value: &mut Value,
    replacements: &std::collections::BTreeMap<String, String>,
) {
    match value {
        Value::String(text) => {
            if let Some(replacement) = replacements.get(text) {
                *text = replacement.clone();
            }
        }
        Value::Array(values) => values
            .iter_mut()
            .for_each(|value| replace_references(value, replacements)),
        Value::Object(values) => values
            .values_mut()
            .for_each(|value| replace_references(value, replacements)),
        _ => {}
    }
}

fn transferred_content_type(media: &PackageMedia) -> Option<&'static str> {
    let detected_image = image_content_type(&media.bytes);
    let inferred_audio = audio_content_type(Some(&media.archive_path));
    match media.content_type.as_deref() {
        Some(content_type) if detected_image == Some(content_type) => detected_image,
        Some(content_type) if inferred_audio == Some(content_type) => inferred_audio,
        None => detected_image.or(inferred_audio),
        _ => None,
    }
}

fn archive_path(source_url: &str, content_type: Option<&str>) -> String {
    let digest = Sha256::digest(source_url.as_bytes());
    let extension = match content_type {
        Some("image/gif") => ".gif",
        Some("image/jpeg") => ".jpg",
        Some("image/png") => ".png",
        Some("image/webp") => ".webp",
        Some("image/svg+xml") => ".svg",
        Some("audio/aac") => ".aac",
        Some("audio/flac") => ".flac",
        Some("audio/mp4") => ".m4a",
        Some("audio/mpeg") => ".mp3",
        Some("audio/ogg") => ".ogg",
        Some("audio/wav") => ".wav",
        Some("audio/webm") => ".webm",
        _ => "",
    };
    let digest = digest
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    format!("{MEDIA_PREFIX}{digest}{extension}")
}

fn safe_entry_path(path: &str) -> bool {
    !path.is_empty()
        && !path.starts_with('/')
        && !path.ends_with('/')
        && !path
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
}

fn safe_media_path(path: &str) -> bool {
    path.strip_prefix(MEDIA_PREFIX)
        .is_some_and(|suffix| !suffix.is_empty())
        && safe_entry_path(path)
}

fn read_entry(
    archive: &mut ZipArchive<Cursor<Vec<u8>>>,
    name: &str,
    limit: usize,
) -> Result<Vec<u8>, TransferPackageError> {
    let mut file = archive
        .by_name(name)
        .map_err(|_| TransferPackageError::Invalid)?;
    if usize::try_from(file.size()).map_err(|_| TransferPackageError::Invalid)? > limit {
        return Err(TransferPackageError::Invalid);
    }
    let mut bytes = Vec::new();
    file.by_ref()
        .take(u64::try_from(limit + 1).map_err(|_| TransferPackageError::Invalid)?)
        .read_to_end(&mut bytes)
        .map_err(|_| TransferPackageError::Invalid)?;
    (bytes.len() <= limit)
        .then_some(bytes)
        .ok_or(TransferPackageError::Invalid)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn manifest(url: &str) -> Value {
        json!({"references":{"mediaUrls":[url]}})
    }

    #[test]
    fn round_trips_a_manifest_and_managed_media() {
        let url = media_content_url(Uuid::new_v4());
        let bytes = build_package(
            &manifest(&url),
            &[PackageMedia {
                source_url: url.clone(),
                archive_path: String::new(),
                content_type: Some("image/svg+xml".into()),
                bytes: b"<svg/>".to_vec(),
            }],
        )
        .expect("package");
        let package = read_package(bytes).expect("read package");
        assert_eq!(package.manifest, manifest(&url));
        assert_eq!(package.media[0].source_url, url);
        assert_eq!(package.media[0].bytes, b"<svg/>");
    }

    #[test]
    fn rejects_an_unsafe_or_unreferenced_media_entry() {
        let url = media_content_url(Uuid::new_v4());
        let mut archive = ZipWriter::new(Cursor::new(Vec::new()));
        let options = SimpleFileOptions::default();
        archive
            .start_file(MANIFEST_ENTRY, options)
            .expect("manifest");
        archive
            .write_all(
                serde_json::to_string(&manifest(&url))
                    .expect("json")
                    .as_bytes(),
            )
            .expect("write");
        archive
            .start_file(MEDIA_INDEX_ENTRY, options)
            .expect("index");
        archive.write_all(format!(r#"{{"format":"wicked-learning-map-media","formatVersion":1,"media":[{{"sourceUrl":"{url}","archivePath":"media/../unsafe.svg"}}]}}"#).as_bytes()).expect("write");
        assert_eq!(
            read_package(archive.finish().expect("finish").into_inner()),
            Err(TransferPackageError::Invalid)
        );
    }
}
