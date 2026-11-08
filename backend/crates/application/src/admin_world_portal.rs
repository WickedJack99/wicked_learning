use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

pub const MAX_PORTAL_ASSETS: usize = 20;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PortalMode {
    Input,
    Output,
}

impl PortalMode {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "input" => Some(Self::Input),
            "output" => Some(Self::Output),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Input => "input",
            Self::Output => "output",
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct PortalAssetForm {
    pub id: String,
    pub image_dark: String,
    pub image_light: String,
    pub label: String,
    pub layer: String,
    pub mirrored: bool,
    pub opacity: f64,
    pub width: f64,
    pub x: f64,
    pub y: f64,
}

impl PortalAssetForm {
    #[allow(clippy::too_many_arguments)]
    pub fn parse(
        id: &str,
        image_dark: &str,
        image_light: &str,
        label: &str,
        layer: &str,
        mirrored: bool,
        opacity: f64,
        width: f64,
        x: f64,
        y: f64,
    ) -> Option<Self> {
        let id = id.trim();
        let label = label.trim();
        let image_dark = image_dark.trim();
        let image_light = image_light.trim();
        let allowed_layer = matches!(
            layer,
            "behind-background" | "above-background" | "above-foreground" | "front"
        );
        (id.len() <= 120
            && label.len() <= 120
            && image_dark.len() <= 2048
            && image_light.len() <= 2048
            && allowed_layer
            && opacity.is_finite()
            && (0.0..=100.0).contains(&opacity)
            && width.is_finite()
            && (1.0..=160.0).contains(&width)
            && x.is_finite()
            && (0.0..=100.0).contains(&x)
            && y.is_finite()
            && (0.0..=100.0).contains(&y))
        .then(|| Self {
            id: id.to_owned(),
            image_dark: image_dark.to_owned(),
            image_light: image_light.to_owned(),
            label: label.to_owned(),
            layer: layer.to_owned(),
            mirrored,
            opacity,
            width,
            x,
            y,
        })
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct PortalActivityForm {
    pub title: String,
    pub slug: Option<String>,
    pub introduction: Option<String>,
    pub mode: PortalMode,
    pub background_dark: String,
    pub background_light: String,
    pub background_mirrored: bool,
    pub assets: Vec<PortalAssetForm>,
    pub duration_seconds: f64,
    pub foreground_dark: String,
    pub foreground_light: String,
    pub foreground_mirrored: bool,
    pub foreground_width: f64,
    pub foreground_x: f64,
    pub foreground_y: f64,
    pub show_on_arrival: bool,
    pub swirl_enabled: bool,
    pub bubble_text: String,
    pub bubble_typing_speed: f64,
    pub bubble_color_dark: String,
    pub bubble_color_light: String,
    pub bubble_border_color_dark: String,
    pub bubble_border_color_light: String,
    pub bubble_text_color_dark: String,
    pub bubble_text_color_light: String,
    pub wait_for_enter: bool,
    pub target_portal_activity_id: Option<Uuid>,
}

impl PortalActivityForm {
    #[allow(clippy::too_many_arguments)]
    pub fn parse(
        title: &str,
        slug: Option<&str>,
        introduction: Option<&str>,
        mode: PortalMode,
        background_dark: &str,
        background_light: &str,
        background_mirrored: bool,
        assets: Vec<PortalAssetForm>,
        duration_seconds: f64,
        foreground_dark: &str,
        foreground_light: &str,
        foreground_mirrored: bool,
        foreground_width: f64,
        foreground_x: f64,
        foreground_y: f64,
        show_on_arrival: bool,
        swirl_enabled: bool,
        bubble_text: &str,
        bubble_typing_speed: f64,
        bubble_color_dark: &str,
        bubble_color_light: &str,
        bubble_border_color_dark: &str,
        bubble_border_color_light: &str,
        bubble_text_color_dark: &str,
        bubble_text_color_light: &str,
        wait_for_enter: bool,
        target_portal_activity_id: Option<Uuid>,
    ) -> Option<Self> {
        let title = title.trim();
        let slug = slug.map(str::trim).filter(|value| !value.is_empty());
        let introduction = introduction.map(str::to_owned);
        let background_dark = background_dark.trim();
        let background_light = background_light.trim();
        let foreground_dark = foreground_dark.trim();
        let foreground_light = foreground_light.trim();
        let bubble_text = bubble_text.trim();
        let color_fields = [
            bubble_color_dark,
            bubble_color_light,
            bubble_border_color_dark,
            bubble_border_color_light,
            bubble_text_color_dark,
            bubble_text_color_light,
        ];
        let unique_asset_ids = assets
            .iter()
            .filter(|asset| !asset.id.is_empty())
            .map(|asset| &asset.id)
            .collect::<std::collections::HashSet<_>>();
        if title.is_empty()
            || title.chars().count() > 120
            || slug.is_some_and(|value| value.chars().count() > 140 || !valid_slug(value))
            || introduction
                .as_ref()
                .is_some_and(|value| value.chars().count() > 1_000)
            || background_dark.len() > 2048
            || background_light.len() > 2048
            || foreground_dark.len() > 2048
            || foreground_light.len() > 2048
            || assets.len() > MAX_PORTAL_ASSETS
            || unique_asset_ids.len() != assets.iter().filter(|asset| !asset.id.is_empty()).count()
            || !duration_seconds.is_finite()
            || !(0.5..=60.0).contains(&duration_seconds)
            || !foreground_width.is_finite()
            || !(1.0..=100.0).contains(&foreground_width)
            || !foreground_x.is_finite()
            || !(0.0..=100.0).contains(&foreground_x)
            || !foreground_y.is_finite()
            || !(0.0..=100.0).contains(&foreground_y)
            || bubble_text.chars().count() > 2_000
            || !bubble_typing_speed.is_finite()
            || !(1.0..=500.0).contains(&bubble_typing_speed)
            || color_fields.iter().any(|value| value.len() > 64)
        {
            return None;
        }
        Some(Self {
            title: title.to_owned(),
            slug: slug.map(str::to_owned),
            introduction,
            mode,
            background_dark: background_dark.to_owned(),
            background_light: background_light.to_owned(),
            background_mirrored,
            assets,
            duration_seconds,
            foreground_dark: foreground_dark.to_owned(),
            foreground_light: foreground_light.to_owned(),
            foreground_mirrored,
            foreground_width,
            foreground_x,
            foreground_y,
            show_on_arrival,
            swirl_enabled,
            bubble_text: bubble_text.to_owned(),
            bubble_typing_speed,
            bubble_color_dark: bubble_color_dark.to_owned(),
            bubble_color_light: bubble_color_light.to_owned(),
            bubble_border_color_dark: bubble_border_color_dark.to_owned(),
            bubble_border_color_light: bubble_border_color_light.to_owned(),
            bubble_text_color_dark: bubble_text_color_dark.to_owned(),
            bubble_text_color_light: bubble_text_color_light.to_owned(),
            wait_for_enter,
            target_portal_activity_id: (mode == PortalMode::Output)
                .then_some(target_portal_activity_id)
                .flatten(),
        })
    }
}

fn valid_slug(value: &str) -> bool {
    value
        .bytes()
        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldPortalError {
    InvalidActivity,
    Conflict,
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdatedPortalActivity {
    pub activity_id: Uuid,
    pub updated_at: String,
}

pub trait AdminWorldPortalRepository {
    fn create_portal(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &PortalActivityForm,
    ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldPortalError>> + Send;

    fn update_portal(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &PortalActivityForm,
        expected_updated_at: &str,
    ) -> impl Future<Output = Result<Option<UpdatedPortalActivity>, AdminWorldPortalError>> + Send;
}

pub struct AdminWorldPortalCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: AdminWorldPortalRepository>
    AdminWorldPortalCommand<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &PortalActivityForm,
    ) -> Result<Option<Uuid>, AdminWorldPortalError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .create_portal(principal, node_id, form)
            .await
    }

    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &PortalActivityForm,
        expected_updated_at: &str,
    ) -> Result<Option<UpdatedPortalActivity>, AdminWorldPortalError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .update_portal(principal, activity_id, form, expected_updated_at)
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

    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::{
        AdminWorldPortalCommand, AdminWorldPortalError, AdminWorldPortalRepository,
        PortalActivityForm, PortalMode, UpdatedPortalActivity,
    };

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldPortalRepository for RecordingRepository {
        fn create_portal(
            &self,
            _principal: &AuthorizedPrincipal,
            _node_id: Uuid,
            _form: &PortalActivityForm,
        ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldPortalError>> + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn update_portal(
            &self,
            _principal: &AuthorizedPrincipal,
            _activity_id: Uuid,
            _form: &PortalActivityForm,
            _expected_updated_at: &str,
        ) -> impl Future<Output = Result<Option<UpdatedPortalActivity>, AdminWorldPortalError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    fn form() -> PortalActivityForm {
        PortalActivityForm::parse(
            "Enter the archive",
            None,
            None,
            PortalMode::Output,
            "",
            "",
            false,
            vec![],
            1.5,
            "",
            "",
            false,
            28.0,
            50.0,
            50.0,
            true,
            true,
            "",
            24.0,
            "#0f172a",
            "#ffffff",
            "#2dd4bf",
            "#0891b2",
            "#f8fafc",
            "#0f172a",
            false,
            None,
        )
        .expect("source defaults are valid")
    }

    #[test]
    fn preserves_source_portal_bounds_and_defaults() {
        assert_eq!(form().mode, PortalMode::Output);
        assert!(
            PortalActivityForm::parse(
                "Portal",
                None,
                None,
                PortalMode::Output,
                "",
                "",
                false,
                vec![],
                0.49,
                "",
                "",
                false,
                28.0,
                50.0,
                50.0,
                true,
                true,
                "",
                24.0,
                "#0f172a",
                "#ffffff",
                "#2dd4bf",
                "#0891b2",
                "#f8fafc",
                "#0f172a",
                false,
                None,
            )
            .is_none()
        );
    }

    #[tokio::test]
    async fn requires_world_activity_update_before_writing() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec![],
        };
        let result = AdminWorldPortalCommand::new(&repository)
            .create(&principal, Uuid::new_v4(), &form())
            .await
            .expect("authorization check succeeds");
        assert_eq!(result, None);
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
