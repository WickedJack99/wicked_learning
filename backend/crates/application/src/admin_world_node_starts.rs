use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, world_content::AdminActivityStartRoute,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldNodeStartsError {
    InvalidActivity,
    Unavailable,
}

#[derive(Clone, Debug)]
pub struct AdminWorldNodeStarts {
    pub start_activity_id: Option<Uuid>,
    pub start_routes: Vec<AdminActivityStartRoute>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StartRouteForm {
    pub label: Option<String>,
    pub description: Option<String>,
    pub image_dark: Option<String>,
    pub image_light: Option<String>,
    pub button_color_dark: Option<String>,
    pub button_border_color_dark: Option<String>,
    pub button_color_light: Option<String>,
    pub button_border_color_light: Option<String>,
}

impl StartRouteForm {
    #[allow(clippy::too_many_arguments)]
    pub fn parse(
        label: Option<&str>,
        description: Option<&str>,
        image_dark: Option<&str>,
        image_light: Option<&str>,
        button_color_dark: Option<&str>,
        button_border_color_dark: Option<&str>,
        button_color_light: Option<&str>,
        button_border_color_light: Option<&str>,
    ) -> Option<Self> {
        if label.is_some_and(|value| value.chars().count() > 120)
            || description.is_some_and(|value| value.chars().count() > 600)
            || image_dark.is_some_and(|value| value.chars().count() > 2_048)
            || image_light.is_some_and(|value| value.chars().count() > 2_048)
            || !valid_color(button_color_dark)
            || !valid_color(button_border_color_dark)
            || !valid_color(button_color_light)
            || !valid_color(button_border_color_light)
        {
            return None;
        }

        Some(Self {
            label: label.map(str::to_owned),
            description: description.map(str::to_owned),
            image_dark: image_dark.map(str::to_owned),
            image_light: image_light.map(str::to_owned),
            button_color_dark: button_color_dark.map(str::to_owned),
            button_border_color_dark: button_border_color_dark.map(str::to_owned),
            button_color_light: button_color_light.map(str::to_owned),
            button_border_color_light: button_border_color_light.map(str::to_owned),
        })
    }
}

fn valid_color(value: Option<&str>) -> bool {
    value.is_none_or(|value| {
        value.len() == 7
            && value.starts_with('#')
            && value.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)
    })
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StartRouteDirection {
    Up,
    Down,
}

impl StartRouteDirection {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "up" => Some(Self::Up),
            "down" => Some(Self::Down),
            _ => None,
        }
    }
}

/// Persists the source activity editor's route-start membership. A route start
/// is an authoring choice at the node boundary, not an activity position or a
/// learner-progress mutation.
pub trait AdminWorldNodeStartsRepository {
    fn add_start(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        activity_id: Uuid,
    ) -> impl Future<Output = Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError>> + Send;

    fn remove_starts(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        activity_id: Option<Uuid>,
    ) -> impl Future<Output = Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError>> + Send;

    fn update_start(
        &self,
        principal: &AuthorizedPrincipal,
        start_route_id: Uuid,
        form: &StartRouteForm,
    ) -> impl Future<Output = Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError>> + Send;

    fn reorder_start(
        &self,
        principal: &AuthorizedPrincipal,
        start_route_id: Uuid,
        direction: StartRouteDirection,
    ) -> impl Future<Output = Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError>> + Send;

    fn delete_start(
        &self,
        principal: &AuthorizedPrincipal,
        start_route_id: Uuid,
    ) -> impl Future<Output = Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError>> + Send;
}

pub struct AdminWorldNodeStartsCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldNodeStartsCommand<'repository, Repository>
where
    Repository: AdminWorldNodeStartsRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn add_start(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        activity_id: Uuid,
    ) -> Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }

        self.repository
            .add_start(principal, node_id, activity_id)
            .await
    }

    pub async fn remove_starts(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        activity_id: Option<Uuid>,
    ) -> Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }

        self.repository
            .remove_starts(principal, node_id, activity_id)
            .await
    }

    pub async fn update_start(
        &self,
        principal: &AuthorizedPrincipal,
        start_route_id: Uuid,
        form: &StartRouteForm,
    ) -> Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }

        self.repository
            .update_start(principal, start_route_id, form)
            .await
    }

    pub async fn reorder_start(
        &self,
        principal: &AuthorizedPrincipal,
        start_route_id: Uuid,
        direction: StartRouteDirection,
    ) -> Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }

        self.repository
            .reorder_start(principal, start_route_id, direction)
            .await
    }

    pub async fn delete_start(
        &self,
        principal: &AuthorizedPrincipal,
        start_route_id: Uuid,
    ) -> Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }

        self.repository
            .delete_start(principal, start_route_id)
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
        AdminWorldNodeStarts, AdminWorldNodeStartsCommand, AdminWorldNodeStartsError,
        AdminWorldNodeStartsRepository,
    };

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldNodeStartsRepository for RecordingRepository {
        fn add_start(
            &self,
            _principal: &AuthorizedPrincipal,
            _node_id: Uuid,
            _activity_id: Uuid,
        ) -> impl Future<Output = Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn remove_starts(
            &self,
            _principal: &AuthorizedPrincipal,
            _node_id: Uuid,
            _activity_id: Option<Uuid>,
        ) -> impl Future<Output = Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn update_start(
            &self,
            _principal: &AuthorizedPrincipal,
            _start_route_id: Uuid,
            _form: &super::StartRouteForm,
        ) -> impl Future<Output = Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn reorder_start(
            &self,
            _principal: &AuthorizedPrincipal,
            _start_route_id: Uuid,
            _direction: super::StartRouteDirection,
        ) -> impl Future<Output = Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn delete_start(
            &self,
            _principal: &AuthorizedPrincipal,
            _start_route_id: Uuid,
        ) -> impl Future<Output = Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn requires_activity_update_before_changing_start_routes() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_nodes:rud:all".to_owned()],
        };

        let result = AdminWorldNodeStartsCommand::new(&repository)
            .add_start(&principal, Uuid::new_v4(), Uuid::new_v4())
            .await
            .expect("authorization check succeeds");

        assert!(result.is_none());
        assert!(!repository.called.load(Ordering::SeqCst));
    }

    #[test]
    fn start_route_form_keeps_the_source_bounds_and_hex_colors() {
        let form = super::StartRouteForm::parse(
            Some("Route label"),
            Some("A learner-facing route."),
            None,
            None,
            Some("#aBc123"),
            Some("#000000"),
            Some("#FFFFFF"),
            None,
        );
        assert!(form.is_some());
        assert!(
            super::StartRouteForm::parse(
                Some(&"x".repeat(121)),
                None,
                None,
                None,
                None,
                None,
                None,
                None,
            )
            .is_none()
        );
        assert!(
            super::StartRouteForm::parse(None, None, None, None, Some("blue"), None, None, None,)
                .is_none()
        );
    }
}
