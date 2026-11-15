use std::{collections::BTreeSet, future::Future};

use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

use crate::admin_world_map_export_preflight::{MapExportPreflightResult, validate_manifest};

const MAX_MAPS: usize = 12;
const MAX_ERRORS: usize = 30;
const MAX_MEDIA_REFERENCE_DETAILS: usize = 2_000;

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
    pub warnings: Vec<String>,
    pub counts: WorldImportPreflightCounts,
    #[serde(rename = "mediaReferenceDetails")]
    pub media_reference_details: Vec<WorldImportMediaReference>,
    pub world: WorldImportPreflightWorld,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct WorldImportPreflightCounts {
    pub maps: usize,
    pub nodes: usize,
    pub activities: usize,
    #[serde(rename = "mapAssets")]
    pub map_assets: usize,
    #[serde(rename = "portalTargets")]
    pub portal_targets: usize,
    #[serde(rename = "mediaReferences")]
    pub media_references: usize,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct WorldImportMediaReference {
    pub available: bool,
    pub url: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct WorldImportPreflightWorld {
    pub exists: bool,
    pub slug: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorldImportPreflightContext {
    pub available_media_urls: BTreeSet<String>,
    pub current_world_slug: String,
}

pub trait AdminWorldImportRepository {
    fn import_world(
        &self,
        principal: &AuthorizedPrincipal,
        manifest: &Value,
    ) -> impl Future<Output = Result<Option<ImportedWorld>, AdminWorldImportError>> + Send;
}

pub trait AdminWorldImportPreflightRepository {
    fn load_preflight_context(
        &self,
        principal: &AuthorizedPrincipal,
        media_urls: &BTreeSet<String>,
    ) -> impl Future<Output = Result<Option<WorldImportPreflightContext>, AdminWorldImportError>> + Send;
}

pub struct AdminWorldImportCommand<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct AdminWorldImportPreflightQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldImportPreflightQuery<'repository, Repository>
where
    Repository: AdminWorldImportPreflightRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    /// Validates the exact source dialog's read model before its import action
    /// may be enabled. Package-provided media is already archive-validated by
    /// the API boundary and is therefore available to the subsequent writer.
    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        manifest: &[u8],
        package_media_urls: &BTreeSet<String>,
    ) -> Result<Option<WorldImportPreflightResult>, AdminWorldImportError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(None);
        }
        let Ok(payload) = serde_json::from_slice(manifest) else {
            return Ok(Some(invalid_preflight(
                "The selected file is not valid JSON.".to_owned(),
            )));
        };
        let mut requested_media_urls = declared_media_urls(&payload);
        requested_media_urls.extend(package_media_urls.iter().cloned());
        let Some(mut context) = self
            .repository
            .load_preflight_context(principal, &requested_media_urls)
            .await?
        else {
            return Ok(None);
        };
        context
            .available_media_urls
            .extend(package_media_urls.iter().cloned());

        Ok(Some(preflight_world_payload(&payload, Some(&context))))
    }
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
        if !preflight_world_payload(&payload, None).valid {
            return Err(AdminWorldImportError::Invalid);
        }
        self.repository.import_world(principal, &payload).await
    }
}

pub fn preflight_world_manifest(manifest: &[u8]) -> WorldImportPreflightResult {
    let Ok(payload) = serde_json::from_slice(manifest) else {
        return invalid_preflight("The selected file is not valid JSON.".to_owned());
    };
    preflight_world_payload(&payload, None)
}

fn preflight_world_payload(
    payload: &Value,
    context: Option<&WorldImportPreflightContext>,
) -> WorldImportPreflightResult {
    let mut errors = Vec::new();
    let mut warnings = BTreeSet::new();
    let mut counts = WorldImportPreflightCounts::default();
    let mut media_reference_details = Vec::new();
    let Some(payload) = payload.as_object() else {
        return invalid_preflight("The export must contain a JSON object.".to_owned());
    };
    if payload.get("format").and_then(Value::as_str) != Some("wicked-learning-world") {
        add_error(&mut errors, "format must be \"wicked-learning-world\".");
    }
    if payload.get("formatVersion").and_then(Value::as_u64) != Some(1) {
        add_error(&mut errors, "formatVersion must be 1.");
    }
    let mut world_slug = payload
        .get("world")
        .and_then(Value::as_object)
        .and_then(|world| world.get("slug"))
        .and_then(Value::as_str);
    if world_slug.is_none_or(str::is_empty)
        || context.is_some_and(|current| Some(current.current_world_slug.as_str()) != world_slug)
    {
        add_error(
            &mut errors,
            "world.slug must identify the current workspace.",
        );
        if world_slug.is_none_or(str::is_empty) {
            world_slug = None;
        }
    }
    let Some(maps) = payload.get("maps").and_then(Value::as_array) else {
        add_error(&mut errors, "maps must be an array.");
        return result(
            errors,
            warnings,
            counts,
            media_reference_details,
            world_slug,
            context,
        );
    };
    if maps.is_empty() {
        add_error(&mut errors, "maps must contain at least one map.");
    }
    if maps.len() > MAX_MAPS {
        add_error(
            &mut errors,
            format!("maps contains more than {MAX_MAPS} entries."),
        );
    }
    let mut slugs = BTreeSet::new();
    for (index, map) in maps.iter().take(MAX_MAPS).enumerate() {
        let Some(map) = map.as_object() else {
            add_error(&mut errors, format!("maps.{index} must be an object."));
            continue;
        };
        let slug = map
            .get("map")
            .and_then(Value::as_object)
            .and_then(|map| map.get("slug"))
            .and_then(Value::as_str);
        if slug.is_none() {
            add_error(
                &mut errors,
                format!("maps.{index}.map.slug must be a string."),
            );
        }
        if let Some(slug) = slug
            && !slugs.insert(slug)
        {
            add_error(&mut errors, format!("Duplicate map slug '{slug}'."));
        }
        if map
            .get("world")
            .and_then(Value::as_object)
            .and_then(|world| world.get("slug"))
            .and_then(Value::as_str)
            != world_slug
        {
            add_error(
                &mut errors,
                format!("maps.{index}.world.slug must match world.slug."),
            );
        }
        let validation = validate_manifest(&serde_json::to_vec(map).unwrap_or_default());
        aggregate_map_validation(&mut errors, &mut warnings, &mut counts, &validation, index);
        for (reference_index, url) in map_media_urls(map).into_iter().enumerate() {
            let available =
                context.is_some_and(|current| current.available_media_urls.contains(&url));
            if media_reference_details.len() < MAX_MEDIA_REFERENCE_DETAILS
                && !media_reference_details
                    .iter()
                    .any(|detail: &WorldImportMediaReference| detail.url == url)
            {
                media_reference_details.push(WorldImportMediaReference {
                    available,
                    url: url.clone(),
                });
            }
            if context.is_some() && !available {
                add_error(
                    &mut errors,
                    format!(
                        "maps.{index}: references.mediaUrls.{reference_index} must point to an available local media asset."
                    ),
                );
            }
        }
    }
    result(
        errors,
        warnings,
        counts,
        media_reference_details,
        world_slug,
        context,
    )
}

fn invalid_preflight(error: String) -> WorldImportPreflightResult {
    result(
        vec![error],
        BTreeSet::new(),
        WorldImportPreflightCounts::default(),
        Vec::new(),
        None,
        None,
    )
}

fn result(
    errors: Vec<String>,
    warnings: BTreeSet<String>,
    counts: WorldImportPreflightCounts,
    media_reference_details: Vec<WorldImportMediaReference>,
    world_slug: Option<&str>,
    context: Option<&WorldImportPreflightContext>,
) -> WorldImportPreflightResult {
    let valid = errors.is_empty();
    WorldImportPreflightResult {
        valid,
        summary: if valid {
            "The world bundle is structurally valid and ready to import.".to_owned()
        } else {
            "The world bundle needs corrections before it can be imported.".to_owned()
        },
        errors,
        warnings: warnings.into_iter().collect(),
        counts,
        media_reference_details,
        world: WorldImportPreflightWorld {
            exists: context
                .is_some_and(|current| Some(current.current_world_slug.as_str()) == world_slug),
            slug: world_slug.map(str::to_owned),
        },
    }
}

impl Default for WorldImportPreflightCounts {
    fn default() -> Self {
        Self {
            maps: 0,
            nodes: 0,
            activities: 0,
            map_assets: 0,
            portal_targets: 0,
            media_references: 0,
        }
    }
}

fn aggregate_map_validation(
    errors: &mut Vec<String>,
    warnings: &mut BTreeSet<String>,
    counts: &mut WorldImportPreflightCounts,
    validation: &MapExportPreflightResult,
    index: usize,
) {
    counts.maps += 1;
    counts.nodes += validation.counts.nodes;
    counts.activities += validation.counts.activities;
    counts.map_assets += validation.counts.map_assets;
    counts.portal_targets += validation.counts.portal_targets;
    counts.media_references += validation.counts.media_references;
    for error in &validation.errors {
        add_error(errors, format!("maps.{index}: {error}"));
    }
    for warning in &validation.warnings {
        warnings.insert(format!("maps.{index}: {warning}"));
    }
}

fn add_error(errors: &mut Vec<String>, error: impl Into<String>) {
    if errors.len() < MAX_ERRORS {
        errors.push(error.into());
    }
}

fn declared_media_urls(payload: &Value) -> BTreeSet<String> {
    payload
        .get("maps")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_object)
        .flat_map(map_media_urls)
        .collect()
}

fn map_media_urls(map: &serde_json::Map<String, Value>) -> Vec<String> {
    map.get("references")
        .and_then(Value::as_object)
        .and_then(|references| references.get("mediaUrls"))
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .filter(|url| !url.trim().is_empty())
        .map(str::to_owned)
        .collect()
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

    struct PreflightRepository {
        available_media_urls: BTreeSet<String>,
        called: Arc<AtomicBool>,
        current_world_slug: String,
    }

    impl AdminWorldImportPreflightRepository for PreflightRepository {
        fn load_preflight_context(
            &self,
            _: &AuthorizedPrincipal,
            _: &BTreeSet<String>,
        ) -> impl Future<
            Output = Result<Option<WorldImportPreflightContext>, AdminWorldImportError>,
        > + Send {
            self.called.store(true, Ordering::SeqCst);
            let available_media_urls = self.available_media_urls.clone();
            let current_world_slug = self.current_world_slug.clone();
            async move {
                Ok(Some(WorldImportPreflightContext {
                    available_media_urls,
                    current_world_slug,
                }))
            }
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

    #[tokio::test]
    async fn returns_the_source_world_import_read_shape_for_the_current_workspace() {
        let available = "/api/v1/admin/media-assets/018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d91/content";
        let called = Arc::new(AtomicBool::new(false));
        let manifest = format!(
            r#"{{"format":"wicked-learning-world","formatVersion":1,"world":{{"slug":"world"}},"maps":[{{"format":"wicked-learning-map","formatVersion":1,"world":{{"slug":"world"}},"map":{{"slug":"map"}},"nodes":[{{"slug":"node","activities":[{{"slug":"start","type":"markdown","title":"Start","transitions":[],"dialogueNodes":[],"dialogueTransitions":[]}}]}}],"mapAssets":[],"portalTargets":[],"references":{{"mediaUrls":["{available}"]}}}}]}}"#
        );
        let repository = PreflightRepository {
            available_media_urls: BTreeSet::from([available.to_owned()]),
            called: called.clone(),
            current_world_slug: "world".to_owned(),
        };

        let result = AdminWorldImportPreflightQuery::new(&repository)
            .execute(&principal(), manifest.as_bytes(), &BTreeSet::new())
            .await
            .expect("preflight")
            .expect("authorized current workspace");

        assert!(result.valid, "unexpected errors: {:?}", result.errors);
        assert_eq!(result.counts.maps, 1);
        assert_eq!(result.counts.nodes, 1);
        assert_eq!(result.counts.activities, 1);
        assert_eq!(result.counts.media_references, 1);
        assert_eq!(
            result.media_reference_details,
            vec![WorldImportMediaReference {
                available: true,
                url: available.to_owned(),
            }]
        );
        assert_eq!(
            result.world,
            WorldImportPreflightWorld {
                exists: true,
                slug: Some("world".to_owned()),
            }
        );
        assert!(called.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn rejects_another_workspace_and_unavailable_media_before_import() {
        let unavailable = "/api/v1/admin/media-assets/018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d92/content";
        let manifest = format!(
            r#"{{"format":"wicked-learning-world","formatVersion":1,"world":{{"slug":"other-world"}},"maps":[{{"format":"wicked-learning-map","formatVersion":1,"world":{{"slug":"other-world"}},"map":{{"slug":"map"}},"nodes":[],"mapAssets":[],"portalTargets":[],"references":{{"mediaUrls":["{unavailable}"]}}}}]}}"#
        );
        let repository = PreflightRepository {
            available_media_urls: BTreeSet::new(),
            called: Arc::new(AtomicBool::new(false)),
            current_world_slug: "world".to_owned(),
        };

        let result = AdminWorldImportPreflightQuery::new(&repository)
            .execute(&principal(), manifest.as_bytes(), &BTreeSet::new())
            .await
            .expect("preflight")
            .expect("authorized current workspace");

        assert!(!result.valid);
        assert!(
            result
                .errors
                .iter()
                .any(|error| error == "world.slug must identify the current workspace.")
        );
        assert_eq!(
            result.media_reference_details,
            vec![WorldImportMediaReference {
                available: false,
                url: unavailable.to_owned(),
            }]
        );
        assert_eq!(
            result.world,
            WorldImportPreflightWorld {
                exists: false,
                slug: Some("other-world".to_owned()),
            }
        );
    }

    #[tokio::test]
    async fn treats_archive_verified_media_as_available_for_preflight() {
        let packaged = "/api/v1/admin/media-assets/018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d93/content";
        let manifest = format!(
            r#"{{"format":"wicked-learning-world","formatVersion":1,"world":{{"slug":"world"}},"maps":[{{"format":"wicked-learning-map","formatVersion":1,"world":{{"slug":"world"}},"map":{{"slug":"map"}},"nodes":[],"mapAssets":[],"portalTargets":[],"references":{{"mediaUrls":["{packaged}"]}}}}]}}"#
        );
        let repository = PreflightRepository {
            available_media_urls: BTreeSet::new(),
            called: Arc::new(AtomicBool::new(false)),
            current_world_slug: "world".to_owned(),
        };

        let result = AdminWorldImportPreflightQuery::new(&repository)
            .execute(
                &principal(),
                manifest.as_bytes(),
                &BTreeSet::from([packaged.to_owned()]),
            )
            .await
            .expect("preflight")
            .expect("authorized current workspace");

        assert!(result.valid, "unexpected errors: {:?}", result.errors);
        assert_eq!(
            result.media_reference_details,
            vec![WorldImportMediaReference {
                available: true,
                url: packaged.to_owned(),
            }]
        );
    }

    #[tokio::test]
    async fn does_not_load_preflight_context_without_the_import_permission() {
        let called = Arc::new(AtomicBool::new(false));
        let repository = PreflightRepository {
            available_media_urls: BTreeSet::new(),
            called: called.clone(),
            current_world_slug: "world".to_owned(),
        };
        let unauthorized = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec![],
        };

        assert!(
            AdminWorldImportPreflightQuery::new(&repository)
                .execute(&unauthorized, br#"{}"#, &BTreeSet::new())
                .await
                .expect("authorization check")
                .is_none()
        );
        assert!(!called.load(Ordering::SeqCst));
    }
}
