use serde::Serialize;
use serde_json::Value;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

const MAX_NODES: usize = 500;
const MAX_ASSETS: usize = 2_000;
const MAX_ACTIVITIES: usize = 100;
const MAX_ERRORS: usize = 30;

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct MapExportPreflightResult {
    pub valid: bool,
    pub summary: String,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub counts: MapExportPreflightCounts,
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

pub struct AdminWorldMapExportPreflightQuery;

impl AdminWorldMapExportPreflightQuery {
    pub fn execute(
        principal: &AuthorizedPrincipal,
        manifest: &[u8],
    ) -> Option<MapExportPreflightResult> {
        if !principal.has_permission("world_maps", "ru") {
            return None;
        }
        Some(validate_manifest(manifest))
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
        MapExportPreflightResult { valid: true, summary: "The map export is structurally ready for transfer.".to_owned(), errors, warnings: vec!["Workspace references and media availability will be checked again before an import writes content.".to_owned()], counts: result_counts }
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
    use super::*;
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
}
