use std::future::Future;

use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, world_content::AdminWorldGraph,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminWorldGraphReadError;

/// Reads the source World Builder graph after the application has confirmed
/// that the principal may open the area. The repository owns the narrower,
/// source-defined editable-map scope.
pub trait AdminWorldGraphRepository {
    fn load_editable_graph(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl Future<Output = Result<Option<AdminWorldGraph>, AdminWorldGraphReadError>> + Send;
}

pub struct AdminWorldGraphQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldGraphQuery<'repository, Repository>
where
    Repository: AdminWorldGraphRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<AdminWorldGraph>, AdminWorldGraphReadError> {
        let can_read_world_builder = [
            "world_maps",
            "world_nodes",
            "world_activities",
            "world_map_access",
        ]
        .into_iter()
        .any(|resource| principal.has_permission(resource, "ro"));
        if !can_read_world_builder {
            return Ok(None);
        }

        self.repository.load_editable_graph(principal).await
    }
}

#[cfg(test)]
mod tests {
    use std::future::Future;

    use uuid::Uuid;
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal,
        world_content::{AdminWorldGraph, AdminWorldSummary},
    };

    use super::{AdminWorldGraphQuery, AdminWorldGraphReadError, AdminWorldGraphRepository};

    struct RecordingRepository;

    impl AdminWorldGraphRepository for RecordingRepository {
        fn load_editable_graph(
            &self,
            principal: &AuthorizedPrincipal,
        ) -> impl Future<Output = Result<Option<AdminWorldGraph>, AdminWorldGraphReadError>> + Send
        {
            let subject_id = principal.subject_id;
            async move {
                Ok(Some(AdminWorldGraph {
                    world: AdminWorldSummary {
                        id: subject_id,
                        slug: "authoring-world".to_owned(),
                        title: "Authoring World".to_owned(),
                        description: "A scoped graph.".to_owned(),
                        updated_at: "2026-11-07T00:00:00.000000Z".to_owned(),
                    },
                    maps: vec![],
                    portal_candidates: vec![],
                    portal_links: vec![],
                }))
            }
        }
    }

    fn principal(capabilities: Vec<String>) -> AuthorizedPrincipal {
        AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities,
        }
    }

    #[tokio::test]
    async fn permits_any_source_world_builder_read_permission() {
        let principal = principal(vec!["role_permission:world_nodes:ro:own".to_owned()]);

        let graph = AdminWorldGraphQuery::new(&RecordingRepository)
            .execute(&principal)
            .await
            .expect("query succeeds")
            .expect("read permission grants access");

        assert_eq!(graph.world.id, principal.subject_id);
    }

    #[tokio::test]
    async fn denies_principals_without_a_source_world_builder_read_permission() {
        let principal = principal(vec!["role_permission:groups:rud:all".to_owned()]);

        let graph = AdminWorldGraphQuery::new(&RecordingRepository)
            .execute(&principal)
            .await
            .expect("authorization check succeeds");

        assert!(graph.is_none());
    }
}
