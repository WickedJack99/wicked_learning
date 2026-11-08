use serde_json::Value;
use uuid::Uuid;

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

#[cfg(test)]
mod tests {
    use serde_json::json;
    use uuid::Uuid;

    use super::{learner_media_config, learner_media_url};

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
