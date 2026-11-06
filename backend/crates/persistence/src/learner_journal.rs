use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_journal::{
    LearnerJournalReadError, LearnerJournalRepository as LearnerJournalRepositoryPort,
    LearnerJournalRequest,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearnerJournalCheckIn, LearnerJournalDocument, LearnerJournalFeedbackDomain,
        LearnerJournalFeedbackRequest, LearnerJournalFeedbackRequestDomain,
        LearnerJournalLearningContext, LearnerJournalPage, LearnerJournalPagination,
        LearnerRevisitInvitation,
    },
};

const CHECK_IN_LIMIT: i64 = 30;
const REVISIT_INVITATION_LIMIT: i64 = 12;
const REVISIT_AVAILABLE_AFTER_DAYS: i16 = 3;

pub struct PostgresLearnerJournalRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerJournalRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl LearnerJournalRepositoryPort for PostgresLearnerJournalRepository<'_> {
    fn load_page(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerJournalRequest,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerJournalDocument>, LearnerJournalReadError>,
    > + Send {
        async move {
            load_page(self.pool, principal, request)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load learner journal");
                    LearnerJournalReadError
                })
        }
    }
}

#[derive(FromRow)]
struct PageRow {
    activity_title: Option<String>,
    id: Uuid,
    expert_access_requested: bool,
    feedback: Option<String>,
    feedback_domain_group_id: Option<Uuid>,
    feedback_domain_label: Option<String>,
    feedback_domain_type: Option<String>,
    feedback_request_id: Option<Uuid>,
    feedback_requested_at: Option<String>,
    feedback_responded_at: Option<String>,
    map_slug: Option<String>,
    map_title: Option<String>,
    markdown: String,
    node_slug: Option<String>,
    node_title: Option<String>,
    preferred_mode: String,
    reflection_count: i64,
    subtopic: String,
    title: String,
    topic: String,
    updated_at: String,
}

#[derive(FromRow)]
struct FeedbackDomainRow {
    id: Uuid,
    name: String,
}

#[derive(FromRow)]
struct CheckInRow {
    activity_slug: String,
    activity_title: String,
    competence_topics: Option<Value>,
    feeling: Option<String>,
    id: Uuid,
    map_slug: String,
    map_title: String,
    next_direction: Option<String>,
    node_slug: String,
    node_title: String,
    note: Option<String>,
    origin_topic_slug: Option<String>,
    recorded_at: String,
}

#[derive(FromRow)]
struct RevisitInvitationRow {
    activity_slug: String,
    activity_title: String,
    available_at: String,
    available_since: String,
    check_in_id: Uuid,
    map_slug: String,
    map_title: String,
    node_slug: String,
    node_title: String,
    revisit_status: String,
}

fn escape_like(query: &str) -> String {
    query
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

async fn load_page(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    request: &LearnerJournalRequest,
) -> Result<Option<LearnerJournalDocument>, sqlx::Error> {
    let principal_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(pool)
    .await?;
    let Some(principal_id) = principal_id else {
        return Ok(None);
    };
    let search = request.search.as_deref().map(escape_like);
    let allow_expert_access_requests = sqlx::query_scalar::<_, bool>(
        "SELECT allow_review_requests FROM application_journal_feedback_policy WHERE singleton = TRUE",
    )
    .fetch_optional(pool)
    .await?
    .unwrap_or(false);
    let total = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM learner_journal_pages WHERE principal_id = $1 AND ($2::text IS NULL OR title ILIKE '%' || $2 || '%' ESCAPE E'\\\\' OR topic ILIKE '%' || $2 || '%' ESCAPE E'\\\\' OR subtopic ILIKE '%' || $2 || '%' ESCAPE E'\\\\' OR markdown ILIKE '%' || $2 || '%' ESCAPE E'\\\\')",
    )
    .bind(principal_id)
    .bind(&search)
    .fetch_one(pool)
    .await?;
    let offset = (request.page - 1) * request.per_page;
    let pages = sqlx::query_as::<_, PageRow>(
        "SELECT pages.id, pages.title, pages.topic, pages.subtopic, pages.markdown, pages.preferred_mode, pages.expert_access_requested, to_char(pages.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at, COUNT(reflections.id) AS reflection_count, activities.title AS activity_title, maps.slug AS map_slug, maps.title AS map_title, nodes.slug AS node_slug, nodes.title AS node_title, feedback_requests.id AS feedback_request_id, feedback_requests.domain_type AS feedback_domain_type, feedback_requests.domain_group_id AS feedback_domain_group_id, feedback_requests.domain_label AS feedback_domain_label, feedback_requests.feedback, to_char(feedback_requests.requested_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS feedback_requested_at, to_char(feedback_requests.responded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS feedback_responded_at FROM learner_journal_pages AS pages LEFT JOIN learner_journal_feedback_requests AS feedback_requests ON feedback_requests.learner_journal_page_id = pages.id LEFT JOIN learner_reflections AS reflections ON reflections.learner_journal_page_id = pages.id LEFT JOIN LATERAL (SELECT activity_start_id, activity_id FROM learner_reflections WHERE learner_journal_page_id = pages.id ORDER BY created_at DESC, id DESC LIMIT 1) AS latest ON TRUE LEFT JOIN learning_activity_starts AS starts ON starts.id = latest.activity_start_id LEFT JOIN learning_nodes AS nodes ON nodes.id = starts.node_id LEFT JOIN learning_maps AS maps ON maps.id = nodes.map_id LEFT JOIN learning_activities AS activities ON activities.id = latest.activity_id WHERE pages.principal_id = $1 AND ($2::text IS NULL OR pages.title ILIKE '%' || $2 || '%' ESCAPE E'\\\\' OR pages.topic ILIKE '%' || $2 || '%' ESCAPE E'\\\\' OR pages.subtopic ILIKE '%' || $2 || '%' ESCAPE E'\\\\' OR pages.markdown ILIKE '%' || $2 || '%' ESCAPE E'\\\\') GROUP BY pages.id, feedback_requests.id, activities.title, maps.slug, maps.title, nodes.slug, nodes.title ORDER BY pages.updated_at DESC, pages.id DESC LIMIT $3 OFFSET $4",
    )
    .bind(principal_id)
    .bind(&search)
    .bind(request.per_page)
    .bind(offset)
    .fetch_all(pool)
    .await?;
    let check_ins = load_check_ins(pool, principal_id, &principal.roles).await?;
    let revisit_invitations =
        load_revisit_invitations(pool, principal_id, &principal.roles).await?;
    let feedback_domains = load_feedback_domains(pool, principal_id).await?;
    let last_page = std::cmp::max(1, (total + request.per_page - 1) / request.per_page);

    Ok(Some(LearnerJournalDocument {
        allow_expert_access_requests,
        check_ins,
        feedback_domains,
        pages: pages
            .into_iter()
            .map(|page| LearnerJournalPage {
                expert_access_requested: page.expert_access_requested,
                feedback_request: page
                    .feedback_request_id
                    .map(|_| LearnerJournalFeedbackRequest {
                        domain: LearnerJournalFeedbackRequestDomain {
                            id: page.feedback_domain_group_id.map(|id| id.to_string()),
                            label: page.feedback_domain_label.unwrap_or_default(),
                            type_: page
                                .feedback_domain_type
                                .unwrap_or_else(|| "journal".to_owned()),
                        },
                        feedback: page.feedback,
                        requested_at: page.feedback_requested_at.unwrap_or_default(),
                        responded_at: page.feedback_responded_at.clone(),
                        status: if page.feedback_responded_at.is_some() {
                            "responded".to_owned()
                        } else {
                            "pending".to_owned()
                        },
                    }),
                id: page.id.to_string(),
                title: page.title,
                topic: page.topic,
                subtopic: (!page.subtopic.is_empty()).then_some(page.subtopic),
                markdown: page.markdown,
                preferred_mode: page.preferred_mode,
                reflection_count: page.reflection_count,
                learning_context: match (
                    page.map_slug,
                    page.map_title,
                    page.node_slug,
                    page.node_title,
                ) {
                    (Some(map_slug), Some(map_title), Some(node_slug), Some(node_title)) => {
                        Some(LearnerJournalLearningContext {
                            activity_title: page.activity_title,
                            map_slug,
                            map_title,
                            node_slug,
                            node_title,
                        })
                    }
                    _ => None,
                },
                updated_at: page.updated_at,
            })
            .collect(),
        pagination: LearnerJournalPagination {
            current_page: request.page,
            last_page,
            per_page: request.per_page,
            total,
        },
        revisit_invitations,
    }))
}

async fn load_feedback_domains(
    pool: &PgPool,
    principal_id: Uuid,
) -> Result<Vec<LearnerJournalFeedbackDomain>, sqlx::Error> {
    let groups = sqlx::query_as::<_, FeedbackDomainRow>(
        "SELECT groups.id, groups.name FROM learning_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.id WHERE memberships.principal_id = $1 ORDER BY groups.name ASC, groups.id ASC",
    )
    .bind(principal_id)
    .fetch_all(pool)
    .await?;
    Ok(std::iter::once(LearnerJournalFeedbackDomain {
        id: None,
        key: "journal".to_owned(),
        label: "Journal".to_owned(),
        type_: "journal".to_owned(),
    })
    .chain(
        groups
            .into_iter()
            .map(|group| LearnerJournalFeedbackDomain {
                id: Some(group.id.to_string()),
                key: format!("group:{}", group.id),
                label: format!("Group: {}", group.name),
                type_: "group".to_owned(),
            }),
    )
    .collect())
}

async fn load_check_ins(
    pool: &PgPool,
    principal_id: Uuid,
    roles: &[String],
) -> Result<Vec<LearnerJournalCheckIn>, sqlx::Error> {
    let rows = sqlx::query_as::<_, CheckInRow>(
        "SELECT check_ins.id, activities.slug AS activity_slug, activities.title AS activity_title, activities.activity_config -> 'competenceTopics' AS competence_topics, check_ins.feeling, check_ins.note, check_ins.next_direction, topics.slug AS origin_topic_slug, to_char(check_ins.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS recorded_at, maps.slug AS map_slug, maps.title AS map_title, nodes.slug AS node_slug, nodes.title AS node_title FROM learner_activity_check_ins AS check_ins INNER JOIN learning_activities AS activities ON activities.id = check_ins.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id LEFT JOIN learning_topics AS topics ON topics.id = maps.topic_id AND topics.published_at IS NOT NULL WHERE check_ins.principal_id = $1 AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) ORDER BY check_ins.recorded_at DESC, check_ins.id DESC LIMIT $3",
    )
    .bind(principal_id)
    .bind(roles)
    .bind(CHECK_IN_LIMIT)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| LearnerJournalCheckIn {
            activity_slug: row.activity_slug,
            activity_title: row.activity_title,
            feeling: row.feeling,
            id: row.id.to_string(),
            map_slug: row.map_slug,
            map_title: row.map_title,
            next_direction: row.next_direction,
            node_slug: row.node_slug,
            node_title: row.node_title,
            note: row.note,
            origin_topic_slug: row.origin_topic_slug,
            recorded_at: row.recorded_at,
            topics: crate::learner_competence::competence_topics(row.competence_topics),
        })
        .collect())
}

async fn load_revisit_invitations(
    pool: &PgPool,
    principal_id: Uuid,
    roles: &[String],
) -> Result<Vec<LearnerRevisitInvitation>, sqlx::Error> {
    let rows = sqlx::query_as::<_, RevisitInvitationRow>(
        "SELECT activities.slug AS activity_slug, activities.title AS activity_title, to_char(progress.revisit_available_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS available_at, to_char(check_ins.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS available_since, check_ins.id AS check_in_id, maps.slug AS map_slug, maps.title AS map_title, nodes.slug AS node_slug, nodes.title AS node_title, progress.revisit_status FROM learner_activity_progress AS progress INNER JOIN learner_activity_check_ins AS check_ins ON check_ins.id = progress.revisit_check_in_id INNER JOIN learning_activities AS activities ON activities.id = progress.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE progress.principal_id = $1 AND progress.status = 'completed' AND progress.revisit_status IN ('pending', 'snoozed') AND progress.revisit_available_at <= NOW() AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) ORDER BY progress.revisit_available_at DESC, progress.updated_at DESC, progress.activity_id DESC LIMIT $3",
    )
    .bind(principal_id)
    .bind(roles)
    .bind(REVISIT_INVITATION_LIMIT)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| LearnerRevisitInvitation {
            activity_slug: row.activity_slug,
            activity_title: row.activity_title,
            available_after_days: REVISIT_AVAILABLE_AFTER_DAYS,
            available_at: row.available_at,
            available_since: row.available_since,
            check_in_id: row.check_in_id.to_string(),
            map_slug: row.map_slug,
            map_title: row.map_title,
            node_slug: row.node_slug,
            node_title: row.node_title,
            revisit_reason: revisit_reason(&row.revisit_status).to_owned(),
        })
        .collect())
}

fn revisit_reason(status: &str) -> &'static str {
    if status == "snoozed" {
        "later"
    } else {
        "pause"
    }
}

#[cfg(test)]
mod tests {
    use super::{escape_like, revisit_reason};

    #[test]
    fn private_journal_search_escapes_database_wildcards() {
        assert_eq!(escape_like("note%_\\"), "note\\%\\_\\\\");
    }

    #[test]
    fn source_revisit_statuses_keep_their_journal_reason() {
        assert_eq!(revisit_reason("pending"), "pause");
        assert_eq!(revisit_reason("snoozed"), "later");
    }
}
