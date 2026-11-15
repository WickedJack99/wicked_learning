use std::{
    collections::{BTreeMap, BTreeSet},
    future::Future,
};

use serde::Serialize;
use serde_json::Value;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

const MAX_NODES: usize = 500;
const MAX_ASSETS: usize = 2_000;
const MAX_ACTIVITIES: usize = 100;
const MAX_ERRORS: usize = 30;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldMapExportPreflightError {
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct MapExportPreflightResult {
    pub valid: bool,
    pub summary: String,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub counts: MapExportPreflightCounts,
    #[serde(rename = "mediaReferenceDetails")]
    pub media_reference_details: Vec<MapExportPreflightMediaReference>,
    pub world: MapExportPreflightWorld,
    pub map: MapExportPreflightMap,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct MapExportPreflightMediaReference {
    pub available: bool,
    pub url: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct MapExportPreflightWorld {
    pub exists: bool,
    pub slug: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct MapExportPreflightMap {
    pub exists: bool,
    pub slug: Option<String>,
}

/// The bounded workspace facts needed by the pinned Laravel validator. They
/// are deliberately a read model: neither the preflight nor its repository
/// may create content, materialize package media, or reserve a map slug.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MapExportPreflightContext {
    pub available_media_urls: BTreeSet<String>,
    pub current_world_slug: String,
    pub existing_map_slugs: BTreeSet<String>,
    pub available_topic_slugs: BTreeSet<String>,
    pub map_nodes: BTreeMap<String, BTreeMap<String, BTreeSet<String>>>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MapExportPreflightRequirements {
    pub media_urls: BTreeSet<String>,
    pub map_slugs: BTreeSet<String>,
    pub topic_slugs: BTreeSet<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct MapExportPreflightCounts {
    pub nodes: usize,
    pub activities: usize,
    #[serde(rename = "mapAssets")]
    pub map_assets: usize,
    #[serde(rename = "portalTargets")]
    pub portal_targets: usize,
    #[serde(rename = "mediaReferences")]
    pub media_references: usize,
}

pub trait AdminWorldMapExportPreflightRepository {
    fn load_preflight_context(
        &self,
        principal: &AuthorizedPrincipal,
        requirements: &MapExportPreflightRequirements,
    ) -> impl Future<
        Output = Result<Option<MapExportPreflightContext>, AdminWorldMapExportPreflightError>,
    > + Send;
}

pub struct AdminWorldMapExportPreflightQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldMapExportPreflightQuery<'repository, Repository>
where
    Repository: AdminWorldMapExportPreflightRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        manifest: &[u8],
        package_media_urls: &BTreeSet<String>,
    ) -> Result<Option<MapExportPreflightResult>, AdminWorldMapExportPreflightError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(None);
        }
        let Ok(payload) = serde_json::from_slice::<Value>(manifest) else {
            return Ok(Some(invalid(
                "The selected file is not valid JSON.".to_owned(),
                counts(),
            )));
        };
        let mut requirements = preflight_requirements(&payload);
        requirements
            .media_urls
            .extend(package_media_urls.iter().cloned());
        let Some(mut context) = self
            .repository
            .load_preflight_context(principal, &requirements)
            .await?
        else {
            return Ok(None);
        };
        context
            .available_media_urls
            .extend(package_media_urls.iter().cloned());
        Ok(Some(validate_manifest_in_context(&payload, &context)))
    }
}

pub fn validate_manifest(manifest: &[u8]) -> MapExportPreflightResult {
    let Ok(payload) = serde_json::from_slice::<Value>(manifest) else {
        return invalid("The selected file is not valid JSON.".to_owned(), counts());
    };
    let Some(payload) = payload.as_object() else {
        return invalid(
            "The export must contain a JSON object.".to_owned(),
            counts(),
        );
    };
    let mut errors = Vec::new();
    let mut result_counts = counts();
    require_value(
        payload.get("format"),
        "wicked-learning-map",
        "format",
        &mut errors,
    );
    require_number(
        payload.get("formatVersion"),
        1,
        "formatVersion",
        &mut errors,
    );
    let world = object(payload.get("world"), "world", &mut errors);
    let map = object(payload.get("map"), "map", &mut errors);
    slug(world.get("slug"), "world.slug", &mut errors);
    slug(map.get("slug"), "map.slug", &mut errors);
    optional_object(
        map.get("companionConfig"),
        "map.companionConfig",
        &mut errors,
    );

    let nodes = list(payload.get("nodes"), "nodes", MAX_NODES, &mut errors);
    result_counts.nodes = nodes.len();
    let mut node_activities =
        std::collections::BTreeMap::<String, std::collections::BTreeSet<String>>::new();
    for (index, node) in nodes.iter().enumerate() {
        let path = format!("nodes.{index}");
        let Some(node) = node.as_object() else {
            add_error(&mut errors, format!("{path} must be an object."));
            continue;
        };
        optional_object(
            node.get("companionConfig"),
            &format!("{path}.companionConfig"),
            &mut errors,
        );
        let Some(node_slug) = slug(node.get("slug"), &format!("{path}.slug"), &mut errors) else {
            continue;
        };
        if node_activities.contains_key(&node_slug) {
            add_error(&mut errors, format!("Duplicate node slug '{node_slug}'."));
            continue;
        }
        let activities = list(
            node.get("activities"),
            &format!("{path}.activities"),
            MAX_ACTIVITIES,
            &mut errors,
        );
        let mut activity_slugs = std::collections::BTreeSet::new();
        for (activity_index, activity) in activities.iter().enumerate() {
            let activity_path = format!("{path}.activities.{activity_index}");
            let Some(activity) = activity.as_object() else {
                add_error(&mut errors, format!("{activity_path} must be an object."));
                continue;
            };
            optional_object(
                activity.get("companionConfig"),
                &format!("{activity_path}.companionConfig"),
                &mut errors,
            );
            let Some(activity_slug) = slug(
                activity.get("slug"),
                &format!("{activity_path}.slug"),
                &mut errors,
            ) else {
                continue;
            };
            if !activity_slugs.insert(activity_slug.clone()) {
                add_error(
                    &mut errors,
                    format!("Duplicate activity slug '{activity_slug}' in node '{node_slug}'."),
                );
            }
            if activity
                .get("type")
                .and_then(Value::as_str)
                .is_none_or(str::is_empty)
            {
                add_error(
                    &mut errors,
                    format!("{activity_path}.type must be a non-empty string."),
                );
            }
            if activity
                .get("title")
                .and_then(Value::as_str)
                .is_none_or(str::is_empty)
            {
                add_error(
                    &mut errors,
                    format!("{activity_path}.title must be a non-empty string."),
                );
            }
            result_counts.activities += 1;

            let dialogue_nodes = list(
                activity.get("dialogueNodes"),
                &format!("{activity_path}.dialogueNodes"),
                MAX_ACTIVITIES,
                &mut errors,
            );
            let mut dialogue_source_ids = std::collections::BTreeSet::new();
            for (dialogue_index, dialogue) in dialogue_nodes.iter().enumerate() {
                let dialogue_path = format!("{activity_path}.dialogueNodes.{dialogue_index}");
                let Some(dialogue) = dialogue.as_object() else {
                    add_error(&mut errors, format!("{dialogue_path} must be an object."));
                    continue;
                };
                let Some(source_id) = dialogue.get("sourceId").and_then(Value::as_str) else {
                    add_error(
                        &mut errors,
                        format!("{dialogue_path}.sourceId must be a string."),
                    );
                    continue;
                };
                if !dialogue_source_ids.insert(source_id.to_owned()) {
                    add_error(
                        &mut errors,
                        format!("Duplicate dialogue source ID '{source_id}' in '{activity_path}'."),
                    );
                }
            }
            for (transition_index, transition) in list(
                activity.get("dialogueTransitions"),
                &format!("{activity_path}.dialogueTransitions"),
                MAX_ACTIVITIES,
                &mut errors,
            )
            .iter()
            .enumerate()
            {
                let transition_path =
                    format!("{activity_path}.dialogueTransitions.{transition_index}");
                let Some(transition) = transition.as_object() else {
                    add_error(&mut errors, format!("{transition_path} must be an object."));
                    continue;
                };
                if transition
                    .get("toSourceId")
                    .and_then(Value::as_str)
                    .is_none_or(|source_id| !dialogue_source_ids.contains(source_id))
                {
                    add_error(
                        &mut errors,
                        format!(
                            "{transition_path}.toSourceId must name a dialogue node in the same activity."
                        ),
                    );
                }
                if let Some(source_id) = transition.get("fromSourceId").and_then(Value::as_str)
                    && !dialogue_source_ids.contains(source_id)
                {
                    add_error(
                        &mut errors,
                        format!(
                            "{transition_path}.fromSourceId must name a dialogue node in the same activity."
                        ),
                    );
                }
            }
        }
        node_activities.insert(node_slug, activity_slugs);
    }

    for (index, node) in nodes.iter().enumerate() {
        let Some(node) = node.as_object() else {
            continue;
        };
        let Some(node_slug) = node.get("slug").and_then(Value::as_str) else {
            continue;
        };
        let Some(activity_slugs) = node_activities.get(node_slug) else {
            continue;
        };
        if let Some(start) = node
            .get("startActivitySlug")
            .filter(|start| !start.is_null())
        {
            if start
                .as_str()
                .is_none_or(|slug| !activity_slugs.contains(slug))
            {
                add_error(
                    &mut errors,
                    format!(
                        "nodes.{index}.startActivitySlug must name an activity in the same node."
                    ),
                );
            }
        }
        let activities = list(
            node.get("activities"),
            &format!("nodes.{index}.activities"),
            MAX_ACTIVITIES,
            &mut errors,
        );
        for (activity_index, activity) in activities.iter().enumerate() {
            let Some(activity) = activity.as_object() else {
                continue;
            };
            for (transition_index, transition) in list(
                activity.get("transitions"),
                "transitions",
                MAX_ACTIVITIES,
                &mut errors,
            )
            .iter()
            .enumerate()
            {
                if transition
                    .as_object()
                    .and_then(|transition| transition.get("toActivitySlug"))
                    .and_then(Value::as_str)
                    .is_none_or(|target| !activity_slugs.contains(target))
                {
                    add_error(
                        &mut errors,
                        format!(
                            "nodes.{index}.activities.{activity_index}.transitions.{transition_index}.toActivitySlug must name an activity in the same node."
                        ),
                    );
                }
            }
        }
    }

    let assets = list(
        payload.get("mapAssets"),
        "mapAssets",
        MAX_ASSETS,
        &mut errors,
    );
    result_counts.map_assets = assets.len();
    for (index, asset) in assets.iter().enumerate() {
        if let Some(node_slug) = asset
            .as_object()
            .and_then(|asset| asset.get("nodeSlug"))
            .and_then(Value::as_str)
        {
            if !node_activities.contains_key(node_slug) {
                add_error(
                    &mut errors,
                    format!("mapAssets.{index}.nodeSlug must name an exported node."),
                );
            }
        }
    }
    let portals = list(
        payload.get("portalTargets"),
        "portalTargets",
        MAX_ASSETS,
        &mut errors,
    );
    result_counts.portal_targets = portals.len();
    for (index, portal) in portals.iter().enumerate() {
        let Some(portal) = portal.as_object() else {
            add_error(
                &mut errors,
                format!("portalTargets.{index} must be an object."),
            );
            continue;
        };
        let source_node = portal.get("sourceNodeSlug").and_then(Value::as_str);
        if source_node.is_none_or(|slug| !node_activities.contains_key(slug)) {
            add_error(
                &mut errors,
                format!("portalTargets.{index}.sourceNodeSlug must name an exported node."),
            );
        }
        let source_activity = portal.get("sourceActivitySlug").and_then(Value::as_str);
        let target_activity = portal.get("targetActivitySlug").and_then(Value::as_str);
        if source_activity.is_some() != target_activity.is_some() {
            add_error(
                &mut errors,
                format!("portalTargets.{index} must name both portal activities or neither."),
            );
        }
        if let Some(source_activity) = source_activity {
            if source_node
                .and_then(|node| node_activities.get(node))
                .is_none_or(|activities| !activities.contains(source_activity))
            {
                add_error(
                    &mut errors,
                    format!(
                        "portalTargets.{index}.sourceActivitySlug must name an activity in its source node."
                    ),
                );
            }
        }
        for key in ["targetMapSlug", "targetNodeSlug"] {
            slug(
                portal.get(key),
                &format!("portalTargets.{index}.{key}"),
                &mut errors,
            );
        }
        if target_activity.is_some() {
            slug(
                portal.get("targetActivitySlug"),
                &format!("portalTargets.{index}.targetActivitySlug"),
                &mut errors,
            );
        }
    }
    let references = object(payload.get("references"), "references", &mut errors);
    let media = list(
        references.get("mediaUrls"),
        "references.mediaUrls",
        MAX_ASSETS,
        &mut errors,
    );
    result_counts.media_references = media.len();
    for (index, reference) in media.iter().enumerate() {
        if reference
            .as_str()
            .is_none_or(|value| value.trim().is_empty())
        {
            add_error(
                &mut errors,
                format!("references.mediaUrls.{index} must be a non-empty string."),
            );
        }
    }
    if errors.is_empty() {
        MapExportPreflightResult {
            valid: true,
            summary: "The map export is structurally ready for transfer.".to_owned(),
            errors,
            warnings: vec!["Workspace references and media availability will be checked again before an import writes content.".to_owned()],
            counts: result_counts,
            media_reference_details: Vec::new(),
            world: identity_world(payload),
            map: identity_map(payload),
        }
    } else {
        let summary = format!(
            "The map export has {} issue{}.",
            errors.len(),
            if errors.len() == 1 { "" } else { "s" }
        );
        MapExportPreflightResult {
            valid: false,
            summary,
            errors,
            warnings: vec![],
            counts: result_counts,
            media_reference_details: Vec::new(),
            world: identity_world(payload),
            map: identity_map(payload),
        }
    }
}

fn counts() -> MapExportPreflightCounts {
    MapExportPreflightCounts {
        nodes: 0,
        activities: 0,
        map_assets: 0,
        portal_targets: 0,
        media_references: 0,
    }
}
fn invalid(error: String, counts: MapExportPreflightCounts) -> MapExportPreflightResult {
    MapExportPreflightResult {
        valid: false,
        summary: "The map export is not ready for transfer.".to_owned(),
        errors: vec![error],
        warnings: vec![],
        counts,
        media_reference_details: Vec::new(),
        world: MapExportPreflightWorld {
            exists: false,
            slug: None,
        },
        map: MapExportPreflightMap {
            exists: false,
            slug: None,
        },
    }
}

fn validate_manifest_in_context(
    payload: &Value,
    context: &MapExportPreflightContext,
) -> MapExportPreflightResult {
    let serialized = serde_json::to_vec(payload).unwrap_or_default();
    let mut result = validate_manifest(&serialized);
    let world_slug = valid_slug(
        payload
            .get("world")
            .and_then(Value::as_object)
            .and_then(|world| world.get("slug")),
    );
    let map_slug = valid_slug(
        payload
            .get("map")
            .and_then(Value::as_object)
            .and_then(|map| map.get("slug")),
    );
    let world_exists = world_slug.as_deref() == Some(context.current_world_slug.as_str());
    let map_exists = world_exists
        && map_slug
            .as_ref()
            .is_some_and(|slug| context.existing_map_slugs.contains(slug));

    result.world = MapExportPreflightWorld {
        exists: world_exists,
        slug: world_slug.clone(),
    };
    result.map = MapExportPreflightMap {
        exists: map_exists,
        slug: map_slug.clone(),
    };

    if let Some(world_slug) = world_slug.as_deref()
        && !world_exists
    {
        add_error(
            &mut result.errors,
            format!("World '{world_slug}' is not available in this workspace."),
        );
    }
    if map_exists && let Some(map_slug) = map_slug.as_deref() {
        result.warnings.push(format!(
            "Map '{map_slug}' already exists in this world; a future import will need an explicit conflict choice."
        ));
    }

    validate_workspace_topic(payload, context, &mut result.errors);
    validate_workspace_portals(payload, context, map_slug.as_deref(), &mut result.errors);

    let media_urls = declared_media_urls(payload);
    result.media_reference_details = media_urls
        .iter()
        .map(|url| MapExportPreflightMediaReference {
            available: context.available_media_urls.contains(url),
            url: url.clone(),
        })
        .collect();
    for (index, reference) in media_urls.iter().enumerate() {
        if !context.available_media_urls.contains(reference) {
            add_error(
                &mut result.errors,
                format!(
                    "references.mediaUrls.{index} must point to an available local media asset."
                ),
            );
        }
    }
    let declared = media_urls.iter().collect::<BTreeSet<_>>();
    if collect_media_urls(payload)
        .iter()
        .any(|url| !declared.contains(url))
    {
        add_error(
            &mut result.errors,
            "references.mediaUrls must include every media reference used by the manifest."
                .to_owned(),
        );
    }

    result.valid = result.errors.is_empty();
    result.summary = if result.valid {
        "The manifest is structurally valid and ready to import.".to_owned()
    } else {
        "The manifest needs corrections before it can be imported.".to_owned()
    };
    result.warnings.sort();
    result.warnings.dedup();
    result
}

fn preflight_requirements(payload: &Value) -> MapExportPreflightRequirements {
    let mut map_slugs = BTreeSet::new();
    if let Some(slug) = valid_slug(
        payload
            .get("map")
            .and_then(Value::as_object)
            .and_then(|map| map.get("slug")),
    ) {
        map_slugs.insert(slug);
    }
    for portal in payload
        .get("portalTargets")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_object)
    {
        if let Some(slug) = valid_slug(portal.get("targetMapSlug")) {
            map_slugs.insert(slug);
        }
    }
    let mut topic_slugs = BTreeSet::new();
    if let Some(slug) = valid_slug(
        payload
            .get("map")
            .and_then(Value::as_object)
            .and_then(|map| map.get("topicSlug")),
    ) {
        topic_slugs.insert(slug);
    }
    MapExportPreflightRequirements {
        media_urls: declared_media_urls(payload).into_iter().collect(),
        map_slugs,
        topic_slugs,
    }
}

fn identity_world(payload: &serde_json::Map<String, Value>) -> MapExportPreflightWorld {
    MapExportPreflightWorld {
        exists: false,
        slug: valid_slug(
            payload
                .get("world")
                .and_then(Value::as_object)
                .and_then(|world| world.get("slug")),
        ),
    }
}

fn identity_map(payload: &serde_json::Map<String, Value>) -> MapExportPreflightMap {
    MapExportPreflightMap {
        exists: false,
        slug: valid_slug(
            payload
                .get("map")
                .and_then(Value::as_object)
                .and_then(|map| map.get("slug")),
        ),
    }
}

fn valid_slug(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .filter(|value| {
            !value.is_empty()
                && value.len() <= 140
                && value
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
                && value.split('-').all(|segment| !segment.is_empty())
        })
        .map(ToOwned::to_owned)
}

fn declared_media_urls(payload: &Value) -> Vec<String> {
    let mut urls = BTreeSet::new();
    for url in payload
        .get("references")
        .and_then(Value::as_object)
        .and_then(|references| references.get("mediaUrls"))
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .filter(|url| !url.trim().is_empty())
    {
        urls.insert(url.to_owned());
    }
    urls.into_iter().collect()
}

fn validate_workspace_topic(
    payload: &Value,
    context: &MapExportPreflightContext,
    errors: &mut Vec<String>,
) {
    let Some(map) = payload.get("map").and_then(Value::as_object) else {
        return;
    };
    let Some(topic) = map.get("topicSlug") else {
        return;
    };
    if topic.is_null() {
        return;
    }
    if let Some(slug) = valid_slug(Some(topic))
        && !context.available_topic_slugs.contains(&slug)
    {
        add_error(
            errors,
            format!("Topic '{slug}' is not available in this workspace."),
        );
    }
}

fn validate_workspace_portals(
    payload: &Value,
    context: &MapExportPreflightContext,
    source_map_slug: Option<&str>,
    errors: &mut Vec<String>,
) {
    let exported_nodes = exported_node_activities(payload);
    for (index, portal) in payload
        .get("portalTargets")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .enumerate()
    {
        let Some(portal) = portal.as_object() else {
            continue;
        };
        let Some(target_map_slug) = valid_slug(portal.get("targetMapSlug")) else {
            continue;
        };
        let Some(target_node_slug) = valid_slug(portal.get("targetNodeSlug")) else {
            continue;
        };
        let target_nodes = if Some(target_map_slug.as_str()) == source_map_slug {
            Some(&exported_nodes)
        } else {
            context.map_nodes.get(&target_map_slug)
        };
        let Some(target_nodes) = target_nodes else {
            add_error(
                errors,
                format!("portalTargets.{index}.targetMapSlug must name a map in this workspace."),
            );
            continue;
        };
        let Some(target_activities) = target_nodes.get(&target_node_slug) else {
            add_error(
                errors,
                format!("portalTargets.{index}.targetNodeSlug must name a node in the target map."),
            );
            continue;
        };
        if let Some(target_activity) = portal
            .get("targetActivitySlug")
            .filter(|value| !value.is_null())
            && target_activity
                .as_str()
                .is_none_or(|slug| !target_activities.contains(slug))
        {
            add_error(
                errors,
                format!(
                    "portalTargets.{index}.targetActivitySlug must name an activity in the target node."
                ),
            );
        }
    }
}

fn exported_node_activities(payload: &Value) -> BTreeMap<String, BTreeSet<String>> {
    payload
        .get("nodes")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_object)
        .filter_map(|node| {
            let slug = valid_slug(node.get("slug"))?;
            let activities = node
                .get("activities")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(Value::as_object)
                .filter_map(|activity| valid_slug(activity.get("slug")))
                .collect();
            Some((slug, activities))
        })
        .collect()
}

fn collect_media_urls(value: &Value) -> BTreeSet<String> {
    let mut urls = BTreeSet::new();
    collect_media_urls_in(value, &mut urls);
    urls
}

fn collect_media_urls_in(value: &Value, urls: &mut BTreeSet<String>) {
    let Some(object) = value.as_object() else {
        if let Some(values) = value.as_array() {
            for value in values {
                collect_media_urls_in(value, urls);
            }
        }
        return;
    };
    for (key, nested) in object {
        let normalized = key.to_ascii_lowercase().replace(['_', '-'], "");
        if nested
            .as_str()
            .is_some_and(|value| !value.trim().is_empty())
            && (normalized.ends_with("url")
                || normalized.contains("image")
                || normalized.contains("sound")
                || normalized.contains("audio")
                || normalized == "src")
        {
            urls.insert(nested.as_str().unwrap_or_default().to_owned());
        }
        collect_media_urls_in(nested, urls);
    }
}
fn object<'a>(
    value: Option<&'a Value>,
    path: &str,
    errors: &mut Vec<String>,
) -> &'a serde_json::Map<String, Value> {
    static EMPTY: std::sync::LazyLock<serde_json::Map<String, Value>> =
        std::sync::LazyLock::new(serde_json::Map::new);
    match value.and_then(Value::as_object) {
        Some(value) => value,
        None => {
            add_error(errors, format!("{path} must be an object."));
            &EMPTY
        }
    }
}
fn optional_object(value: Option<&Value>, path: &str, errors: &mut Vec<String>) {
    if value.is_some_and(|value| !value.is_null() && !value.is_object()) {
        add_error(errors, format!("{path} must be an object or null."));
    }
}
fn list<'a>(
    value: Option<&'a Value>,
    path: &str,
    maximum: usize,
    errors: &mut Vec<String>,
) -> &'a Vec<Value> {
    static EMPTY: std::sync::LazyLock<Vec<Value>> = std::sync::LazyLock::new(Vec::new);
    match value.and_then(Value::as_array) {
        Some(value) if value.len() <= maximum => value,
        Some(_) => {
            add_error(
                errors,
                format!("{path} may contain at most {maximum} entries."),
            );
            &EMPTY
        }
        None => {
            add_error(errors, format!("{path} must be a list."));
            &EMPTY
        }
    }
}
fn require_value(value: Option<&Value>, expected: &str, path: &str, errors: &mut Vec<String>) {
    if value.and_then(Value::as_str) != Some(expected) {
        add_error(errors, format!("{path} must be '{expected}'."));
    }
}
fn require_number(value: Option<&Value>, expected: u64, path: &str, errors: &mut Vec<String>) {
    if value.and_then(Value::as_u64) != Some(expected) {
        add_error(errors, format!("{path} must be {expected}."));
    }
}
fn slug(value: Option<&Value>, path: &str, errors: &mut Vec<String>) -> Option<String> {
    let value = value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| {
            !value.is_empty()
                && value.len() <= 140
                && value
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
                && value.split('-').all(|segment| !segment.is_empty())
        });
    if value.is_none() {
        add_error(errors, format!("{path} must be a lowercase slug."));
    }
    value.map(ToOwned::to_owned)
}
fn add_error(errors: &mut Vec<String>, error: String) {
    if errors.len() < MAX_ERRORS {
        errors.push(error);
    }
}

#[cfg(test)]
mod tests {
    use std::{
        collections::{BTreeMap, BTreeSet},
        sync::{
            Arc,
            atomic::{AtomicBool, Ordering},
        },
    };

    use uuid::Uuid;

    use super::*;

    struct ContextRepository {
        called: Arc<AtomicBool>,
        context: MapExportPreflightContext,
    }

    impl AdminWorldMapExportPreflightRepository for ContextRepository {
        fn load_preflight_context(
            &self,
            _: &AuthorizedPrincipal,
            _: &MapExportPreflightRequirements,
        ) -> impl Future<
            Output = Result<Option<MapExportPreflightContext>, AdminWorldMapExportPreflightError>,
        > + Send {
            self.called.store(true, Ordering::SeqCst);
            let context = self.context.clone();
            async move { Ok(Some(context)) }
        }
    }

    fn principal() -> AuthorizedPrincipal {
        AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:ru:all".to_owned()],
        }
    }

    fn context() -> MapExportPreflightContext {
        MapExportPreflightContext {
            available_media_urls: [
                "/api/v1/admin/media-assets/00000000-0000-4000-8000-000000000001/content"
                    .to_owned(),
            ]
            .into_iter()
            .collect(),
            current_world_slug: "world".to_owned(),
            existing_map_slugs: ["map".to_owned()].into_iter().collect(),
            available_topic_slugs: ["topic".to_owned()].into_iter().collect(),
            map_nodes: BTreeMap::from([(
                "other-map".to_owned(),
                BTreeMap::from([(
                    "target".to_owned(),
                    ["target-activity".to_owned()].into_iter().collect(),
                )]),
            )]),
        }
    }
    #[test]
    fn rejects_dangling_activity_links_without_mutating_a_manifest() {
        let result = validate_manifest(br#"{"format":"wicked-learning-map","formatVersion":1,"world":{"slug":"world"},"map":{"slug":"map"},"nodes":[{"slug":"node","activities":[{"slug":"start","type":"markdown","title":"Start","transitions":[{"toActivitySlug":"gone"}]}]}],"mapAssets":[],"portalTargets":[],"references":{"mediaUrls":[]}}"#);
        assert!(!result.valid);
        assert!(
            result
                .errors
                .iter()
                .any(|error| error.contains("toActivitySlug"))
        );
    }

    #[test]
    fn accepts_a_global_portal_link_without_activity_endpoints() {
        let result = validate_manifest(br#"{"format":"wicked-learning-map","formatVersion":1,"world":{"slug":"world"},"map":{"slug":"map"},"nodes":[{"slug":"source","activities":[]},{"slug":"target","activities":[]}],"mapAssets":[],"portalTargets":[{"sourceNodeSlug":"source","sourceActivitySlug":null,"targetMapSlug":"map","targetNodeSlug":"target","targetActivitySlug":null}],"references":{"mediaUrls":[]}}"#);

        assert!(result.valid, "{:#?}", result.errors);
    }

    #[test]
    fn rejects_dialogue_edges_that_escape_their_activity() {
        let result = validate_manifest(br#"{"format":"wicked-learning-map","formatVersion":1,"world":{"slug":"world"},"map":{"slug":"map"},"nodes":[{"slug":"node","activities":[{"slug":"start","type":"npc_dialogue","title":"Start","transitions":[],"dialogueNodes":[{"sourceId":"node-a"}],"dialogueTransitions":[{"toSourceId":"node-b"}]}]}],"mapAssets":[],"portalTargets":[],"references":{"mediaUrls":[]}}"#);
        assert!(!result.valid);
        assert!(
            result
                .errors
                .iter()
                .any(|error| error.contains("toSourceId"))
        );
    }

    #[test]
    fn rejects_non_object_companion_configuration() {
        let result = validate_manifest(br#"{"format":"wicked-learning-map","formatVersion":1,"world":{"slug":"world"},"map":{"slug":"map","companionConfig":[]},"nodes":[],"mapAssets":[],"portalTargets":[],"references":{"mediaUrls":[]}}"#);

        assert!(!result.valid);
        assert!(
            result
                .errors
                .iter()
                .any(|error| error.contains("map.companionConfig"))
        );
    }

    #[tokio::test]
    async fn projects_the_full_source_import_read_model_from_workspace_facts() {
        let called = Arc::new(AtomicBool::new(false));
        let repository = ContextRepository {
            called: called.clone(),
            context: context(),
        };
        let manifest = br#"{"format":"wicked-learning-map","formatVersion":1,"world":{"slug":"world"},"map":{"slug":"map","topicSlug":"topic"},"nodes":[{"slug":"source","activities":[{"slug":"start","type":"markdown","title":"Start","transitions":[],"dialogueNodes":[],"dialogueTransitions":[]}]}],"mapAssets":[],"portalTargets":[{"sourceNodeSlug":"source","sourceActivitySlug":"start","targetMapSlug":"other-map","targetNodeSlug":"target","targetActivitySlug":"target-activity"}],"references":{"mediaUrls":["/api/v1/admin/media-assets/00000000-0000-4000-8000-000000000001/content"]}}"#;

        let result = AdminWorldMapExportPreflightQuery::new(&repository)
            .execute(&principal(), manifest, &BTreeSet::new())
            .await
            .expect("context is available")
            .expect("principal is allowed");

        assert!(called.load(Ordering::SeqCst));
        assert!(result.valid, "{:#?}", result.errors);
        assert_eq!(result.world.slug.as_deref(), Some("world"));
        assert!(result.world.exists);
        assert_eq!(result.map.slug.as_deref(), Some("map"));
        assert!(result.map.exists);
        assert_eq!(result.media_reference_details.len(), 1);
        assert!(result.media_reference_details[0].available);
        assert!(
            result
                .warnings
                .iter()
                .any(|warning| warning.contains("already exists"))
        );
    }

    #[tokio::test]
    async fn reports_workspace_and_media_unavailability_without_approving_import() {
        let repository = ContextRepository {
            called: Arc::new(AtomicBool::new(false)),
            context: context(),
        };
        let manifest = br#"{"format":"wicked-learning-map","formatVersion":1,"world":{"slug":"other-world"},"map":{"slug":"new-map","topicSlug":"missing-topic"},"nodes":[],"mapAssets":[],"portalTargets":[],"references":{"mediaUrls":["/api/v1/admin/media-assets/00000000-0000-4000-8000-000000000099/content"]}}"#;

        let result = AdminWorldMapExportPreflightQuery::new(&repository)
            .execute(&principal(), manifest, &BTreeSet::new())
            .await
            .expect("context is available")
            .expect("principal is allowed");

        assert!(!result.valid);
        assert!(!result.world.exists);
        assert!(!result.map.exists);
        assert_eq!(result.media_reference_details.len(), 1);
        assert!(!result.media_reference_details[0].available);
        assert!(
            result
                .errors
                .iter()
                .any(|error| error.contains("World 'other-world'"))
        );
        assert!(
            result
                .errors
                .iter()
                .any(|error| error.contains("Topic 'missing-topic'"))
        );
        assert!(
            result
                .errors
                .iter()
                .any(|error| error.contains("available local media"))
        );
    }

    #[tokio::test]
    async fn accepts_archive_verified_media_and_denies_before_reading_context() {
        let called = Arc::new(AtomicBool::new(false));
        let repository = ContextRepository {
            called: called.clone(),
            context: context(),
        };
        let package_media = ["https://example.test/archive-image.png".to_owned()]
            .into_iter()
            .collect();
        let manifest = br#"{"format":"wicked-learning-map","formatVersion":1,"world":{"slug":"world"},"map":{"slug":"new-map"},"nodes":[],"mapAssets":[],"portalTargets":[],"references":{"mediaUrls":["https://example.test/archive-image.png"]}}"#;
        let result = AdminWorldMapExportPreflightQuery::new(&repository)
            .execute(&principal(), manifest, &package_media)
            .await
            .expect("context is available")
            .expect("principal is allowed");
        assert!(result.valid, "{:#?}", result.errors);
        assert!(result.media_reference_details[0].available);

        called.store(false, Ordering::SeqCst);
        let forbidden = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec![],
        };
        let result = AdminWorldMapExportPreflightQuery::new(&repository)
            .execute(&forbidden, manifest, &BTreeSet::new())
            .await
            .expect("authorization is not a repository failure");
        assert!(result.is_none());
        assert!(!called.load(Ordering::SeqCst));
    }
}
