use std::future::Future;

use serde_json::Value;
use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminWorldNodeLayoutError;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminWorldNodeLayout {
    pub graph_node: GraphNode,
    pub x: i32,
    pub y: i32,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GraphNode {
    Start,
    End,
}

impl GraphNode {
    pub const fn key(self) -> &'static str {
        match self {
            Self::Start => "start",
            Self::End => "end",
        }
    }
}

pub trait AdminWorldNodeLayoutRepository {
    fn update_activity_graph_layout(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        layout: &AdminWorldNodeLayout,
    ) -> impl Future<Output = Result<Option<Value>, AdminWorldNodeLayoutError>> + Send;
}

pub struct AdminWorldNodeLayoutCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldNodeLayoutCommand<'repository, Repository>
where
    Repository: AdminWorldNodeLayoutRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    /// Saves only the source activity graph's special start/end node layout.
    /// It intentionally does not alter learner starts or activity positions.
    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        layout: &AdminWorldNodeLayout,
    ) -> Result<Option<Value>, AdminWorldNodeLayoutError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }

        self.repository
            .update_activity_graph_layout(principal, node_id, layout)
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

    use serde_json::Value;
    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::{
        AdminWorldNodeLayout, AdminWorldNodeLayoutCommand, AdminWorldNodeLayoutError,
        AdminWorldNodeLayoutRepository, GraphNode,
    };

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldNodeLayoutRepository for RecordingRepository {
        fn update_activity_graph_layout(
            &self,
            _principal: &AuthorizedPrincipal,
            _node_id: Uuid,
            _layout: &AdminWorldNodeLayout,
        ) -> impl Future<Output = Result<Option<Value>, AdminWorldNodeLayoutError>> + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn requires_source_world_activity_update_before_changing_layout() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_nodes:rud:all".to_owned()],
        };

        let result = AdminWorldNodeLayoutCommand::new(&repository)
            .execute(
                &principal,
                Uuid::new_v4(),
                &AdminWorldNodeLayout {
                    graph_node: GraphNode::Start,
                    x: 10,
                    y: 20,
                },
            )
            .await
            .expect("authorization check succeeds");

        assert!(result.is_none());
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
