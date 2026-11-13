use std::future::Future;

use serde_json::Value;
use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, world_content::AdminActivityTransition,
};

#[derive(Clone, Debug, PartialEq)]
pub struct ContentApiActivity {
    pub id: Uuid,
    pub slug: String,
    pub activity_type: String,
    pub title: String,
    pub introduction: Option<String>,
    pub config: Value,
    pub position_x: Option<f64>,
    pub position_y: Option<f64>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ContentApiMapAssetActivities {
    pub node_id: Uuid,
    pub activities: Vec<ContentApiActivity>,
}

#[derive(Clone, Debug)]
pub struct ContentApiMapAssetTransitions {
    pub transitions: Vec<AdminActivityTransition>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ContentApiActivityReadError;

pub trait ContentApiActivityRepository {
    fn load_activities(
        &self,
        principal: &AuthorizedPrincipal,
        map_asset_id: Uuid,
    ) -> impl Future<
        Output = Result<Option<ContentApiMapAssetActivities>, ContentApiActivityReadError>,
    > + Send;

    fn load_node_id(
        &self,
        principal: &AuthorizedPrincipal,
        map_asset_id: Uuid,
    ) -> impl Future<Output = Result<Option<Uuid>, ContentApiActivityReadError>> + Send;

    fn load_transitions(
        &self,
        principal: &AuthorizedPrincipal,
        map_asset_id: Uuid,
    ) -> impl Future<
        Output = Result<Option<ContentApiMapAssetTransitions>, ContentApiActivityReadError>,
    > + Send;
}

/// Returns only the source-ordered edges in an editable MapAsset graph. The
/// Content API exposes graph facts separately from the activity list so a
/// client can safely reload an idempotent connection result.
pub struct ContentApiActivityTransitionListQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> ContentApiActivityTransitionListQuery<'repository, Repository>
where
    Repository: ContentApiActivityRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        map_asset_id: Uuid,
    ) -> Result<Option<ContentApiMapAssetTransitions>, ContentApiActivityReadError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }

        self.repository
            .load_transitions(principal, map_asset_id)
            .await
    }
}

/// Keeps the Content API's MapAsset activity listing behind the same World
/// Activity update permission and scoped map policy as the source editor.
pub struct ContentApiActivityListQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> ContentApiActivityListQuery<'repository, Repository>
where
    Repository: ContentApiActivityRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        map_asset_id: Uuid,
    ) -> Result<Option<ContentApiMapAssetActivities>, ContentApiActivityReadError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }

        self.repository
            .load_activities(principal, map_asset_id)
            .await
    }
}

/// Resolves the compatibility node only after the same Activity scope has
/// been checked. Typed activity commands continue to own their own mutation
/// authorization inside their transactions.
pub struct ContentApiActivityNodeQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> ContentApiActivityNodeQuery<'repository, Repository>
where
    Repository: ContentApiActivityRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        map_asset_id: Uuid,
    ) -> Result<Option<Uuid>, ContentApiActivityReadError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }

        self.repository.load_node_id(principal, map_asset_id).await
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
        ContentApiActivityListQuery, ContentApiActivityNodeQuery, ContentApiActivityReadError,
        ContentApiActivityRepository, ContentApiActivityTransitionListQuery,
        ContentApiMapAssetActivities, ContentApiMapAssetTransitions,
    };

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl ContentApiActivityRepository for RecordingRepository {
        fn load_activities(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
        ) -> impl Future<
            Output = Result<Option<ContentApiMapAssetActivities>, ContentApiActivityReadError>,
        > + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn load_node_id(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
        ) -> impl Future<Output = Result<Option<Uuid>, ContentApiActivityReadError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn load_transitions(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
        ) -> impl Future<
            Output = Result<Option<ContentApiMapAssetTransitions>, ContentApiActivityReadError>,
        > + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn activity_list_and_node_resolution_require_world_activity_update_access() {
        let called = Arc::new(AtomicBool::new(false));
        let repository = RecordingRepository {
            called: called.clone(),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:ru:all".to_owned()],
        };

        let activities = ContentApiActivityListQuery::new(&repository)
            .execute(&principal, Uuid::new_v4())
            .await
            .expect("authorization check");
        let node = ContentApiActivityNodeQuery::new(&repository)
            .execute(&principal, Uuid::new_v4())
            .await
            .expect("authorization check");
        let transitions = ContentApiActivityTransitionListQuery::new(&repository)
            .execute(&principal, Uuid::new_v4())
            .await
            .expect("authorization check");

        assert!(activities.is_none());
        assert!(node.is_none());
        assert!(transitions.is_none());
        assert!(!called.load(Ordering::SeqCst));
    }
}
