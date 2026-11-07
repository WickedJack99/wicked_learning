use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdateWorldMapDetailsForm {
    pub title: String,
    pub description: String,
    pub topic_id: Option<Uuid>,
    pub map_assets_locked: bool,
}

impl UpdateWorldMapDetailsForm {
    pub fn parse(
        title: &str,
        description: Option<&str>,
        topic_id: Option<Uuid>,
        map_assets_locked: bool,
    ) -> Option<Self> {
        let title = title.trim();
        let description = description.unwrap_or("");
        if title.is_empty() || title.chars().count() > 120 || description.chars().count() > 1_000 {
            return None;
        }

        Some(Self {
            title: title.to_owned(),
            description: description.to_owned(),
            topic_id,
            map_assets_locked,
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldMapDetailsError {
    InvalidTopic,
    Conflict,
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdatedWorldMapDetails {
    pub map_id: Uuid,
    pub updated_at: String,
}

pub trait AdminWorldMapDetailsRepository {
    fn update_map_details(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &UpdateWorldMapDetailsForm,
        expected_updated_at: &str,
    ) -> impl Future<Output = Result<Option<UpdatedWorldMapDetails>, AdminWorldMapDetailsError>> + Send;
}

/// Updates the source Map Details form with its scoped editor access and
/// optimistic-concurrency boundary. Visual configuration and access control
/// retain their distinct source mutations.
pub struct AdminWorldMapDetailsCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldMapDetailsCommand<'repository, Repository>
where
    Repository: AdminWorldMapDetailsRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &UpdateWorldMapDetailsForm,
        expected_updated_at: &str,
    ) -> Result<Option<UpdatedWorldMapDetails>, AdminWorldMapDetailsError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(None);
        }

        self.repository
            .update_map_details(principal, map_id, form, expected_updated_at)
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
        AdminWorldMapDetailsCommand, AdminWorldMapDetailsError, AdminWorldMapDetailsRepository,
        UpdateWorldMapDetailsForm, UpdatedWorldMapDetails,
    };

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldMapDetailsRepository for RecordingRepository {
        fn update_map_details(
            &self,
            _principal: &AuthorizedPrincipal,
            _map_id: Uuid,
            _form: &UpdateWorldMapDetailsForm,
            _expected_updated_at: &str,
        ) -> impl Future<Output = Result<Option<UpdatedWorldMapDetails>, AdminWorldMapDetailsError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[test]
    fn preserves_source_map_detail_bounds_and_nullable_description() {
        assert!(UpdateWorldMapDetailsForm::parse(" A map ", None, None, true).is_some());
        assert!(UpdateWorldMapDetailsForm::parse("", None, None, false).is_none());
        assert!(
            UpdateWorldMapDetailsForm::parse("Map", Some(&"x".repeat(1_001)), None, false)
                .is_none()
        );
    }

    #[tokio::test]
    async fn requires_source_world_map_update_permission_before_updating() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:r:all".to_owned()],
        };
        let form = UpdateWorldMapDetailsForm::parse("A map", None, None, false)
            .expect("a bounded source form is valid");

        let updated = AdminWorldMapDetailsCommand::new(&repository)
            .execute(
                &principal,
                Uuid::new_v4(),
                &form,
                "2026-11-07T17:00:00.000000Z",
            )
            .await
            .expect("authorization check succeeds");

        assert_eq!(updated, None);
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
