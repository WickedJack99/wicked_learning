use std::{collections::BTreeSet, future::Future};

use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

use crate::admin_world_map_export_preflight::validate_manifest;

const MAX_MAPS: usize = 12;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldImportError {
    Invalid,
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ImportedWorld {
    pub map_ids: Vec<Uuid>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct WorldImportPreflightResult {
    pub valid: bool,
    pub summary: String,
    pub errors: Vec<String>,
    pub maps: usize,
}

pub trait AdminWorldImportRepository {
    fn import_world(
        &self,
        principal: &AuthorizedPrincipal,
        manifest: &Value,
    ) -> impl Future<Output = Result<Option<ImportedWorld>, AdminWorldImportError>> + Send;
}

pub struct AdminWorldImportCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldImportCommand<'repository, Repository>
where
    Repository: AdminWorldImportRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        manifest: &[u8],
    ) -> Result<Option<ImportedWorld>, AdminWorldImportError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(None);
        }
        let payload =
            serde_json::from_slice(manifest).map_err(|_| AdminWorldImportError::Invalid)?;
        if !preflight_world_payload(&payload).valid {
            return Err(AdminWorldImportError::Invalid);
        }
        self.repository.import_world(principal, &payload).await
    }
}

pub fn preflight_world_manifest(manifest: &[u8]) -> WorldImportPreflightResult {
    let Ok(payload) = serde_json::from_slice(manifest) else {
        return invalid_preflight("The selected file is not valid JSON.".to_owned());
    };
    preflight_world_payload(&payload)
}

fn preflight_world_payload(payload: &Value) -> WorldImportPreflightResult {
    let mut errors = Vec::new();
    let Some(payload) = payload.as_object() else {
        return invalid_preflight("The export must contain a JSON object.".to_owned());
    };
    if payload.get("format").and_then(Value::as_str) != Some("wicked-learning-world") {
        errors.push("format must be \"wicked-learning-world\".".to_owned());
    }
    if payload.get("formatVersion").and_then(Value::as_u64) != Some(1) {
        errors.push("formatVersion must be 1.".to_owned());
    }
    let world_slug = payload
        .get("world")
        .and_then(Value::as_object)
        .and_then(|world| world.get("slug"))
        .and_then(Value::as_str);
    if world_slug.is_none_or(str::is_empty) {
        errors.push("world.slug must be a non-empty string.".to_owned());
    }
    let Some(maps) = payload.get("maps").and_then(Value::as_array) else {
        errors.push("maps must be an array.".to_owned());
        return result(errors, 0);
    };
    if maps.is_empty() {
        errors.push("maps must contain at least one map.".to_owned());
    }
    if maps.len() > MAX_MAPS {
        errors.push(format!("maps contains more than {MAX_MAPS} entries."));
    }
    let mut slugs = BTreeSet::new();
    for (index, map) in maps.iter().take(MAX_MAPS).enumerate() {
        let Some(slug) = map
            .get("map")
            .and_then(Value::as_object)
            .and_then(|map| map.get("slug"))
            .and_then(Value::as_str)
        else {
            errors.push(format!("maps.{index}.map.slug must be a string."));
            continue;
        };
        if !slugs.insert(slug) {
            errors.push(format!("Duplicate map slug '{slug}'."));
        }
        if map
            .get("world")
            .and_then(Value::as_object)
            .and_then(|world| world.get("slug"))
            .and_then(Value::as_str)
            != world_slug
        {
            errors.push(format!("maps.{index}.world.slug must match world.slug."));
        }
        let validation = validate_manifest(&serde_json::to_vec(map).unwrap_or_default());
        if !validation.valid {
            errors.extend(
                validation
                    .errors
                    .into_iter()
                    .map(|error| format!("maps.{index}: {error}")),
            );
        }
    }
    result(errors, maps.len())
}

fn invalid_preflight(error: String) -> WorldImportPreflightResult {
    result(vec![error], 0)
}

fn result(errors: Vec<String>, maps: usize) -> WorldImportPreflightResult {
    let valid = errors.is_empty();
    WorldImportPreflightResult {
        valid,
        summary: if valid {
            "The world bundle is structurally valid and ready to import.".to_owned()
        } else {
            "The world bundle needs corrections before it can be imported.".to_owned()
        },
        errors,
        maps,
    }
}

#[cfg(test)]
mod tests {
    use std::{
        future::Future,
        sync::{
            Arc,
            atomic::{AtomicBool, Ordering},
        },
    };

    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::*;

    struct Repository(Arc<AtomicBool>);

    impl AdminWorldImportRepository for Repository {
        fn import_world(
            &self,
            _: &AuthorizedPrincipal,
            _: &Value,
        ) -> impl Future<Output = Result<Option<ImportedWorld>, AdminWorldImportError>> + Send
        {
            self.0.store(true, Ordering::SeqCst);
            async { Ok(Some(ImportedWorld { map_ids: vec![] })) }
        }
    }

    fn principal() -> AuthorizedPrincipal {
        AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:ru:all".to_owned()],
        }
    }

    #[tokio::test]
    async fn rejects_duplicate_map_slugs_before_the_importer_is_called() {
        let called = Arc::new(AtomicBool::new(false));
        let manifest = br#"{"format":"wicked-learning-world","formatVersion":1,"world":{"slug":"world"},"maps":[{"format":"wicked-learning-map","formatVersion":1,"world":{"slug":"world"},"map":{"slug":"same"},"nodes":[],"mapAssets":[],"portalTargets":[],"references":{"mediaUrls":[]}},{"format":"wicked-learning-map","formatVersion":1,"world":{"slug":"world"},"map":{"slug":"same"},"nodes":[],"mapAssets":[],"portalTargets":[],"references":{"mediaUrls":[]}}]}"#;

        let error = AdminWorldImportCommand::new(&Repository(called.clone()))
            .execute(&principal(), manifest)
            .await
            .expect_err("validation must fail");

        assert_eq!(error, AdminWorldImportError::Invalid);
        assert!(!called.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn delegates_a_bounded_valid_bundle() {
        let called = Arc::new(AtomicBool::new(false));
        let manifest = br#"{"format":"wicked-learning-world","formatVersion":1,"world":{"slug":"world"},"maps":[{"format":"wicked-learning-map","formatVersion":1,"world":{"slug":"world"},"map":{"slug":"map"},"nodes":[],"mapAssets":[],"portalTargets":[],"references":{"mediaUrls":[]}}]}"#;

        let imported = AdminWorldImportCommand::new(&Repository(called.clone()))
            .execute(&principal(), manifest)
            .await
            .expect("import");

        assert_eq!(imported, Some(ImportedWorld { map_ids: vec![] }));
        assert!(called.load(Ordering::SeqCst));
    }
}
