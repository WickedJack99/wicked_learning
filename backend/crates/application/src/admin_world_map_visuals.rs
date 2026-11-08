use std::future::Future;

use serde_json::{Map, Value};
use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

const COLOR_FIELDS: &[&str] = &[
    "accentColor",
    "overlay",
    "pageBackground",
    "panelBackground",
    "panelBorderColor",
    "panelMutedTextColor",
    "panelTextColor",
    "sideControlActiveBackground",
    "sideControlActiveIconColor",
    "sideControlActiveTextColor",
    "sideControlBackground",
    "sideControlBorderColor",
    "sideControlIconColor",
    "sideControlTextColor",
    "sidePanelBackground",
    "sidePanelBorderColor",
    "sidePanelHeadingColor",
    "sidePanelMutedTextColor",
    "sidePanelTextColor",
];

#[derive(Clone, Debug, PartialEq)]
pub struct UpdateWorldMapVisualsForm {
    pub background_config: Value,
}

impl UpdateWorldMapVisualsForm {
    /// Retains only the source form's editable fields. Unknown JSON is ignored
    /// exactly as Laravel's validated payload omits unrecognised input, while
    /// the persistence merger preserves existing configuration outside this
    /// writer's vocabulary.
    pub fn parse(background_config: Value) -> Option<Self> {
        let config = background_config.as_object()?;
        let mut normalized = Map::new();

        for mode in ["dark", "light"] {
            let Some(mode_config) = config.get(mode) else {
                continue;
            };
            let mode_config = mode_config.as_object()?;
            let mut mode_normalized = Map::new();

            for field in COLOR_FIELDS {
                if let Some(value) = mode_config.get(*field) {
                    if !nullable_string(value, 255) {
                        return None;
                    }
                    mode_normalized.insert((*field).to_owned(), value.clone());
                }
            }
            if let Some(value) = mode_config.get("imageUrl") {
                if !nullable_string(value, 2_048) {
                    return None;
                }
                mode_normalized.insert("imageUrl".to_owned(), value.clone());
            }
            if let Some(value) = mode_config.get("completedDimOpacity") {
                if !nullable_number(value, 0.0, 100.0) {
                    return None;
                }
                mode_normalized.insert("completedDimOpacity".to_owned(), value.clone());
            }
            if let Some(value) = mode_config.get("assets") {
                let assets = value.as_array()?;
                let mut normalized_assets = Vec::with_capacity(assets.len());
                for asset in assets {
                    let asset = asset.as_object()?;
                    let mut normalized_asset = Map::new();
                    for (field, maximum) in [("id", 80), ("imageUrl", 2_048)] {
                        if let Some(value) = asset.get(field) {
                            if !nullable_string(value, maximum) {
                                return None;
                            }
                            normalized_asset.insert(field.to_owned(), value.clone());
                        }
                    }
                    for (field, minimum, maximum) in [
                        ("x", 0.0, 100.0),
                        ("y", 0.0, 100.0),
                        ("width", 1.0, 200.0),
                        ("opacity", 0.0, 100.0),
                    ] {
                        if let Some(value) = asset.get(field) {
                            if !nullable_number(value, minimum, maximum) {
                                return None;
                            }
                            normalized_asset.insert(field.to_owned(), value.clone());
                        }
                    }
                    normalized_assets.push(Value::Object(normalized_asset));
                }
                mode_normalized.insert("assets".to_owned(), Value::Array(normalized_assets));
            }

            normalized.insert(mode.to_owned(), Value::Object(mode_normalized));
        }

        Some(Self {
            background_config: Value::Object(normalized),
        })
    }
}

fn nullable_string(value: &Value, maximum: usize) -> bool {
    value.is_null()
        || value
            .as_str()
            .is_some_and(|value| value.chars().count() <= maximum)
}

fn nullable_number(value: &Value, minimum: f64, maximum: f64) -> bool {
    value.is_null()
        || value
            .as_f64()
            .is_some_and(|value| value.is_finite() && (minimum..=maximum).contains(&value))
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldMapVisualsError {
    Unavailable,
}

pub trait AdminWorldMapVisualsRepository {
    fn update_map_visuals(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &UpdateWorldMapVisualsForm,
    ) -> impl Future<Output = Result<Option<Value>, AdminWorldMapVisualsError>> + Send;
}

pub struct AdminWorldMapVisualsCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldMapVisualsCommand<'repository, Repository>
where
    Repository: AdminWorldMapVisualsRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &UpdateWorldMapVisualsForm,
    ) -> Result<Option<Value>, AdminWorldMapVisualsError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(None);
        }

        self.repository
            .update_map_visuals(principal, map_id, form)
            .await
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

    use serde_json::json;
    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::{
        AdminWorldMapVisualsCommand, AdminWorldMapVisualsError, AdminWorldMapVisualsRepository,
        UpdateWorldMapVisualsForm,
    };

    struct RecordingRepository(Arc<AtomicBool>);

    impl AdminWorldMapVisualsRepository for RecordingRepository {
        fn update_map_visuals(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
            _: &UpdateWorldMapVisualsForm,
        ) -> impl Future<Output = Result<Option<serde_json::Value>, AdminWorldMapVisualsError>> + Send
        {
            self.0.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[test]
    fn preserves_the_source_map_visual_bounds_and_ignores_unknown_configuration() {
        let form = UpdateWorldMapVisualsForm::parse(json!({
            "dark": {
                "accentColor": "#14b8a6",
                "completedDimOpacity": 18,
                "imageUrl": "/images/map.png",
                "assets": [{"id": "clouds", "imageUrl": "/images/clouds.png", "x": 50, "y": 40, "width": 120, "opacity": 60}],
                "unexpected": "not persisted"
            },
            "unknownMode": {"accentColor": "#fff"}
        }))
        .expect("source-shaped visual configuration");

        assert_eq!(form.background_config["dark"]["accentColor"], "#14b8a6");
        assert!(form.background_config.get("unknownMode").is_none());
        assert!(form.background_config["dark"].get("unexpected").is_none());
        assert!(
            UpdateWorldMapVisualsForm::parse(json!({
                "light": {"assets": [{"width": 201}]}
            }))
            .is_none()
        );
    }

    #[tokio::test]
    async fn requires_scoped_map_update_permission_before_writing_visuals() {
        let called = Arc::new(AtomicBool::new(false));
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:r:all".to_owned()],
        };
        let form = UpdateWorldMapVisualsForm::parse(json!({"dark": {}}))
            .expect("empty source mode is valid");

        let result = AdminWorldMapVisualsCommand::new(&RecordingRepository(called.clone()))
            .execute(&principal, Uuid::new_v4(), &form)
            .await
            .expect("authorization check");

        assert!(result.is_none());
        assert!(!called.load(Ordering::SeqCst));
    }
}
