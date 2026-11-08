use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreateWorldPortalLinkForm {
    pub source_node_id: Uuid,
    pub target_node_id: Uuid,
    pub label: Option<String>,
    pub description: Option<String>,
}

impl CreateWorldPortalLinkForm {
    pub fn parse(
        source_node_id: Uuid,
        target_node_id: Uuid,
        label: Option<&str>,
        description: Option<&str>,
    ) -> Option<Self> {
        if source_node_id == target_node_id {
            return None;
        }
        let label = label.map(str::trim).filter(|value| !value.is_empty());
        let description = description.map(str::trim).filter(|value| !value.is_empty());
        if label.is_some_and(|value| value.chars().count() > 160)
            || description.is_some_and(|value| value.chars().count() > 1_000)
        {
            return None;
        }
        Some(Self {
            source_node_id,
            target_node_id,
            label: label.map(str::to_owned),
            description: description.map(str::to_owned),
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldPortalLinkError {
    Conflict,
    Unavailable,
}

pub trait AdminWorldPortalLinkRepository {
    fn create_portal_link(
        &self,
        principal: &AuthorizedPrincipal,
        form: &CreateWorldPortalLinkForm,
    ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldPortalLinkError>> + Send;

    fn delete_portal_link(
        &self,
        principal: &AuthorizedPrincipal,
        portal_link_id: Uuid,
    ) -> impl Future<Output = Result<Option<()>, AdminWorldPortalLinkError>> + Send;
}

pub struct AdminWorldPortalLinkCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldPortalLinkCommand<'repository, Repository>
where
    Repository: AdminWorldPortalLinkRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &CreateWorldPortalLinkForm,
    ) -> Result<Option<Uuid>, AdminWorldPortalLinkError> {
        if !principal.has_permission("world_map_access", "ru") {
            return Ok(None);
        }
        self.repository.create_portal_link(principal, form).await
    }

    pub async fn delete(
        &self,
        principal: &AuthorizedPrincipal,
        portal_link_id: Uuid,
    ) -> Result<Option<()>, AdminWorldPortalLinkError> {
        if !principal.has_permission("world_map_access", "ru") {
            return Ok(None);
        }
        self.repository
            .delete_portal_link(principal, portal_link_id)
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

    use super::*;

    struct Repository(Arc<AtomicBool>);

    impl AdminWorldPortalLinkRepository for Repository {
        fn create_portal_link(
            &self,
            _: &AuthorizedPrincipal,
            _: &CreateWorldPortalLinkForm,
        ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldPortalLinkError>> + Send {
            self.0.store(true, Ordering::SeqCst);
            async { Ok(Some(Uuid::nil())) }
        }

        fn delete_portal_link(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
        ) -> impl Future<Output = Result<Option<()>, AdminWorldPortalLinkError>> + Send {
            self.0.store(true, Ordering::SeqCst);
            async { Ok(Some(())) }
        }
    }

    #[test]
    fn preserves_source_link_bounds() {
        let node = Uuid::new_v4();
        assert!(CreateWorldPortalLinkForm::parse(node, node, None, None).is_none());
        assert!(
            CreateWorldPortalLinkForm::parse(node, Uuid::new_v4(), Some(&"a".repeat(161)), None,)
                .is_none()
        );
        assert_eq!(
            CreateWorldPortalLinkForm::parse(
                node,
                Uuid::new_v4(),
                Some("  Gate  "),
                Some("  Travel  "),
            )
            .expect("valid link")
            .label,
            Some("Gate".to_owned()),
        );
    }

    #[tokio::test]
    async fn requires_global_map_access_update() {
        let called = Arc::new(AtomicBool::new(false));
        let repository = Repository(called.clone());
        let form = CreateWorldPortalLinkForm::parse(Uuid::new_v4(), Uuid::new_v4(), None, None)
            .expect("valid link");
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:rud:all".to_owned()],
        };

        let created = AdminWorldPortalLinkCommand::new(&repository)
            .create(&principal, &form)
            .await
            .expect("authorization result");

        assert_eq!(created, None);
        assert!(!called.load(Ordering::SeqCst));
    }
}
