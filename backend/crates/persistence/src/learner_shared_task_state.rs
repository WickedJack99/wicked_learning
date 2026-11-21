use std::collections::HashMap;

use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_domain::learner_state::{
    LearnerSharedTaskChecklist, LearnerSharedTaskContribution, LearnerSharedTaskPeerReview,
    LearnerSharedTaskReceivedReview, LearnerSharedTaskReviewableContribution,
    LearnerSharedTaskState, LearnerSharedTaskSubmission, LearnerSharedTaskSubmittedReview,
};

use super::SharedTaskConfig;

#[derive(FromRow)]
struct OwnSubmissionRow {
    activity_id: Uuid,
    id: Uuid,
    body: String,
    project_step_index: Option<i16>,
    revised_body: Option<String>,
    revised_at: Option<String>,
    share_with_peers: bool,
    has_reviews: bool,
}

#[derive(FromRow)]
struct SnippetRow {
    activity_id: Uuid,
    id: Uuid,
    body: String,
    truncated: bool,
    project_step_index: Option<i16>,
    task_kind: String,
    accepted_at: String,
}

#[derive(FromRow)]
struct ReviewRow {
    activity_id: Uuid,
    id: Uuid,
    body: String,
    project_step_index: Option<i16>,
    response_type: Option<String>,
    created_at: String,
    is_helpful: bool,
    follow_up: Option<String>,
}

/// Shared by authorized command responses and the authorized playback graph.
/// At most seven batch queries, skipping absent kinds, with SQL limits for
/// each activity's own submission, snippets and reviews. No contributor or
/// reviewer identity crosses this projection boundary.
pub(super) async fn load(
    transaction: &mut Transaction<'_, Postgres>,
    principal: Uuid,
    run: Option<Uuid>,
    configs: &HashMap<Uuid, SharedTaskConfig>,
) -> Result<HashMap<Uuid, LearnerSharedTaskState>, sqlx::Error> {
    let ids: Vec<_> = configs.keys().copied().collect();
    if ids.is_empty() {
        return Ok(HashMap::new());
    }
    let mut states: HashMap<_, _> = configs
        .iter()
        .map(|(&id, config)| (id, empty_state(config)))
        .collect();
    let counts = sqlx::query_as::<_, (Uuid, i64, Option<String>)>(
        "SELECT activity_id,COUNT(*)::bigint,to_char(MAX(accepted_at) AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') \
         FROM learner_shared_task_submissions WHERE activity_id=ANY($1) AND status='accepted' GROUP BY activity_id",
    ).bind(&ids).fetch_all(&mut **transaction).await?;
    for (id, count, latest) in counts {
        let state = states.get_mut(&id).expect("queried activity");
        state.accepted_count = count;
        state.latest_submission_at = latest;
        state.remaining = (state.threshold - count).max(0);
        state.is_complete = count >= state.threshold;
    }
    let submissions = sqlx::query_as::<_, OwnSubmissionRow>(
        "SELECT s.activity_id,s.id,s.body,s.project_step_index,s.revised_body, \
         to_char(s.revised_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS revised_at, \
         s.share_with_peers,EXISTS(SELECT 1 FROM learner_shared_task_reviews r WHERE r.submission_id=s.id) AS has_reviews \
         FROM unnest($1::uuid[]) a(id) CROSS JOIN LATERAL \
           (SELECT * FROM learner_shared_task_submissions WHERE activity_id=a.id AND principal_id=$2 AND status='accepted' \
            ORDER BY accepted_at DESC,id DESC LIMIT 1) s",
    ).bind(&ids).bind(principal).fetch_all(&mut **transaction).await?;
    for row in submissions {
        let config = &configs[&row.activity_id];
        let state = states.get_mut(&row.activity_id).expect("queried activity");
        state.has_submitted = true;
        state.submission = Some(LearnerSharedTaskSubmission {
            id: row.id.to_string(),
            body: row.body,
            project_step: config.project_step(row.project_step_index),
            can_revise: row.share_with_peers && row.revised_body.is_none() && row.has_reviews,
            revised_body: row.revised_body,
            revised_at: row.revised_at,
        });
    }
    let shared_ids: Vec<_> = configs
        .iter()
        .filter(|(_, c)| c.show_contributions)
        .map(|(&id, _)| id)
        .collect();
    if !shared_ids.is_empty() {
        let rows = sqlx::query_as::<_, SnippetRow>(
            "SELECT s.activity_id,s.id,left(COALESCE(s.revised_body,s.body),500) AS body, \
             char_length(COALESCE(s.revised_body,s.body))>500 AS truncated,s.project_step_index,s.task_kind, \
             to_char(s.accepted_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS accepted_at \
             FROM unnest($1::uuid[]) a(id) CROSS JOIN LATERAL \
               (SELECT * FROM learner_shared_task_submissions WHERE activity_id=a.id AND status='accepted' AND share_with_peers \
                ORDER BY accepted_at DESC,id DESC LIMIT 5) s ORDER BY s.activity_id,s.accepted_at DESC,s.id DESC",
        ).bind(&shared_ids).fetch_all(&mut **transaction).await?;
        for row in rows {
            states
                .get_mut(&row.activity_id)
                .expect("queried activity")
                .contributions
                .push(LearnerSharedTaskContribution {
                    body: row.body,
                    project_step: configs[&row.activity_id].project_step(row.project_step_index),
                    submitted_at: Some(row.accepted_at),
                    task_kind: row.task_kind,
                    truncated: row.truncated,
                });
        }
    }
    let review_ids: Vec<_> = configs
        .iter()
        .filter(|(_, c)| c.peer_review_enabled())
        .map(|(&id, _)| id)
        .collect();
    if !review_ids.is_empty() {
        let rows = sqlx::query_as::<_, ReviewRow>(
            "SELECT r.activity_id,r.id,r.body,r.project_step_index,r.response_type, \
             to_char(r.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, \
             r.helpful_at IS NOT NULL AS is_helpful,NULL::text AS follow_up \
             FROM unnest($1::uuid[]) a(id) CROSS JOIN LATERAL \
               (SELECT * FROM learner_shared_task_reviews WHERE activity_id=a.id AND reviewer_principal_id=$2 \
                ORDER BY created_at DESC,id DESC LIMIT 1) r",
        ).bind(&review_ids).bind(principal).fetch_all(&mut **transaction).await?;
        for row in rows {
            let peer = states
                .get_mut(&row.activity_id)
                .expect("queried activity")
                .peer_review
                .as_mut()
                .expect("review enabled");
            peer.has_reviewed = true;
            peer.submitted_review = Some(LearnerSharedTaskSubmittedReview {
                id: row.id.to_string(),
                body: row.body,
                project_step: configs[&row.activity_id].project_step(row.project_step_index),
                response_type: row.response_type,
                created_at: Some(row.created_at),
            });
        }
    }
    let participating: Vec<_> = review_ids
        .into_iter()
        .filter(|id| states[id].has_submitted)
        .collect();
    if !participating.is_empty() {
        let rows = sqlx::query_as::<_, SnippetRow>(
            "SELECT s.activity_id,s.id,left(s.body,500) AS body,char_length(s.body)>500 AS truncated, \
             s.project_step_index,s.task_kind,to_char(s.accepted_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS accepted_at \
             FROM unnest($1::uuid[]) a(id) CROSS JOIN LATERAL \
               (SELECT * FROM learner_shared_task_submissions WHERE activity_id=a.id AND principal_id<>$2 AND status='accepted' AND share_with_peers \
                ORDER BY accepted_at DESC,id DESC LIMIT 5) s ORDER BY s.activity_id,s.accepted_at DESC,s.id DESC",
        ).bind(&participating).bind(principal).fetch_all(&mut **transaction).await?;
        for row in rows {
            states
                .get_mut(&row.activity_id)
                .expect("queried activity")
                .peer_review
                .as_mut()
                .expect("review enabled")
                .reviewable_contributions
                .push(LearnerSharedTaskReviewableContribution {
                    id: row.id.to_string(),
                    body: row.body,
                    project_step: configs[&row.activity_id].project_step(row.project_step_index),
                    task_kind: row.task_kind,
                    truncated: row.truncated,
                });
        }
        let rows = sqlx::query_as::<_, ReviewRow>(
            "SELECT r.activity_id,r.id,r.body,r.project_step_index,r.response_type, \
             to_char(r.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, \
             r.helpful_at IS NOT NULL AS is_helpful,f.body AS follow_up \
             FROM unnest($1::uuid[]) a(id) CROSS JOIN LATERAL \
               (SELECT reviews.* FROM learner_shared_task_reviews reviews \
                INNER JOIN learner_shared_task_submissions s ON s.id=reviews.submission_id AND s.activity_id=reviews.activity_id \
                WHERE reviews.activity_id=a.id AND s.principal_id=$2 AND s.status='accepted' AND s.share_with_peers \
                ORDER BY reviews.created_at DESC,reviews.id DESC LIMIT 5) r \
             LEFT JOIN learner_shared_task_review_follow_ups f ON f.review_id=r.id AND f.contributor_principal_id=$2 \
             ORDER BY r.activity_id,r.created_at DESC,r.id DESC",
        ).bind(&participating).bind(principal).fetch_all(&mut **transaction).await?;
        for row in rows {
            states
                .get_mut(&row.activity_id)
                .expect("queried activity")
                .peer_review
                .as_mut()
                .expect("review enabled")
                .received_reviews
                .push(LearnerSharedTaskReceivedReview {
                    id: row.id.to_string(),
                    body: row.body,
                    project_step: configs[&row.activity_id].project_step(row.project_step_index),
                    response_type: row.response_type,
                    created_at: Some(row.created_at),
                    can_mark_helpful: true,
                    is_helpful: row.is_helpful,
                    follow_up: row.follow_up,
                });
        }
    }
    let checklists = sqlx::query_as::<_, (Uuid, Vec<i16>)>(
        "SELECT activity_id,completed_step_indexes FROM learner_shared_task_checklists WHERE principal_id=$1 AND play_run_id=$2 AND activity_id=ANY($3)",
    ).bind(principal).bind(run).bind(&ids).fetch_all(&mut **transaction).await?;
    for (id, indexes) in checklists {
        let config = serde_json::json!({"projectSteps": configs[&id].project_steps});
        states
            .get_mut(&id)
            .expect("queried activity")
            .checklist
            .completed_step_indexes =
            crate::learner_playback_private_state::checklist_indexes(&config, indexes)?;
    }
    Ok(states)
}

fn empty_state(config: &SharedTaskConfig) -> LearnerSharedTaskState {
    LearnerSharedTaskState {
        accepted_count: 0,
        can_share_contributions: config.show_contributions,
        checklist: LearnerSharedTaskChecklist {
            completed_step_indexes: Vec::new(),
        },
        contributions: Vec::new(),
        has_submitted: false,
        is_complete: false,
        latest_submission_at: None,
        remaining: config.threshold,
        submission: None,
        threshold: config.threshold,
        peer_review: config
            .peer_review_enabled()
            .then(|| LearnerSharedTaskPeerReview {
                enabled: true,
                prompt: config.peer_review_prompt.clone(),
                has_reviewed: false,
                submitted_review: None,
                reviewable_contributions: Vec::new(),
                received_reviews: Vec::new(),
            }),
    }
}
