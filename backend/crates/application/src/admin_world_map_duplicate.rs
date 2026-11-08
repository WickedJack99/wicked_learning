use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

use crate::admin_world_map_create::{CreateWorldMapForm, generated_map_slug};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminWorldMapDuplicateError;

pub trait AdminWorldMapDuplicateRepository {
    fn duplicate_map(
        &self,
        principal: &AuthorizedPrincipal,
        source_map_id: Uuid,
        form: &CreateWorldMapForm,
    ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldMapDuplicateError>> + Send;
}

/// Duplicating is a map edit, rather than map creation: an assigned editor may
/// make a copy of the map they can edit without gaining authoring access to
/// unrelated maps.
pub struct AdminWorldMapDuplicateCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldMapDuplicateCommand<'repository, Repository>
where
    Repository: AdminWorldMapDuplicateRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        source_map_id: Uuid,
        form: &CreateWorldMapForm,
    ) -> Result<Option<Uuid>, AdminWorldMapDuplicateError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(None);
        }

        self.repository
            .duplicate_map(principal, source_map_id, form)
            .await
    }
}

pub fn duplicate_map_slug(form: &CreateWorldMapForm) -> String {
    form.slug
        .clone()
        .unwrap_or_else(|| generated_map_slug(&form.title))
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
        AdminWorldMapDuplicateCommand, AdminWorldMapDuplicateError,
        AdminWorldMapDuplicateRepository, duplicate_map_slug,
    };
    use crate::admin_world_map_create::CreateWorldMapForm;

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldMapDuplicateRepository for RecordingRepository {
        fn duplicate_map(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
            _: &CreateWorldMapForm,
        ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldMapDuplicateError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[test]
    fn uses_the_source_slug_generation_when_the_copy_slug_is_omitted() {
        let form = CreateWorldMapForm::parse("A map copy", None, None).expect("valid form");
        assert_eq!(duplicate_map_slug(&form), "a-map-copy");
    }

    #[tokio::test]
    async fn requires_source_map_update_permission_before_duplicating() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_nodes:rud:all".to_owned()],
        };
        let form = CreateWorldMapForm::parse("Copy", None, None).expect("valid form");

        let copied = AdminWorldMapDuplicateCommand::new(&repository)
            .execute(&principal, Uuid::new_v4(), &form)
            .await
            .expect("authorization check succeeds");

        assert!(copied.is_none());
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
