use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Debug, PartialEq)]
pub struct ToolGrantActivityForm {
    pub title: String,
    pub slug: Option<String>,
    pub introduction: Option<String>,
    pub background_dark: String,
    pub background_light: String,
    pub background_mirrored: bool,
    pub bubble_border_color_dark: String,
    pub bubble_border_color_light: String,
    pub bubble_color_dark: String,
    pub bubble_color_light: String,
    pub bubble_opacity_dark: f64,
    pub bubble_opacity_light: f64,
    pub fade_duration_seconds: f64,
    pub slide_direction: String,
    pub slide_duration_seconds: f64,
    pub text: String,
    pub tool_id: Option<Uuid>,
    pub tool_mirrored: bool,
    pub tool_x: f64,
    pub tool_y: f64,
    pub typing_speed: f64,
}

impl ToolGrantActivityForm {
    #[allow(clippy::too_many_arguments)]
    pub fn parse(
        title: &str,
        slug: Option<&str>,
        introduction: Option<&str>,
        background_dark: Option<&str>,
        background_light: Option<&str>,
        background_mirrored: bool,
        bubble_border_color_dark: Option<&str>,
        bubble_border_color_light: Option<&str>,
        bubble_color_dark: Option<&str>,
        bubble_color_light: Option<&str>,
        bubble_opacity_dark: f64,
        bubble_opacity_light: f64,
        fade_duration_seconds: f64,
        slide_direction: Option<&str>,
        slide_duration_seconds: f64,
        text: Option<&str>,
        tool_id: Option<Uuid>,
        tool_mirrored: bool,
        tool_x: f64,
        tool_y: f64,
        typing_speed: f64,
    ) -> Option<Self> {
        let title = title.trim();
        let slug = slug.map(str::trim).filter(|value| !value.is_empty());
        let colors = [
            bubble_border_color_dark.unwrap_or("#2dd4bf"),
            bubble_border_color_light.unwrap_or("#0891b2"),
            bubble_color_dark.unwrap_or("#0f172a"),
            bubble_color_light.unwrap_or("#ffffff"),
        ];
        let slide_direction = slide_direction.unwrap_or("left");
        if title.is_empty()
            || title.chars().count() > 120
            || slug.is_some_and(|value| value.chars().count() > 140 || !valid_slug(value))
            || introduction.is_some_and(|value| value.chars().count() > 1_000)
            || background_dark.is_some_and(|value| value.chars().count() > 2_048)
            || background_light.is_some_and(|value| value.chars().count() > 2_048)
            || text.is_some_and(|value| value.chars().count() > 2_000)
            || !colors.into_iter().all(valid_hex_color)
            || !matches!(
                slide_direction,
                "left" | "right" | "top" | "bottom" | "none"
            )
            || !bounded(bubble_opacity_dark, 0.0, 100.0)
            || !bounded(bubble_opacity_light, 0.0, 100.0)
            || !bounded(fade_duration_seconds, 0.0, 30.0)
            || !bounded(slide_duration_seconds, 0.0, 30.0)
            || !bounded(tool_x, 0.0, 100.0)
            || !bounded(tool_y, 0.0, 100.0)
            || !bounded(typing_speed, 1.0, 250.0)
        {
            return None;
        }
        Some(Self {
            title: title.to_owned(),
            slug: slug.map(str::to_owned),
            introduction: introduction.map(str::to_owned),
            background_dark: background_dark.unwrap_or_default().to_owned(),
            background_light: background_light.unwrap_or_default().to_owned(),
            background_mirrored,
            bubble_border_color_dark: colors[0].to_owned(),
            bubble_border_color_light: colors[1].to_owned(),
            bubble_color_dark: colors[2].to_owned(),
            bubble_color_light: colors[3].to_owned(),
            bubble_opacity_dark,
            bubble_opacity_light,
            fade_duration_seconds,
            slide_direction: slide_direction.to_owned(),
            slide_duration_seconds,
            text: text.unwrap_or_default().to_owned(),
            tool_id,
            tool_mirrored,
            tool_x,
            tool_y,
            typing_speed,
        })
    }
}

fn valid_slug(value: &str) -> bool {
    value
        .bytes()
        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}
fn valid_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value.bytes().skip(1).all(|byte| byte.is_ascii_hexdigit())
}
fn bounded(value: f64, minimum: f64, maximum: f64) -> bool {
    value.is_finite() && (minimum..=maximum).contains(&value)
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldToolGrantError {
    InvalidActivity,
    Conflict,
    Unavailable,
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdatedToolGrantActivity {
    pub activity_id: Uuid,
    pub updated_at: String,
}

pub trait AdminWorldToolGrantRepository {
    fn create_tool_grant(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &ToolGrantActivityForm,
    ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldToolGrantError>> + Send;
    fn update_tool_grant(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &ToolGrantActivityForm,
        expected_updated_at: &str,
    ) -> impl Future<Output = Result<Option<UpdatedToolGrantActivity>, AdminWorldToolGrantError>> + Send;
}

pub struct AdminWorldToolGrantCommand<'repository, Repository> {
    repository: &'repository Repository,
}
impl<'repository, Repository> AdminWorldToolGrantCommand<'repository, Repository>
where
    Repository: AdminWorldToolGrantRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }
    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &ToolGrantActivityForm,
    ) -> Result<Option<Uuid>, AdminWorldToolGrantError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .create_tool_grant(principal, node_id, form)
            .await
    }
    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &ToolGrantActivityForm,
        expected_updated_at: &str,
    ) -> Result<Option<UpdatedToolGrantActivity>, AdminWorldToolGrantError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .update_tool_grant(principal, activity_id, form, expected_updated_at)
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
        AdminWorldToolGrantCommand, AdminWorldToolGrantError, AdminWorldToolGrantRepository,
        ToolGrantActivityForm, UpdatedToolGrantActivity,
    };

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldToolGrantRepository for RecordingRepository {
        fn create_tool_grant(
            &self,
            _principal: &AuthorizedPrincipal,
            _node_id: Uuid,
            _form: &ToolGrantActivityForm,
        ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldToolGrantError>> + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn update_tool_grant(
            &self,
            _principal: &AuthorizedPrincipal,
            _activity_id: Uuid,
            _form: &ToolGrantActivityForm,
            _expected_updated_at: &str,
        ) -> impl Future<
            Output = Result<Option<UpdatedToolGrantActivity>, AdminWorldToolGrantError>,
        > + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    fn valid_form() -> ToolGrantActivityForm {
        ToolGrantActivityForm::parse(
            "Grant", None, None, None, None, false, None, None, None, None, 92.0, 94.0, 0.4, None,
            0.6, None, None, false, 50.0, 50.0, 24.0,
        )
        .expect("source defaults are valid")
    }

    #[test]
    fn preserves_source_defaults_and_visual_bounds() {
        let form = valid_form();
        assert_eq!(form.slide_direction, "left");
        assert_eq!(form.bubble_color_light, "#ffffff");
        assert!(
            ToolGrantActivityForm::parse(
                "Grant",
                None,
                None,
                None,
                None,
                false,
                Some("invalid"),
                None,
                None,
                None,
                92.0,
                94.0,
                0.4,
                None,
                0.6,
                None,
                None,
                false,
                50.0,
                50.0,
                24.0
            )
            .is_none()
        );
    }

    #[tokio::test]
    async fn requires_source_world_activity_update_before_catalog_resolution_or_writing() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_nodes:rud:all".to_owned()],
        };

        let result = AdminWorldToolGrantCommand::new(&repository)
            .create(&principal, Uuid::new_v4(), &valid_form())
            .await
            .expect("authorization check succeeds");

        assert_eq!(result, None);
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
