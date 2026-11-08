use std::future::Future;

use serde_json::{Map, Value, json};
use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

use crate::admin_world_map_layout::HexPosition;

#[derive(Clone, Debug, PartialEq)]
pub struct WorldNodeForm {
    pub title: String,
    pub slug: Option<String>,
    pub description: String,
    pub position: HexPosition,
    pub state: String,
    pub visual_config: Value,
}

impl WorldNodeForm {
    pub fn parse(
        title: &str,
        slug: Option<&str>,
        description: Option<&str>,
        position: HexPosition,
        state: &str,
        visual_config: Value,
    ) -> Option<Self> {
        let title = title.trim();
        if title.is_empty() || title.chars().count() > 120 {
            return None;
        }
        let slug = slug.map(str::trim).filter(|value| !value.is_empty());
        if slug.is_some_and(|value| value.chars().count() > 140 || !valid_slug(value))
            || !matches!(
                state,
                "active"
                    | "available"
                    | "completed"
                    | "hidden"
                    | "hinted"
                    | "locked"
                    | "recommended"
            )
            || !valid_visual_config(&visual_config)
        {
            return None;
        }
        let description = description.map(str::trim).unwrap_or_default();
        if description.chars().count() > 1_000 {
            return None;
        }

        Some(Self {
            title: title.to_owned(),
            slug: slug.map(str::to_owned),
            description: description.to_owned(),
            position,
            state: state.to_owned(),
            visual_config: merge_defaults(title, visual_config),
        })
    }
}

pub fn generated_node_slug(title: &str) -> String {
    let mut slug = String::new();
    let mut separator = true;
    for character in deunicode::deunicode(title).chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character.to_ascii_lowercase());
            separator = false;
        } else if !separator {
            slug.push('-');
            separator = true;
        }
    }
    let slug = slug.trim_matches('-');
    if slug.is_empty() {
        "node".to_owned()
    } else {
        slug.to_owned()
    }
}

fn valid_slug(value: &str) -> bool {
    value
        .bytes()
        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}

fn valid_visual_config(value: &Value) -> bool {
    let Some(config) = value.as_object() else {
        return false;
    };
    optional_string(config, "label", 80)
        && optional_string(config, "tooltip", 255)
        && ["hideEmptySpace", "hideImage", "hideLabel"]
            .into_iter()
            .all(|key| optional_bool(config, key))
        && valid_reveal(config.get("reveal"))
        && valid_schedule(config.get("schedule"))
        && valid_unlock(config.get("unlock"))
        && valid_sounds(config.get("sounds"))
        && ["dark", "light"]
            .into_iter()
            .all(|key| valid_theme(config.get(key)))
}

fn optional_string(config: &Map<String, Value>, key: &str, maximum: usize) -> bool {
    config.get(key).is_none_or(|value| {
        value
            .as_str()
            .is_some_and(|value| value.chars().count() <= maximum)
    })
}

fn optional_bool(config: &Map<String, Value>, key: &str) -> bool {
    config.get(key).is_none_or(Value::is_boolean)
}

fn valid_reveal(value: Option<&Value>) -> bool {
    value.is_none_or(|value| {
        value.as_object().is_some_and(|reveal| {
            optional_bool(reveal, "enabled") && optional_string(reveal, "toolId", 140)
        })
    })
}

fn valid_schedule(value: Option<&Value>) -> bool {
    value.is_none_or(|value| {
        value.as_object().is_some_and(|schedule| {
            optional_string(schedule, "unlockAt", 80) && optional_string(schedule, "lockAt", 80)
        })
    })
}

fn valid_unlock(value: Option<&Value>) -> bool {
    value.is_none_or(|value| {
        value.as_object().is_some_and(|unlock| {
            optional_bool(unlock, "enabled")
                && optional_operator(unlock, "topOperator")
                && optional_operator(unlock, "nodeOperator")
                && optional_string(unlock, "roleSlug", 80)
                && unlock.get("requiredNodeIds").is_none_or(|nodes| {
                    nodes.as_array().is_some_and(|nodes| {
                        nodes.iter().all(|node| {
                            node.as_str()
                                .is_some_and(|node| node.chars().count() <= 140)
                        })
                    })
                })
                && valid_unlock_reference(unlock.get("tool"), "toolId")
                && valid_unlock_reference(unlock.get("item"), "itemId")
                && valid_rule(unlock.get("rules"), 0)
        })
    })
}

fn optional_operator(config: &Map<String, Value>, key: &str) -> bool {
    config
        .get(key)
        .is_none_or(|value| matches!(value.as_str(), Some("and" | "or")))
}

fn valid_unlock_reference(value: Option<&Value>, key: &str) -> bool {
    value.is_none_or(|value| {
        value.as_object().is_some_and(|reference| {
            optional_bool(reference, "enabled") && optional_string(reference, key, 140)
        })
    })
}

fn valid_rule(value: Option<&Value>, depth: usize) -> bool {
    value.is_none_or(|value| {
        depth <= 12
            && value.as_object().is_some_and(|rule| {
                match rule.get("type").and_then(Value::as_str) {
                    Some("group") => {
                        matches!(
                            rule.get("operator").and_then(Value::as_str),
                            Some("and" | "or")
                        ) && rule
                            .get("rules")
                            .and_then(Value::as_array)
                            .is_some_and(|rules| {
                                !rules.is_empty()
                                    && rules.iter().all(|rule| valid_rule(Some(rule), depth + 1))
                            })
                    }
                    Some("item_owned") => optional_string(rule, "itemId", 140),
                    Some("node_completed") => optional_string(rule, "nodeId", 140),
                    Some("role_has") => optional_string(rule, "roleSlug", 80),
                    Some("time_after" | "tool_used") => true,
                    _ => false,
                }
            })
    })
}

fn valid_sounds(value: Option<&Value>) -> bool {
    value.is_none_or(|value| {
        value.as_object().is_some_and(|sounds| {
            ["mouseEnter", "click", "mouseLeave", "unlock"]
                .into_iter()
                .all(|key| {
                    sounds.get(key).is_none_or(|sound| {
                        sound.as_object().is_some_and(|sound| {
                            optional_bool(sound, "enabled") && optional_string(sound, "url", 2_048)
                        })
                    })
                })
        })
    })
}

fn valid_theme(value: Option<&Value>) -> bool {
    value.is_none_or(|value| {
        value.as_object().is_some_and(|theme| {
            [
                "tileColor",
                "foregroundColor",
                "labelColor",
                "highlightColor",
                "borderColor",
                "highlightBorderColor",
                "highlightedLabelColor",
            ]
            .into_iter()
            .all(|key| optional_string(theme, key, 40))
                && optional_string(theme, "imageUrl", 2_048)
                && optional_number(theme, "imageRotation", -360.0, 360.0)
                && optional_number(theme, "imageWidth", 10.0, 200.0)
                && optional_number(theme, "imageX", 0.0, 100.0)
                && optional_number(theme, "imageY", 0.0, 100.0)
                && [
                    "tileOpacity",
                    "foregroundOpacity",
                    "labelOpacity",
                    "highlightOpacity",
                    "borderOpacity",
                    "highlightBorderOpacity",
                    "highlightedLabelOpacity",
                ]
                .into_iter()
                .all(|key| optional_number(theme, key, 0.0, 100.0))
        })
    })
}

fn optional_number(config: &Map<String, Value>, key: &str, minimum: f64, maximum: f64) -> bool {
    config.get(key).is_none_or(|value| {
        let value = value
            .as_f64()
            .or_else(|| value.as_str().and_then(|value| value.parse::<f64>().ok()));
        value.is_some_and(|value| value.is_finite() && (minimum..=maximum).contains(&value))
    })
}

fn merge_defaults(title: &str, visual_config: Value) -> Value {
    let mut defaults = default_visual_config(title);
    merge(&mut defaults, filter_empty(visual_config));
    defaults
}

fn default_visual_config(title: &str) -> Value {
    json!({
        "icon": "map",
        "label": title,
        "dark": theme_defaults("#253047", "#bfdbfe", "#ffffff", "#7dd3fc", "#bfdbfe"),
        "light": theme_defaults("#dbeafe", "#1d4ed8", "#0f172a", "#2563eb", "#1d4ed8"),
    })
}

fn theme_defaults(
    tile_color: &str,
    foreground_color: &str,
    label_color: &str,
    highlight_color: &str,
    highlight_border_color: &str,
) -> Value {
    json!({
        "tileColor": tile_color,
        "tileOpacity": "100",
        "borderColor": tile_color,
        "borderOpacity": "100",
        "foregroundColor": foreground_color,
        "foregroundOpacity": "100",
        "labelColor": label_color,
        "labelOpacity": "100",
        "highlightColor": highlight_color,
        "highlightOpacity": "100",
        "highlightBorderColor": highlight_border_color,
        "highlightBorderOpacity": "100",
        "highlightedLabelColor": "#ffffff",
        "highlightedLabelOpacity": "100",
        "imageRotation": "0",
        "imageWidth": "100",
        "imageX": "50",
        "imageY": "50",
    })
}

fn filter_empty(value: Value) -> Value {
    match value {
        Value::Object(values) => Value::Object(
            values
                .into_iter()
                .filter_map(|(key, value)| {
                    let value = filter_empty(value);
                    (!value.is_null()
                        && value != Value::String(String::new())
                        && value != Value::Object(Map::new()))
                    .then_some((key, value))
                })
                .collect(),
        ),
        Value::Array(values) => Value::Array(
            values
                .into_iter()
                .map(filter_empty)
                .filter(|value| !value.is_null() && value != &Value::String(String::new()))
                .collect(),
        ),
        value => value,
    }
}

fn merge(target: &mut Value, source: Value) {
    match (target, source) {
        (Value::Object(target), Value::Object(source)) => {
            for (key, value) in source {
                merge(target.entry(key).or_insert(Value::Null), value);
            }
        }
        (target, source) => *target = source,
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldNodeWriteError {
    Invalid,
    Unavailable,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CreatedWorldNode {
    pub node_id: Uuid,
    pub asset_id: Uuid,
}

pub trait AdminWorldNodeWriteRepository {
    fn create_node(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &WorldNodeForm,
    ) -> impl Future<Output = Result<Option<CreatedWorldNode>, AdminWorldNodeWriteError>> + Send;
    fn insert_node(
        &self,
        principal: &AuthorizedPrincipal,
        origin_node_id: Uuid,
        direction: HexPosition,
        form: &WorldNodeForm,
    ) -> impl Future<Output = Result<Option<CreatedWorldNode>, AdminWorldNodeWriteError>> + Send;
    fn update_node(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &WorldNodeForm,
    ) -> impl Future<Output = Result<bool, AdminWorldNodeWriteError>> + Send;
    fn delete_node(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
    ) -> impl Future<Output = Result<bool, AdminWorldNodeWriteError>> + Send;
}

pub struct AdminWorldNodeWriteCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldNodeWriteCommand<'repository, Repository>
where
    Repository: AdminWorldNodeWriteRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &WorldNodeForm,
    ) -> Result<Option<CreatedWorldNode>, AdminWorldNodeWriteError> {
        if !principal.has_permission("world_nodes", "ru") {
            return Ok(None);
        }
        self.repository.create_node(principal, map_id, form).await
    }

    pub async fn insert(
        &self,
        principal: &AuthorizedPrincipal,
        origin_node_id: Uuid,
        direction: HexPosition,
        form: &WorldNodeForm,
    ) -> Result<Option<CreatedWorldNode>, AdminWorldNodeWriteError> {
        if !principal.has_permission("world_maps", "ru") || !direction.is_neighbor_direction() {
            return Ok(None);
        }
        self.repository
            .insert_node(principal, origin_node_id, direction, form)
            .await
    }

    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &WorldNodeForm,
    ) -> Result<bool, AdminWorldNodeWriteError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(false);
        }
        self.repository.update_node(principal, node_id, form).await
    }

    pub async fn delete(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
    ) -> Result<bool, AdminWorldNodeWriteError> {
        if !principal.has_permission("world_nodes", "rud") {
            return Ok(false);
        }
        self.repository.delete_node(principal, node_id).await
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{HexPosition, WorldNodeForm, generated_node_slug};

    #[test]
    fn source_node_form_preserves_defaults_and_all_source_states() {
        let form = WorldNodeForm::parse(
            "A tile",
            None,
            None,
            HexPosition { q: 0, r: 0 },
            "recommended",
            json!({"label": "", "dark": {"imageRotation": "0", "tileColor": "#123456"}}),
        )
        .expect("source-shaped node form");

        assert_eq!(form.visual_config["label"], "A tile");
        assert_eq!(form.visual_config["dark"]["tileColor"], "#123456");
        assert_eq!(
            generated_node_slug("Über den nächsten Schritt"),
            "uber-den-nachsten-schritt"
        );
        assert!(
            WorldNodeForm::parse(
                "A tile",
                None,
                None,
                HexPosition { q: 0, r: 0 },
                "not-a-state",
                json!({})
            )
            .is_none()
        );
    }
}
