use serde_json::Value;
use uuid::Uuid;
use wicked_learning_domain::learner_state::{LearnerItem, LearnerTool};

const ADMIN_MEDIA_CONTENT_PREFIX: &str = "/api/v1/admin/media-assets/";
const LEARNER_MEDIA_CONTENT_PREFIX: &str = "/api/v1/learner/media-assets/";

/// Rewrites only a Rust-owned reusable-media content path for a learner-safe
/// projection. Custom and malformed paths retain their authored value.
pub fn learner_media_url(value: &str) -> String {
    let Some(path) = value.strip_prefix(ADMIN_MEDIA_CONTENT_PREFIX) else {
        return value.to_owned();
    };
    let Some((asset_id, suffix)) = path.split_once('/') else {
        return value.to_owned();
    };
    if suffix != "content" || Uuid::parse_str(asset_id).is_err() {
        return value.to_owned();
    }
    format!("{LEARNER_MEDIA_CONTENT_PREFIX}{asset_id}/content")
}

/// Applies `learner_media_url` recursively to an already learner-safe JSON
/// configuration without interpreting arbitrary author configuration.
pub fn learner_media_config(value: Value) -> Value {
    match value {
        Value::Object(object) => Value::Object(
            object
                .into_iter()
                .map(|(key, value)| (key, learner_media_config(value)))
                .collect(),
        ),
        Value::Array(values) => {
            Value::Array(values.into_iter().map(learner_media_config).collect())
        }
        Value::String(value) => Value::String(learner_media_url(&value)),
        value => value,
    }
}

/// Keep real catalog identities and authored visual configuration; only the
/// managed media transport URL changes. Delivery separately checks ownership.
pub fn learner_item(mut item: LearnerItem) -> LearnerItem {
    item.image_dark = item.image_dark.as_deref().map(learner_media_url);
    item.image_light = item.image_light.as_deref().map(learner_media_url);
    item.config = learner_media_config(item.config);
    item
}

pub fn learner_tool(mut tool: LearnerTool) -> LearnerTool {
    tool.image_dark = tool.image_dark.as_deref().map(learner_media_url);
    tool.image_light = tool.image_light.as_deref().map(learner_media_url);
    tool.animation_dark = tool.animation_dark.as_deref().map(learner_media_url);
    tool.animation_light = tool.animation_light.as_deref().map(learner_media_url);
    tool.config = learner_media_config(tool.config);
    tool
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use uuid::Uuid;

    use super::{
        LearnerItem, LearnerTool, learner_item, learner_media_config, learner_media_url,
        learner_tool,
    };

    #[test]
    fn inventory_projection_preserves_identity_nulls_and_authored_non_media_values() {
        let id = Uuid::new_v4();
        let media = Uuid::new_v4();
        let managed = format!("/api/v1/admin/media-assets/{media}/content");
        let delivered = format!("/api/v1/learner/media-assets/{media}/content");
        let item = learner_item(LearnerItem {
            id,
            slug: "item".into(),
            title: "Item".into(),
            description: None,
            quantity: 2,
            image_dark: Some(managed.clone()),
            image_light: None,
            config: json!({"imageWidthPercent": 18, "enabled": false}),
        });
        assert_eq!(item.id, id);
        assert_eq!(item.quantity, 2);
        assert_eq!(item.image_dark.as_deref(), Some(delivered.as_str()));
        assert!(item.image_light.is_none());
        assert_eq!(
            item.config,
            json!({"imageWidthPercent": 18, "enabled": false})
        );
        let tool = learner_tool(LearnerTool {
            id,
            slug: "tool".into(),
            title: "Tool".into(),
            description: None,
            image_dark: Some("/authored/static.svg".into()),
            image_light: None,
            animation_dark: Some(managed.clone()),
            animation_light: Some(managed),
            config: json!({"animationDurationSeconds": 0.8, "animationWidthPercent": 40}),
        });
        assert_eq!(tool.id, id);
        assert_eq!(tool.image_dark.as_deref(), Some("/authored/static.svg"));
        assert!(tool.image_light.is_none());
        assert_eq!(tool.animation_dark.as_deref(), Some(delivered.as_str()));
        assert_eq!(tool.animation_light, tool.animation_dark);
        assert_eq!(
            tool.config,
            json!({"animationDurationSeconds": 0.8, "animationWidthPercent": 40})
        );
    }

    #[test]
    fn projects_only_managed_author_media_urls_for_learners() {
        let media = Uuid::new_v4();
        let author_url = format!("/api/v1/admin/media-assets/{media}/content");
        let learner_url = format!("/api/v1/learner/media-assets/{media}/content");

        assert_eq!(learner_media_url(&author_url), learner_url);
        assert_eq!(
            learner_media_config(json!({"states": [{"imageUrl": author_url}]})),
            json!({"states": [{"imageUrl": learner_url}]}),
        );
        assert_eq!(
            learner_media_url("/api/v1/admin/media-assets/not-a-uuid/content"),
            "/api/v1/admin/media-assets/not-a-uuid/content",
        );
    }
}
