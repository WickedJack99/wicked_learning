use std::future::Future;

use serde_json::Value;
use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, world_content::AdminNpcDialogueGraph,
};

pub const MAX_DIALOGUE_NODES: usize = 80;
pub const MAX_SCENE_ASSETS: usize = 20;

#[derive(Clone, Debug, PartialEq)]
pub struct NpcDialogueActivityForm {
    pub title: String,
    pub slug: Option<String>,
    pub introduction: Option<String>,
    pub graph_position_x: Option<i32>,
    pub graph_position_y: Option<i32>,
}

impl NpcDialogueActivityForm {
    pub fn parse(title: &str, slug: Option<&str>, introduction: Option<&str>) -> Option<Self> {
        let title = title.trim();
        let slug = slug.map(str::trim).filter(|value| !value.is_empty());
        if title.is_empty()
            || title.chars().count() > 120
            || slug.is_some_and(|value| value.chars().count() > 140 || !valid_slug(value))
            || introduction.is_some_and(|value| value.chars().count() > 1_000)
        {
            return None;
        }
        Some(Self {
            title: title.to_owned(),
            slug: slug.map(str::to_owned),
            introduction: introduction.map(str::to_owned),
            graph_position_x: None,
            graph_position_y: None,
        })
    }

    pub fn with_graph_position(mut self, x: Option<i32>, y: Option<i32>) -> Self {
        self.graph_position_x = x;
        self.graph_position_y = y;
        self
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NpcDialogueNodeType {
    Answer,
    End,
    Monologue,
    Question,
    Reflection,
}

impl NpcDialogueNodeType {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "answer" => Some(Self::Answer),
            "end" => Some(Self::End),
            "npc_monologue" => Some(Self::Monologue),
            "npc_question" => Some(Self::Question),
            "reflection" => Some(Self::Reflection),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Answer => "answer",
            Self::End => "end",
            Self::Monologue => "npc_monologue",
            Self::Question => "npc_question",
            Self::Reflection => "reflection",
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct NpcDialoguePosition {
    pub x: f64,
    pub y: f64,
}

impl NpcDialoguePosition {
    pub fn parse(x: f64, y: f64) -> Option<Self> {
        (x.is_finite() && y.is_finite()).then_some(Self { x, y })
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct NpcDialogueNodeForm {
    pub node_type: NpcDialogueNodeType,
    pub title: String,
    pub body: Option<String>,
    pub config: Value,
    pub position: Option<NpcDialoguePosition>,
}

impl NpcDialogueNodeForm {
    pub fn parse(
        node_type: &str,
        title: &str,
        body: Option<&str>,
        config: Value,
        position: Option<NpcDialoguePosition>,
    ) -> Option<Self> {
        let node_type = NpcDialogueNodeType::parse(node_type)?;
        let title = title.trim();
        let body = body.map(str::to_owned);
        (valid_node_config(node_type, title, body.as_deref(), &config)).then_some(Self {
            node_type,
            title: title.to_owned(),
            body,
            config,
            position,
        })
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct NpcDialogueTransitionForm {
    pub from_node_id: Option<Uuid>,
    pub to_node_id: Uuid,
    pub from_connector: String,
    pub to_connector: String,
}

impl NpcDialogueTransitionForm {
    pub fn parse(
        from_node_id: Option<Uuid>,
        to_node_id: Uuid,
        from_connector: &str,
        to_connector: &str,
    ) -> Option<Self> {
        let from_connector = from_connector.trim();
        let to_connector = to_connector.trim();
        (!from_connector.is_empty()
            && from_connector.chars().count() <= 80
            && !to_connector.is_empty()
            && to_connector.chars().count() <= 80)
            .then(|| Self {
                from_node_id,
                to_node_id,
                from_connector: from_connector.to_owned(),
                to_connector: to_connector.to_owned(),
            })
    }
}

fn valid_node_config(
    node_type: NpcDialogueNodeType,
    title: &str,
    body: Option<&str>,
    config: &Value,
) -> bool {
    if title.is_empty()
        || title.chars().count() > 120
        || body.is_some_and(|value| value.chars().count() > 4_000)
    {
        return false;
    }
    let Some(config) = config.as_object() else {
        return false;
    };
    if config.len() > 40 || config.values().any(|value| !bounded_json(value, 10)) {
        return false;
    }
    let string = |key: &str, max: usize| {
        config.get(key).is_none_or(|value| {
            value
                .as_str()
                .is_some_and(|value| value.chars().count() <= max)
        })
    };
    let nullable_string = |key: &str, max: usize| {
        config.get(key).is_none_or(|value| {
            value.is_null()
                || value
                    .as_str()
                    .is_some_and(|value| value.chars().count() <= max)
        })
    };
    let number = |key: &str, minimum: f64, maximum: f64| {
        config.get(key).is_none_or(|value| {
            value
                .as_f64()
                .is_some_and(|value| value.is_finite() && (minimum..=maximum).contains(&value))
        })
    };
    let boolean = |key: &str| config.get(key).is_none_or(Value::is_boolean);
    let colors = [
        "bubbleColorDark",
        "bubbleBorderColorDark",
        "bubbleColorLight",
        "bubbleBorderColorLight",
        "connectorColor",
    ];
    if !colors.iter().all(|key| {
        config
            .get(*key)
            .is_none_or(|value| value.as_str().is_some_and(valid_hex_color))
    }) || ![
        "backgroundDark",
        "backgroundLight",
        "npcImageDark",
        "npcImageLight",
    ]
    .iter()
    .all(|key| string(key, 2_048))
        || !["slideDirection"].iter().all(|key| {
            config.get(*key).is_none_or(|value| {
                matches!(
                    value.as_str(),
                    Some("left" | "right" | "top" | "bottom" | "none")
                )
            })
        })
        || ![
            "backgroundMirrored",
            "npcImageMirrored",
            "typingSoundEnabled",
            "isCorrect",
        ]
        .iter()
        .all(|key| boolean(key))
        || !["npcX", "npcY", "bubbleOpacityDark", "bubbleOpacityLight"]
            .iter()
            .all(|key| number(key, 0.0, 100.0))
        || !["typingSpeed"].iter().all(|key| number(key, 1.0, 250.0))
        || !["slideDurationSeconds", "fadeDurationSeconds"]
            .iter()
            .all(|key| number(key, 0.0, 30.0))
        || !nullable_string("toolId", 80)
        || !nullable_string("typingSoundSetId", 80)
        || !string("journalTopic", 160)
        || !string("journalSubtopic", 160)
        || !string("answerLabel", 120)
        || !string("connectorSymbol", 12)
        || !number("questionOutputCount", 1.0, 12.0)
    {
        return false;
    }
    let assets_valid = config.get("sceneAssets").is_none_or(|assets| {
        assets.as_array().is_some_and(|assets| {
            assets.len() <= MAX_SCENE_ASSETS && assets.iter().all(valid_scene_asset)
        })
    });
    let events_valid = config.get("events").is_none_or(|events| {
        events.as_object().is_some_and(|events| {
            ["hideNodeIds", "unlockNodeIds"].iter().all(|key| {
                events.get(*key).is_none_or(|values| {
                    values.as_array().is_some_and(|values| {
                        values.len() <= 100
                            && values.iter().all(|value| {
                                value
                                    .as_str()
                                    .is_some_and(|value| Uuid::parse_str(value).is_ok())
                            })
                    })
                })
            })
        })
    });
    assets_valid
        && events_valid
        && match node_type {
            NpcDialogueNodeType::Answer => true,
            NpcDialogueNodeType::End => body.is_none_or(str::is_empty),
            _ => true,
        }
}

fn valid_scene_asset(value: &Value) -> bool {
    let Some(asset) = value.as_object() else {
        return false;
    };
    let text = |key: &str, maximum: usize| {
        asset.get(key).is_some_and(|value| {
            value
                .as_str()
                .is_some_and(|value| value.chars().count() <= maximum)
        })
    };
    let number = |key: &str, minimum: f64, maximum: f64| {
        asset.get(key).is_some_and(|value| {
            value
                .as_f64()
                .is_some_and(|value| value.is_finite() && (minimum..=maximum).contains(&value))
        })
    };
    text("id", 120)
        && text("imageDark", 2_048)
        && text("imageLight", 2_048)
        && text("label", 120)
        && asset
            .get("layer")
            .and_then(Value::as_str)
            .is_some_and(|value| matches!(value, "behind_npc" | "front" | "bubble" | "overlay"))
        && asset.get("mirrored").is_some_and(Value::is_boolean)
        && number("width", 1.0, 100.0)
        && number("x", 0.0, 100.0)
        && number("y", 0.0, 100.0)
}

fn bounded_json(value: &Value, remaining_depth: usize) -> bool {
    if remaining_depth == 0 {
        return false;
    }
    match value {
        Value::Null | Value::Bool(_) | Value::Number(_) => true,
        Value::String(value) => value.chars().count() <= 4_000,
        Value::Array(values) => {
            values.len() <= 100
                && values
                    .iter()
                    .all(|value| bounded_json(value, remaining_depth - 1))
        }
        Value::Object(values) => {
            values.len() <= 100
                && values
                    .values()
                    .all(|value| bounded_json(value, remaining_depth - 1))
        }
    }
}

fn valid_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value.bytes().skip(1).all(|value| value.is_ascii_hexdigit())
}

fn valid_slug(value: &str) -> bool {
    value
        .bytes()
        .all(|value| value.is_ascii_lowercase() || value.is_ascii_digit() || value == b'-')
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldNpcDialogueError {
    Conflict,
    InvalidActivity,
    Unavailable,
}

#[derive(Clone, Debug, PartialEq)]
pub struct CreatedNpcDialogueActivity {
    pub activity_id: Uuid,
    pub config: Value,
    pub slug: String,
}

pub trait AdminWorldNpcDialogueRepository {
    fn load_npc_dialogue(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
    ) -> impl Future<Output = Result<Option<AdminNpcDialogueGraph>, AdminWorldNpcDialogueError>> + Send;
    fn create_npc_dialogue(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &NpcDialogueActivityForm,
    ) -> impl Future<Output = Result<Option<CreatedNpcDialogueActivity>, AdminWorldNpcDialogueError>>
    + Send;
    fn create_dialogue_node(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &NpcDialogueNodeForm,
    ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldNpcDialogueError>> + Send;
    fn update_dialogue_node(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        dialogue_node_id: Uuid,
        form: &NpcDialogueNodeForm,
    ) -> impl Future<Output = Result<bool, AdminWorldNpcDialogueError>> + Send;
    fn delete_dialogue_node(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        dialogue_node_id: Uuid,
    ) -> impl Future<Output = Result<bool, AdminWorldNpcDialogueError>> + Send;
    fn create_dialogue_transition(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &NpcDialogueTransitionForm,
    ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldNpcDialogueError>> + Send;
    fn delete_dialogue_transition(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        transition_id: Uuid,
    ) -> impl Future<Output = Result<bool, AdminWorldNpcDialogueError>> + Send;
    fn update_dialogue_layout(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        position: NpcDialoguePosition,
    ) -> impl Future<Output = Result<bool, AdminWorldNpcDialogueError>> + Send;
}

pub struct AdminWorldNpcDialogueCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: AdminWorldNpcDialogueRepository>
    AdminWorldNpcDialogueCommand<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn load(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
    ) -> Result<Option<AdminNpcDialogueGraph>, AdminWorldNpcDialogueError> {
        if !self.permitted(principal) {
            return Ok(None);
        }
        self.repository
            .load_npc_dialogue(principal, activity_id)
            .await
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &NpcDialogueActivityForm,
    ) -> Result<Option<CreatedNpcDialogueActivity>, AdminWorldNpcDialogueError> {
        if !self.permitted(principal) {
            return Ok(None);
        }
        self.repository
            .create_npc_dialogue(principal, node_id, form)
            .await
    }

    pub async fn create_node(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &NpcDialogueNodeForm,
    ) -> Result<Option<Uuid>, AdminWorldNpcDialogueError> {
        if !self.permitted(principal) {
            return Ok(None);
        }
        self.repository
            .create_dialogue_node(principal, activity_id, form)
            .await
    }

    pub async fn update_node(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        dialogue_node_id: Uuid,
        form: &NpcDialogueNodeForm,
    ) -> Result<bool, AdminWorldNpcDialogueError> {
        if !self.permitted(principal) {
            return Ok(false);
        }
        self.repository
            .update_dialogue_node(principal, activity_id, dialogue_node_id, form)
            .await
    }

    pub async fn delete_node(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        dialogue_node_id: Uuid,
    ) -> Result<bool, AdminWorldNpcDialogueError> {
        if !self.permitted(principal) {
            return Ok(false);
        }
        self.repository
            .delete_dialogue_node(principal, activity_id, dialogue_node_id)
            .await
    }

    pub async fn create_transition(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &NpcDialogueTransitionForm,
    ) -> Result<Option<Uuid>, AdminWorldNpcDialogueError> {
        if !self.permitted(principal) {
            return Ok(None);
        }
        self.repository
            .create_dialogue_transition(principal, activity_id, form)
            .await
    }

    pub async fn delete_transition(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        transition_id: Uuid,
    ) -> Result<bool, AdminWorldNpcDialogueError> {
        if !self.permitted(principal) {
            return Ok(false);
        }
        self.repository
            .delete_dialogue_transition(principal, activity_id, transition_id)
            .await
    }

    pub async fn update_layout(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        position: NpcDialoguePosition,
    ) -> Result<bool, AdminWorldNpcDialogueError> {
        if !self.permitted(principal) {
            return Ok(false);
        }
        self.repository
            .update_dialogue_layout(principal, activity_id, position)
            .await
    }

    fn permitted(&self, principal: &AuthorizedPrincipal) -> bool {
        principal.has_permission("world_activities", "ru")
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{NpcDialogueActivityForm, NpcDialogueNodeForm, NpcDialogueNodeType};

    #[test]
    fn activity_form_keeps_optional_graph_position() {
        let form = NpcDialogueActivityForm::parse("Guide", None, None)
            .expect("valid dialogue activity")
            .with_graph_position(Some(120), None);

        assert_eq!(form.graph_position_x, Some(120));
        assert_eq!(form.graph_position_y, None);
    }

    #[test]
    fn preserves_source_scene_configuration_but_rejects_unbounded_assets() {
        assert!(NpcDialogueNodeForm::parse(
            "npc_monologue", "Guide", Some("Welcome"),
            json!({"backgroundDark":"/scene.webp","npcX": 50, "sceneAssets":[{"id":"lamp","imageDark":"/lamp.webp","imageLight":"","label":"Lamp","layer":"front","mirrored":false,"width":24,"x":50,"y":50}]}), None
        ).is_some());
        assert!(
            NpcDialogueNodeForm::parse(
                "end",
                "End A",
                None,
                json!({"connectorColor":"not-a-colour"}),
                None
            )
            .is_none()
        );
        assert_eq!(
            NpcDialogueNodeType::parse("npc_question"),
            Some(NpcDialogueNodeType::Question)
        );
    }

    #[test]
    fn accepts_source_defaults_and_uuid_answer_events() {
        let target = "1d3e2ace-3c65-47c8-b2d6-fbf9e21d6848";
        assert!(
            NpcDialogueNodeForm::parse(
                "npc_monologue",
                "Guide",
                Some("Welcome"),
                json!({
                    "toolId": null,
                    "typingSoundSetId": null,
                    "sceneAssets": [],
                    "typingSpeed": 28,
                    "slideDurationSeconds": 0.6,
                    "fadeDurationSeconds": 0.4
                }),
                None,
            )
            .is_some()
        );
        assert!(
            NpcDialogueNodeForm::parse(
                "answer",
                "Open the archive",
                Some("Open it"),
                json!({
                    "answerLabel": "Open",
                    "events": {"hideNodeIds": [target], "unlockNodeIds": [target]}
                }),
                None,
            )
            .is_some()
        );
    }
}
