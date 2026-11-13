use std::future::Future;

use serde::Serialize;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct AdminSupportActivityBucket {
    pub active_learners: i64,
    pub contribution_recorded: f64,
    pub date: String,
    pub evidence_events: i64,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct AdminSupportGroup {
    pub id: String,
    pub name: String,
    pub study_topic: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct AdminSupportManualUnlock {
    pub granted_at: String,
    pub map_title: String,
    pub node_id: String,
    pub node_title: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct AdminSupportManualUnlockTarget {
    pub id: String,
    pub nodes: Vec<AdminSupportManualUnlockTargetNode>,
    pub title: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct AdminSupportManualUnlockTargetNode {
    pub id: String,
    pub title: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct AdminSupportNote {
    pub text: String,
    pub tone: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct AdminSupportPeerSupport {
    pub activity_id: String,
    pub activity_title: String,
    pub context_href: String,
    pub contributor_count: i64,
    pub latest_review_at: Option<String>,
    pub map_id: String,
    pub map_title: String,
    pub node_id: String,
    pub node_title: String,
    pub unresolved_review_count: i64,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct AdminSupportSummary {
    pub learners: i64,
    pub learners_with_signals: i64,
    pub topics_with_monthly_activity: i64,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct AdminSupportTopic {
    pub evidence_types: Vec<String>,
    pub monthly_contribution: f64,
    pub name: String,
    pub slug: String,
    pub total_contribution: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct AdminSupportLearner {
    pub email: String,
    pub groups: Vec<AdminSupportGroup>,
    pub last_activity_at: Option<String>,
    pub manual_unlocks: Vec<AdminSupportManualUnlock>,
    pub name: String,
    pub subject_id: String,
    pub support_notes: Vec<AdminSupportNote>,
    pub topics: Vec<AdminSupportTopic>,
    pub username: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct AdminSupportSignals {
    pub activity_overview_30_days: Vec<AdminSupportActivityBucket>,
    pub can_grant_manual_unlocks: bool,
    pub learners: Vec<AdminSupportLearner>,
    pub manual_unlock_targets: Vec<AdminSupportManualUnlockTarget>,
    pub month_key: String,
    pub peer_support: Vec<AdminSupportPeerSupport>,
    pub summary: AdminSupportSummary,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminSupportSignalsError;

pub trait AdminSupportSignalsRepository {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl Future<Output = Result<AdminSupportSignals, AdminSupportSignalsError>> + Send;
}

pub struct AdminSupportSignalsQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminSupportSignalsQuery<'repository, Repository>
where
    Repository: AdminSupportSignalsRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<AdminSupportSignals>, AdminSupportSignalsError> {
        if !principal.has_permission("learner_support_signals", "ro") {
            return Ok(None);
        }

        self.repository.load(principal).await.map(Some)
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

    use super::*;

    struct Repository(Arc<AtomicBool>);

    impl AdminSupportSignalsRepository for Repository {
        fn load(
            &self,
            _: &AuthorizedPrincipal,
        ) -> impl Future<Output = Result<AdminSupportSignals, AdminSupportSignalsError>> + Send
        {
            self.0.store(true, Ordering::SeqCst);
            async {
                Ok(AdminSupportSignals {
                    activity_overview_30_days: vec![],
                    can_grant_manual_unlocks: false,
                    learners: vec![],
                    manual_unlock_targets: vec![],
                    month_key: "2026-11".to_owned(),
                    peer_support: vec![],
                    summary: AdminSupportSummary {
                        learners: 0,
                        learners_with_signals: 0,
                        topics_with_monthly_activity: 0,
                    },
                })
            }
        }
    }

    #[tokio::test]
    async fn support_signals_require_the_scoped_read_permission() {
        let called = Arc::new(AtomicBool::new(false));
        let repository = Repository(called.clone());
        let denied = AdminSupportSignalsQuery::new(&repository)
            .execute(&AuthorizedPrincipal {
                subject_id: Uuid::new_v4(),
                roles: vec![],
                capabilities: vec![],
            })
            .await
            .expect("authorization result");

        assert!(denied.is_none());
        assert!(!called.load(Ordering::SeqCst));

        let authorized = AdminSupportSignalsQuery::new(&repository)
            .execute(&AuthorizedPrincipal {
                subject_id: Uuid::new_v4(),
                roles: vec![],
                capabilities: vec!["role_permission:learner_support_signals:ro:all".to_owned()],
            })
            .await
            .expect("authorized result")
            .expect("support signal payload");

        assert!(called.load(Ordering::SeqCst));
        assert!(authorized.peer_support.is_empty());
        assert_eq!(authorized.summary.learners, 0);
        assert_eq!(authorized.summary.learners_with_signals, 0);
        assert_eq!(authorized.summary.topics_with_monthly_activity, 0);
    }
}
