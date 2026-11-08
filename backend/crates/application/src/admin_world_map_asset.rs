use std::future::Future;

use serde_json::Value;
use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Debug, PartialEq)]
pub struct WorldMapAssetForm {
    pub image_url: Option<String>,
    pub text: Option<String>,
    pub position_x: f64,
    pub position_y: f64,
    pub position_z: i32,
    pub width: f64,
    pub opacity: f64,
    pub locked: bool,
    pub interaction_mode: String,
    pub interaction_config: Value,
    pub visual_config: Value,
    pub sound_config: Value,
}

impl WorldMapAssetForm {
    #[allow(clippy::too_many_arguments)]
    pub fn parse(
        image_url: Option<&str>,
        text: Option<&str>,
        position_x: f64,
        position_y: f64,
        position_z: i32,
        width: f64,
        opacity: f64,
        locked: bool,
        interaction_mode: &str,
        interaction_config: Value,
        visual_config: Value,
        sound_config: Value,
    ) -> Option<Self> {
        let image_url = bounded_optional(image_url, 2_048)?;
        let text = bounded_optional(text, 255)?;
        if !position_x.is_finite()
            || !(0.0..=100.0).contains(&position_x)
            || !position_y.is_finite()
            || !(0.0..=100.0).contains(&position_y)
            || !(-10_000..=10_000).contains(&position_z)
            || !width.is_finite()
            || !(1.0..=100.0).contains(&width)
            || !opacity.is_finite()
            || !(0.0..=1.0).contains(&opacity)
            || !matches!(
                interaction_mode,
                "focusable" | "decorative" | "hide_on_hover" | "toggle"
            )
            || !interaction_config.is_object()
            || !visual_config.is_object()
            || !sound_config.is_object()
        {
            return None;
        }
        if interaction_mode == "toggle" && !valid_toggle_states(&interaction_config) {
            return None;
        }
        if !valid_interaction_sounds(&visual_config) {
            return None;
        }

        Some(Self {
            image_url,
            text,
            position_x,
            position_y,
            position_z,
            width,
            opacity,
            locked,
            interaction_mode: interaction_mode.to_owned(),
            interaction_config,
            visual_config,
            sound_config,
        })
    }
}

/// The source MapAsset editor has exactly four optional interaction effects.
/// Their selected UUID is an authoring reference, never a browser-provided
/// media URL. Persistence resolves it only after the map writer is authorized.
fn valid_interaction_sounds(config: &Value) -> bool {
    let Some(config) = config.as_object() else {
        return false;
    };
    let Some(sounds) = config.get("sounds") else {
        return true;
    };
    let Some(sounds) = sounds.as_object() else {
        return false;
    };
    if sounds.keys().any(|key| {
        !matches!(
            key.as_str(),
            "mouseEnter" | "click" | "mouseLeave" | "unlock"
        )
    }) {
        return false;
    }
    sounds.values().all(|sound| {
        let Some(sound) = sound.as_object() else {
            return false;
        };
        if sound
            .keys()
            .any(|key| !matches!(key.as_str(), "enabled" | "soundId"))
            || !sound.get("enabled").is_some_and(Value::is_boolean)
        {
            return false;
        }
        sound.get("soundId").is_none_or(|value| {
            value.is_null()
                || value
                    .as_str()
                    .is_some_and(|value| Uuid::parse_str(value).is_ok())
        })
    })
}

fn bounded_optional(value: Option<&str>, maximum: usize) -> Option<Option<String>> {
    let value = value.map(str::trim).filter(|value| !value.is_empty());
    let Some(value) = value else {
        return Some(None);
    };
    (value.chars().count() <= maximum).then(|| Some(value.to_owned()))
}

fn valid_toggle_states(config: &Value) -> bool {
    ["first", "second"].into_iter().all(|state| {
        let Some(value) = config
            .get("states")
            .and_then(Value::as_object)
            .and_then(|states| states.get(state))
            .and_then(Value::as_object)
        else {
            return false;
        };
        let image_url = value.get("imageUrl");
        let image_is_valid = image_url.is_none_or(|value| {
            value.is_null()
                || value
                    .as_str()
                    .is_some_and(|url| url.chars().count() <= 2_048)
        });
        let x = value.get("x").and_then(Value::as_f64);
        let y = value.get("y").and_then(Value::as_f64);
        let width = value.get("width").and_then(Value::as_f64);
        image_is_valid
            && x.is_some_and(|value| value.is_finite() && (0.0..=100.0).contains(&value))
            && y.is_some_and(|value| value.is_finite() && (0.0..=100.0).contains(&value))
            && width.is_some_and(|value| value.is_finite() && (1.0..=100.0).contains(&value))
    })
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldMapAssetError {
    Unavailable,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CreatedWorldMapAsset {
    pub asset_id: Uuid,
    pub node_id: Uuid,
}

pub trait AdminWorldMapAssetRepository {
    fn create_map_asset(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &WorldMapAssetForm,
    ) -> impl Future<Output = Result<Option<CreatedWorldMapAsset>, AdminWorldMapAssetError>> + Send;

    fn update_map_asset(
        &self,
        principal: &AuthorizedPrincipal,
        asset_id: Uuid,
        form: &WorldMapAssetForm,
    ) -> impl Future<Output = Result<bool, AdminWorldMapAssetError>> + Send;

    fn delete_map_asset(
        &self,
        principal: &AuthorizedPrincipal,
        asset_id: Uuid,
    ) -> impl Future<Output = Result<bool, AdminWorldMapAssetError>> + Send;
}

/// The Laravel surface creates a compatibility node when an author adds a
/// MapAsset. Rust preserves that relation only for existing activity editing;
/// the MapAsset remains the authoritative learner-facing record.
pub struct AdminWorldMapAssetCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldMapAssetCommand<'repository, Repository>
where
    Repository: AdminWorldMapAssetRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &WorldMapAssetForm,
    ) -> Result<Option<CreatedWorldMapAsset>, AdminWorldMapAssetError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(None);
        }
        self.repository
            .create_map_asset(principal, map_id, form)
            .await
    }

    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        asset_id: Uuid,
        form: &WorldMapAssetForm,
    ) -> Result<bool, AdminWorldMapAssetError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(false);
        }
        self.repository
            .update_map_asset(principal, asset_id, form)
            .await
    }

    pub async fn delete(
        &self,
        principal: &AuthorizedPrincipal,
        asset_id: Uuid,
    ) -> Result<bool, AdminWorldMapAssetError> {
        if !principal.has_permission("world_maps", "rud") {
            return Ok(false);
        }
        self.repository.delete_map_asset(principal, asset_id).await
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::WorldMapAssetForm;

    fn valid_form(mode: &str) -> Option<WorldMapAssetForm> {
        WorldMapAssetForm::parse(
            None,
            None,
            50.0,
            50.0,
            0,
            14.0,
            1.0,
            false,
            mode,
            json!({"states":{"first":{"imageUrl":null,"x":50,"y":50,"width":14},"second":{"imageUrl":null,"x":50,"y":50,"width":14}}}),
            json!({}),
            json!({}),
        )
    }

    #[test]
    fn preserves_source_map_asset_surface_bounds_and_interaction_modes() {
        assert!(valid_form("focusable").is_some());
        assert!(valid_form("toggle").is_some());
        assert!(
            WorldMapAssetForm::parse(
                None,
                None,
                101.0,
                50.0,
                0,
                14.0,
                1.0,
                false,
                "focusable",
                json!({}),
                json!({}),
                json!({})
            )
            .is_none()
        );
        assert!(
            WorldMapAssetForm::parse(
                None,
                None,
                50.0,
                50.0,
                0,
                14.0,
                1.0,
                false,
                "toggle",
                json!({}),
                json!({}),
                json!({})
            )
            .is_none()
        );
    }

    #[test]
    fn rejects_oversized_source_image_urls_without_rejecting_explicit_nulls() {
        assert!(
            WorldMapAssetForm::parse(
                None,
                None,
                50.0,
                50.0,
                0,
                14.0,
                1.0,
                false,
                "decorative",
                json!({}),
                json!({}),
                json!({})
            )
            .is_some()
        );
        assert!(
            WorldMapAssetForm::parse(
                Some(&"x".repeat(2_049)),
                None,
                50.0,
                50.0,
                0,
                14.0,
                1.0,
                false,
                "decorative",
                json!({}),
                json!({}),
                json!({})
            )
            .is_none()
        );
    }

    #[test]
    fn retains_the_source_visual_configuration() {
        let visual_config = json!({"tileColor": "#0f766e"});
        let form = WorldMapAssetForm::parse(
            None,
            None,
            50.0,
            50.0,
            0,
            14.0,
            1.0,
            false,
            "focusable",
            json!({}),
            visual_config.clone(),
            json!({}),
        )
        .expect("valid source-shaped form");

        assert_eq!(form.visual_config, visual_config);
    }

    #[test]
    fn accepts_only_the_source_interaction_sound_vocabulary() {
        assert!(WorldMapAssetForm::parse(
            None,
            None,
            50.0,
            50.0,
            0,
            14.0,
            1.0,
            false,
            "focusable",
            json!({}),
            json!({"sounds":{"click":{"enabled":true,"soundId":"00000000-0000-4000-8000-000000000001"}}}),
            json!({}),
        )
        .is_some());
        assert!(WorldMapAssetForm::parse(
            None,
            None,
            50.0,
            50.0,
            0,
            14.0,
            1.0,
            false,
            "focusable",
            json!({}),
            json!({"sounds":{"surprise":{"enabled":true,"soundId":"00000000-0000-4000-8000-000000000001"}}}),
            json!({}),
        )
        .is_none());
    }
}
