use std::collections::BTreeMap;

use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_learning_support_signals::{
    AdminSupportActivityBucket, AdminSupportGroup, AdminSupportLearner, AdminSupportManualUnlock,
    AdminSupportNote, AdminSupportSignals, AdminSupportSignalsError, AdminSupportSignalsRepository,
    AdminSupportTopic,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

pub struct PostgresAdminSupportSignalsRepository<'pool> {
    application_pool: &'pool PgPool,
    identity_pool: &'pool PgPool,
}

impl<'pool> PostgresAdminSupportSignalsRepository<'pool> {
    pub fn new(application_pool: &'pool PgPool, identity_pool: &'pool PgPool) -> Self {
        Self {
            application_pool,
            identity_pool,
        }
    }
}

#[derive(FromRow)]
struct LearnerRow {
    principal_id: Uuid,
    subject_id: Uuid,
    username: Option<String>,
}

#[derive(FromRow)]
struct IdentityRow {
    email: String,
    name: String,
    subject_id: Uuid,
}

#[derive(FromRow)]
struct GroupRow {
    id: Uuid,
    name: String,
    principal_id: Uuid,
    study_topic: Option<String>,
}

#[derive(FromRow)]
struct TopicRow {
    evidence_types: Vec<String>,
    monthly_contribution: f64,
    name: String,
    principal_id: Uuid,
    slug: String,
    total_contribution: f64,
}

#[derive(FromRow)]
struct LastActivityRow {
    last_activity_at: String,
    principal_id: Uuid,
}

#[derive(FromRow)]
struct ManualUnlockRow {
    granted_at: String,
    map_title: String,
    node_id: Uuid,
    node_title: String,
    principal_id: Uuid,
}

#[derive(FromRow)]
struct BucketRow {
    active_learners: i64,
    contribution_recorded: f64,
    date: String,
    evidence_events: i64,
}

impl AdminSupportSignalsRepository for PostgresAdminSupportSignalsRepository<'_> {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl std::future::Future<Output = Result<AdminSupportSignals, AdminSupportSignalsError>> + Send
    {
        async move {
            load(self.application_pool, self.identity_pool, principal)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load scoped learner support signals");
                    AdminSupportSignalsError
                })
        }
    }
}

async fn load(
    application_pool: &PgPool,
    identity_pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<AdminSupportSignals, sqlx::Error> {
    let Some(scope) = principal.permission_scope("learner_support_signals", "ro") else {
        return Ok(empty_signals(application_pool).await?);
    };
    let Some(actor_principal_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(application_pool)
    .await?
    else {
        return Ok(empty_signals(application_pool).await?);
    };
    let learners = visible_learners(application_pool, scope, actor_principal_id).await?;
    if learners.is_empty() {
        return Ok(empty_signals(application_pool).await?);
    }
    let principal_ids = learners
        .iter()
        .map(|learner| learner.principal_id)
        .collect::<Vec<_>>();
    let subject_ids = learners
        .iter()
        .map(|learner| learner.subject_id)
        .collect::<Vec<_>>();
    let identities = sqlx::query_as::<_, IdentityRow>(
        "SELECT subjects.id AS subject_id, subjects.normalized_email AS email, profiles.display_name AS name \
         FROM identity_subjects AS subjects \
         INNER JOIN identity_profiles AS profiles ON profiles.subject_id = subjects.id \
         WHERE subjects.id = ANY($1)",
    )
    .bind(&subject_ids)
    .fetch_all(identity_pool)
    .await?
    .into_iter()
    .map(|identity| (identity.subject_id, identity))
    .collect::<BTreeMap<_, _>>();
    let groups = load_groups(application_pool, &principal_ids).await?;
    let topics = load_topics(application_pool, &principal_ids).await?;
    let last_activity = load_last_activity(application_pool, &principal_ids).await?;
    let manual_unlocks = load_manual_unlocks(application_pool, &principal_ids).await?;
    let activity_overview_30_days =
        load_activity_overview(application_pool, &principal_ids).await?;
    let month_key = sqlx::query_scalar::<_, String>("SELECT to_char(CURRENT_DATE, 'YYYY-MM')")
        .fetch_one(application_pool)
        .await?;

    let learners = learners
        .into_iter()
        .filter_map(|learner| {
            let identity = identities.get(&learner.subject_id)?;
            let topics = topics
                .get(&learner.principal_id)
                .cloned()
                .unwrap_or_default();
            Some(AdminSupportLearner {
                email: identity.email.clone(),
                groups: groups
                    .get(&learner.principal_id)
                    .cloned()
                    .unwrap_or_default(),
                last_activity_at: last_activity.get(&learner.principal_id).cloned(),
                manual_unlocks: manual_unlocks
                    .get(&learner.principal_id)
                    .cloned()
                    .unwrap_or_default(),
                name: identity.name.clone(),
                subject_id: learner.subject_id.to_string(),
                support_notes: support_notes(&topics),
                topics,
                username: learner.username,
            })
        })
        .collect();

    Ok(AdminSupportSignals {
        activity_overview_30_days,
        learners,
        month_key,
    })
}

async fn empty_signals(pool: &PgPool) -> Result<AdminSupportSignals, sqlx::Error> {
    Ok(AdminSupportSignals {
        activity_overview_30_days: load_activity_overview(pool, &[]).await?,
        learners: vec![],
        month_key: sqlx::query_scalar::<_, String>("SELECT to_char(CURRENT_DATE, 'YYYY-MM')")
            .fetch_one(pool)
            .await?,
    })
}

async fn visible_learners(
    pool: &PgPool,
    scope: &str,
    actor_principal_id: Uuid,
) -> Result<Vec<LearnerRow>, sqlx::Error> {
    let statement = if scope == "all" {
        "SELECT principals.id AS principal_id, principals.identity_subject_id AS subject_id, profiles.public_username AS username FROM application_principals AS principals LEFT JOIN application_public_profiles AS profiles ON profiles.principal_id = principals.id ORDER BY principals.id"
    } else if permission_scope_allows(scope, "group") {
        "SELECT DISTINCT learners.id AS principal_id, learners.identity_subject_id AS subject_id, profiles.public_username AS username FROM application_principals AS learners LEFT JOIN application_public_profiles AS profiles ON profiles.principal_id = learners.id INNER JOIN learning_group_memberships AS learner_memberships ON learner_memberships.principal_id = learners.id INNER JOIN learning_group_memberships AS actor_memberships ON actor_memberships.group_id = learner_memberships.group_id WHERE actor_memberships.principal_id = $1 ORDER BY learners.id"
    } else if permission_scope_allows(scope, "own") {
        "SELECT principals.id AS principal_id, principals.identity_subject_id AS subject_id, profiles.public_username AS username FROM application_principals AS principals LEFT JOIN application_public_profiles AS profiles ON profiles.principal_id = principals.id WHERE principals.id = $1"
    } else {
        return Ok(vec![]);
    };
    sqlx::query_as::<_, LearnerRow>(statement)
        .bind(actor_principal_id)
        .fetch_all(pool)
        .await
}

async fn load_groups(
    pool: &PgPool,
    principal_ids: &[Uuid],
) -> Result<BTreeMap<Uuid, Vec<AdminSupportGroup>>, sqlx::Error> {
    let rows = sqlx::query_as::<_, GroupRow>(
        "SELECT memberships.principal_id, groups.id, groups.name, groups.study_topic FROM learning_group_memberships AS memberships INNER JOIN learning_groups AS groups ON groups.id = memberships.group_id WHERE memberships.principal_id = ANY($1) ORDER BY memberships.principal_id, groups.name, groups.id",
    )
    .bind(principal_ids)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().fold(BTreeMap::new(), |mut groups, row| {
        groups
            .entry(row.principal_id)
            .or_default()
            .push(AdminSupportGroup {
                id: row.id.to_string(),
                name: row.name,
                study_topic: row.study_topic,
            });
        groups
    }))
}

async fn load_topics(
    pool: &PgPool,
    principal_ids: &[Uuid],
) -> Result<BTreeMap<Uuid, Vec<AdminSupportTopic>>, sqlx::Error> {
    let rows = sqlx::query_as::<_, TopicRow>(
        "SELECT principal_id, topic_slug AS slug, MAX(topic_name) AS name, SUM(contribution)::double precision AS total_contribution, COALESCE(SUM(contribution) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)), 0)::double precision AS monthly_contribution, ARRAY_AGG(DISTINCT evidence_type ORDER BY evidence_type) AS evidence_types FROM learner_evidence_events WHERE principal_id = ANY($1) GROUP BY principal_id, topic_slug ORDER BY principal_id, total_contribution DESC, topic_slug ASC",
    ).bind(principal_ids).fetch_all(pool).await?;
    Ok(rows.into_iter().fold(BTreeMap::new(), |mut topics, row| {
        topics
            .entry(row.principal_id)
            .or_default()
            .push(AdminSupportTopic {
                evidence_types: row.evidence_types,
                monthly_contribution: row.monthly_contribution,
                name: row.name,
                slug: row.slug,
                total_contribution: row.total_contribution,
            });
        topics
    }))
}

async fn load_last_activity(
    pool: &PgPool,
    principal_ids: &[Uuid],
) -> Result<BTreeMap<Uuid, String>, sqlx::Error> {
    let rows = sqlx::query_as::<_, LastActivityRow>(
        "SELECT principal_id, to_char(MAX(created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS last_activity_at FROM learner_evidence_events WHERE principal_id = ANY($1) GROUP BY principal_id",
    ).bind(principal_ids).fetch_all(pool).await?;
    Ok(rows
        .into_iter()
        .map(|row| (row.principal_id, row.last_activity_at))
        .collect())
}

async fn load_manual_unlocks(
    pool: &PgPool,
    principal_ids: &[Uuid],
) -> Result<BTreeMap<Uuid, Vec<AdminSupportManualUnlock>>, sqlx::Error> {
    let rows = sqlx::query_as::<_, ManualUnlockRow>(
        "SELECT unlocks.principal_id, unlocks.node_id, nodes.title AS node_title, maps.title AS map_title, to_char(unlocks.granted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS granted_at FROM learner_node_manual_unlocks AS unlocks INNER JOIN learning_nodes AS nodes ON nodes.id = unlocks.node_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE unlocks.principal_id = ANY($1) AND unlocks.revoked_at IS NULL ORDER BY unlocks.principal_id, maps.title, nodes.title, unlocks.node_id",
    ).bind(principal_ids).fetch_all(pool).await?;
    Ok(rows.into_iter().fold(BTreeMap::new(), |mut unlocks, row| {
        unlocks
            .entry(row.principal_id)
            .or_default()
            .push(AdminSupportManualUnlock {
                granted_at: row.granted_at,
                map_title: row.map_title,
                node_id: row.node_id.to_string(),
                node_title: row.node_title,
            });
        unlocks
    }))
}

async fn load_activity_overview(
    pool: &PgPool,
    principal_ids: &[Uuid],
) -> Result<Vec<AdminSupportActivityBucket>, sqlx::Error> {
    let rows = sqlx::query_as::<_, BucketRow>(
        "WITH days AS (SELECT generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day')::date AS day), activity AS (SELECT created_at::date AS day, COUNT(DISTINCT principal_id)::bigint AS active_learners, COALESCE(SUM(contribution), 0)::double precision AS contribution_recorded, COUNT(*)::bigint AS evidence_events FROM learner_evidence_events WHERE principal_id = ANY($1) AND created_at >= CURRENT_DATE - INTERVAL '29 days' AND created_at < CURRENT_DATE + INTERVAL '1 day' GROUP BY created_at::date) SELECT to_char(days.day, 'YYYY-MM-DD') AS date, COALESCE(activity.active_learners, 0) AS active_learners, COALESCE(activity.contribution_recorded, 0)::double precision AS contribution_recorded, COALESCE(activity.evidence_events, 0) AS evidence_events FROM days LEFT JOIN activity ON activity.day = days.day ORDER BY days.day",
    ).bind(principal_ids).fetch_all(pool).await?;
    Ok(rows
        .into_iter()
        .map(|row| AdminSupportActivityBucket {
            active_learners: row.active_learners,
            contribution_recorded: row.contribution_recorded,
            date: row.date,
            evidence_events: row.evidence_events,
        })
        .collect())
}

fn support_notes(topics: &[AdminSupportTopic]) -> Vec<AdminSupportNote> {
    if topics.is_empty() {
        return vec![AdminSupportNote { tone: "quiet".to_owned(), text: "No competence signals have been recorded yet. This is a starting point, not a deficit.".to_owned() }];
    }
    let monthly_total = topics
        .iter()
        .map(|topic| topic.monthly_contribution)
        .sum::<f64>();
    let mut notes = vec![];
    if monthly_total <= 0.0 {
        notes.push(AdminSupportNote { tone: "attention".to_owned(), text: "No topic activity is visible for the current month. A gentle check-in may be useful.".to_owned() });
    } else if let Some(topic) = topics
        .iter()
        .filter(|topic| topic.monthly_contribution > 0.0)
        .max_by(|left, right| {
            left.monthly_contribution
                .total_cmp(&right.monthly_contribution)
        })
    {
        notes.push(AdminSupportNote {
            tone: "support".to_owned(),
            text: format!("Current focus: {}.", topic.name),
        });
    }
    if topics.len() >= 3 {
        notes.push(AdminSupportNote { tone: "support".to_owned(), text: "Activity is spread across several topics. This can be a useful bridge for mentoring conversations.".to_owned() });
    }
    notes
}
