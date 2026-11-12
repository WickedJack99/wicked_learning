use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Debug, PartialEq)]
pub struct ObstacleActivityForm {
    pub graph_position_x: Option<i32>,
    pub graph_position_y: Option<i32>,
    pub title: String,
    pub slug: Option<String>,
    pub introduction: Option<String>,
    pub allowed_tool_ids: Vec<Uuid>,
    pub background_dark: String,
    pub background_light: String,
    pub background_mirrored: bool,
    pub bubble_border_color_dark: String,
    pub bubble_border_color_light: String,
    pub bubble_color_dark: String,
    pub bubble_color_light: String,
    pub bubble_opacity_dark: f64,
    pub bubble_opacity_light: f64,
    pub obstacle_image_dark: String,
    pub obstacle_image_light: String,
    pub obstacle_image_mirrored: bool,
    pub persist_after_solved: bool,
    pub prompt_text: String,
    pub obstacle_x: f64,
    pub obstacle_y: f64,
    pub obstacle_width: f64,
    pub revisit_background_dark: String,
    pub revisit_background_light: String,
    pub revisit_background_mirrored: bool,
    pub revisit_image_dark: String,
    pub revisit_image_light: String,
    pub revisit_image_mirrored: bool,
    pub revisit_text: String,
    pub success_animation: String,
    pub success_text: String,
    pub typing_speed: f64,
}

impl ObstacleActivityForm {
    #[allow(clippy::too_many_arguments)]
    pub fn parse(
        title: &str,
        slug: Option<&str>,
        introduction: Option<&str>,
        allowed_tool_ids: Vec<Uuid>,
        background_dark: Option<&str>,
        background_light: Option<&str>,
        background_mirrored: bool,
        bubble_border_color_dark: Option<&str>,
        bubble_border_color_light: Option<&str>,
        bubble_color_dark: Option<&str>,
        bubble_color_light: Option<&str>,
        bubble_opacity_dark: f64,
        bubble_opacity_light: f64,
        obstacle_image_dark: Option<&str>,
        obstacle_image_light: Option<&str>,
        obstacle_image_mirrored: bool,
        persist_after_solved: bool,
        prompt_text: Option<&str>,
        obstacle_x: f64,
        obstacle_y: f64,
        obstacle_width: f64,
        revisit_background_dark: Option<&str>,
        revisit_background_light: Option<&str>,
        revisit_background_mirrored: bool,
        revisit_image_dark: Option<&str>,
        revisit_image_light: Option<&str>,
        revisit_image_mirrored: bool,
        revisit_text: Option<&str>,
        success_animation: Option<&str>,
        success_text: Option<&str>,
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
        let success_animation = success_animation.unwrap_or("zoom");
        if title.is_empty()
            || title.chars().count() > 120
            || slug.is_some_and(|value| value.chars().count() > 140 || !valid_slug(value))
            || introduction.is_some_and(|value| value.chars().count() > 1_000)
            || [
                background_dark,
                background_light,
                obstacle_image_dark,
                obstacle_image_light,
                revisit_background_dark,
                revisit_background_light,
                revisit_image_dark,
                revisit_image_light,
            ]
            .into_iter()
            .flatten()
            .any(|value| value.chars().count() > 2_048)
            || [prompt_text, revisit_text, success_text]
                .into_iter()
                .flatten()
                .any(|value| value.chars().count() > 2_000)
            || !colors.into_iter().all(valid_hex_color)
            || !matches!(success_animation, "none" | "zoom" | "shake" | "rotate")
            || !bounded(bubble_opacity_dark, 0.0, 100.0)
            || !bounded(bubble_opacity_light, 0.0, 100.0)
            || !bounded(obstacle_x, 0.0, 100.0)
            || !bounded(obstacle_y, 0.0, 100.0)
            || !bounded(obstacle_width, 1.0, 100.0)
            || !bounded(typing_speed, 1.0, 250.0)
            || allowed_tool_ids.len() > 100
        {
            return None;
        }
        let mut distinct_tools = Vec::with_capacity(allowed_tool_ids.len());
        for tool_id in allowed_tool_ids {
            if !distinct_tools.contains(&tool_id) {
                distinct_tools.push(tool_id);
            }
        }
        Some(Self {
            graph_position_x: None,
            graph_position_y: None,
            title: title.to_owned(),
            slug: slug.map(str::to_owned),
            introduction: introduction.map(str::to_owned),
            allowed_tool_ids: distinct_tools,
            background_dark: background_dark.unwrap_or_default().to_owned(),
            background_light: background_light.unwrap_or_default().to_owned(),
            background_mirrored,
            bubble_border_color_dark: colors[0].to_owned(),
            bubble_border_color_light: colors[1].to_owned(),
            bubble_color_dark: colors[2].to_owned(),
            bubble_color_light: colors[3].to_owned(),
            bubble_opacity_dark,
            bubble_opacity_light,
            obstacle_image_dark: obstacle_image_dark.unwrap_or_default().to_owned(),
            obstacle_image_light: obstacle_image_light.unwrap_or_default().to_owned(),
            obstacle_image_mirrored,
            persist_after_solved,
            prompt_text: prompt_text.unwrap_or_default().to_owned(),
            obstacle_x,
            obstacle_y,
            obstacle_width,
            revisit_background_dark: revisit_background_dark.unwrap_or_default().to_owned(),
            revisit_background_light: revisit_background_light.unwrap_or_default().to_owned(),
            revisit_background_mirrored,
            revisit_image_dark: revisit_image_dark.unwrap_or_default().to_owned(),
            revisit_image_light: revisit_image_light.unwrap_or_default().to_owned(),
            revisit_image_mirrored,
            revisit_text: revisit_text.unwrap_or_default().to_owned(),
            success_animation: success_animation.to_owned(),
            success_text: success_text.unwrap_or_default().to_owned(),
            typing_speed,
        })
    }

    /// The source Content API may place a newly created graph card directly.
    /// The World Builder's create route leaves both coordinates absent and
    /// continues to use its separate graph-position command.
    pub fn with_graph_position(mut self, x: Option<i32>, y: Option<i32>) -> Self {
        self.graph_position_x = x;
        self.graph_position_y = y;
        self
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
pub enum AdminWorldObstacleError {
    InvalidActivity,
    Conflict,
    Unavailable,
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdatedObstacleActivity {
    pub activity_id: Uuid,
    pub updated_at: String,
}
#[derive(Clone, Debug, PartialEq)]
pub struct CreatedObstacleActivity {
    pub activity_id: Uuid,
    pub config: serde_json::Value,
    pub slug: String,
}
pub trait AdminWorldObstacleRepository {
    fn create_obstacle(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &ObstacleActivityForm,
    ) -> impl Future<Output = Result<Option<CreatedObstacleActivity>, AdminWorldObstacleError>> + Send;
    fn update_obstacle(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &ObstacleActivityForm,
        expected_updated_at: &str,
    ) -> impl Future<Output = Result<Option<UpdatedObstacleActivity>, AdminWorldObstacleError>> + Send;
}
pub struct AdminWorldObstacleCommand<'repository, Repository> {
    repository: &'repository Repository,
}
impl<'repository, Repository> AdminWorldObstacleCommand<'repository, Repository>
where
    Repository: AdminWorldObstacleRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }
    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &ObstacleActivityForm,
    ) -> Result<Option<CreatedObstacleActivity>, AdminWorldObstacleError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .create_obstacle(principal, node_id, form)
            .await
    }
    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &ObstacleActivityForm,
        expected_updated_at: &str,
    ) -> Result<Option<UpdatedObstacleActivity>, AdminWorldObstacleError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .update_obstacle(principal, activity_id, form, expected_updated_at)
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
        AdminWorldObstacleCommand, AdminWorldObstacleError, AdminWorldObstacleRepository,
        CreatedObstacleActivity, ObstacleActivityForm, UpdatedObstacleActivity,
    };

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldObstacleRepository for RecordingRepository {
        fn create_obstacle(
            &self,
            _principal: &AuthorizedPrincipal,
            _node_id: Uuid,
            _form: &ObstacleActivityForm,
        ) -> impl Future<Output = Result<Option<CreatedObstacleActivity>, AdminWorldObstacleError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn update_obstacle(
            &self,
            _principal: &AuthorizedPrincipal,
            _activity_id: Uuid,
            _form: &ObstacleActivityForm,
            _expected_updated_at: &str,
        ) -> impl Future<Output = Result<Option<UpdatedObstacleActivity>, AdminWorldObstacleError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    fn valid_form() -> ObstacleActivityForm {
        ObstacleActivityForm::parse(
            "Obstacle",
            None,
            None,
            vec![],
            None,
            None,
            false,
            None,
            None,
            None,
            None,
            92.0,
            94.0,
            None,
            None,
            false,
            true,
            None,
            50.0,
            50.0,
            28.0,
            None,
            None,
            false,
            None,
            None,
            false,
            None,
            None,
            None,
            24.0,
        )
        .expect("source defaults are valid")
    }

    #[test]
    fn preserves_source_obstacle_defaults_and_bounds() {
        let form = valid_form();
        assert!(form.persist_after_solved);
        assert_eq!(form.success_animation, "zoom");
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

        let result = AdminWorldObstacleCommand::new(&repository)
            .create(&principal, Uuid::new_v4(), &valid_form())
            .await
            .expect("authorization check succeeds");

        assert_eq!(result, None);
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
