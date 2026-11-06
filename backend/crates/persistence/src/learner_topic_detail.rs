use std::collections::{BTreeMap, HashMap};

use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_topic_detail::{
    LearnerTopicDetailReadError, LearnerTopicDetailRepository as LearnerTopicDetailRepositoryPort,
    LearnerTopicDetailRequest,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearnerCompetenceEvidence, LearnerCompetenceSource, LearnerTopicDetailHeader,
        LearnerTopicLearningArea, LearnerTopicLearningPulse, LearnerTopicMapSummary,
        LearnerTopicMaps, LearnerTopicOverview, LearnerTopicPagination, LearnerTopicParent,
        LearnerTopicReflectionNarrative, LearnerTopicReflectionSnapshot, LearnerTopicSummary,
        LearnerTopicTrail, LearnerTopicTrailCompetence,
    },
};

use crate::learner_competence::visual_for_topic;

const MAPS_PER_PAGE: i64 = 4;
const SUBTOPICS_PER_PAGE: i64 = 4;

pub struct PostgresLearnerTopicDetailRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerTopicDetailRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(Clone, FromRow)]
struct HeaderRow {
    area_id: Uuid,
    area_slug: String,
    area_title: String,
    content: Option<String>,
    description: Option<String>,
    id: Uuid,
    parent_slug: Option<String>,
    parent_title: Option<String>,
    slug: String,
    title: String,
}

#[derive(FromRow)]
struct TopicRow {
    description: Option<String>,
    map_count: i64,
    slug: String,
    title: String,
}

#[derive(FromRow)]
struct MapRow {
    description: String,
    node_count: i64,
    slug: String,
    title: String,
}

#[derive(FromRow)]
struct TrailActivityRow {
    activity_config: Value,
    activity_type: String,
}

#[derive(FromRow)]
struct TrailPulseRow {
    activity_config: Value,
    activity_slug: String,
    activity_title: String,
    feeling: Option<String>,
    node_title: String,
    note: Option<String>,
    recorded_at: String,
}

#[derive(FromRow)]
struct TrailReflectionRow {
    activity_title: Option<String>,
    created_at: String,
    id: Uuid,
    question: String,
    reflection: String,
}

#[derive(FromRow)]
struct TrailCompetenceRow {
    aura_threshold: f64,
    brightness_threshold: f64,
    evidence_types: Vec<String>,
    growth_threshold: f64,
    learning_periods: Vec<String>,
    name: String,
    recent_signal: f64,
    slug: String,
    total_signal: f64,
}

#[derive(FromRow)]
struct TrailEvidenceRow {
    activity_title: String,
    assistance_level: String,
    attempt_number: i32,
    concepts: Option<Value>,
    confidence: Option<String>,
    confidence_after_feedback: Option<String>,
    evidence_criterion: Option<String>,
    evidence_rubric: Option<Value>,
    evidence_type: String,
    id: Uuid,
    independent_check: bool,
    learning_purpose: Option<String>,
    node_title: Option<String>,
    objective: Option<String>,
    observed_cues: Option<Value>,
    outcome: String,
    recorded_at: String,
    source_references: Option<Value>,
    topic_slug: String,
}

impl LearnerTopicDetailRepositoryPort for PostgresLearnerTopicDetailRepository<'_> {
    fn load_trail(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerTopicDetailRequest,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerTopicTrail>, LearnerTopicDetailReadError>,
    > + Send {
        async move {
            load_trail(self.pool, principal, request)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load learner topic trail");
                    LearnerTopicDetailReadError
                })
        }
    }

    fn load_maps(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerTopicDetailRequest,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerTopicMaps>, LearnerTopicDetailReadError>,
    > + Send {
        async move {
            load_maps(self.pool, principal, request)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load learner topic maps");
                    LearnerTopicDetailReadError
                })
        }
    }

    fn load_overview(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerTopicDetailRequest,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerTopicOverview>, LearnerTopicDetailReadError>,
    > + Send {
        async move {
            load_overview(self.pool, principal, request)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load learner topic overview");
                    LearnerTopicDetailReadError
                })
        }
    }
}

async fn load_maps(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    request: &LearnerTopicDetailRequest,
) -> Result<Option<LearnerTopicMaps>, sqlx::Error> {
    let Some(header) = load_header(pool, &request.topic_slug).await? else {
        return Ok(None);
    };
    let total = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM learning_maps AS maps WHERE maps.topic_id = $1 AND maps.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2)))",
    )
    .bind(header.id)
    .bind(&principal.roles)
    .fetch_one(pool)
    .await?;
    let pagination = pagination(request.page, total, MAPS_PER_PAGE);
    let maps = sqlx::query_as::<_, MapRow>(
        "SELECT maps.description, COUNT(nodes.id) AS node_count, maps.slug, maps.title FROM learning_maps AS maps LEFT JOIN learning_nodes AS nodes ON nodes.map_id = maps.id AND nodes.published_at IS NOT NULL WHERE maps.topic_id = $1 AND maps.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) GROUP BY maps.id ORDER BY maps.title ASC LIMIT $3 OFFSET $4",
    )
    .bind(header.id)
    .bind(&principal.roles)
    .bind(pagination.per_page)
    .bind((pagination.current_page - 1) * pagination.per_page)
    .fetch_all(pool)
    .await?;

    Ok(Some(LearnerTopicMaps {
        maps: maps
            .into_iter()
            .map(|map| LearnerTopicMapSummary {
                description: map.description,
                href: map_href(&map.slug),
                node_count: map.node_count,
                slug: map.slug,
                title: map.title,
            })
            .collect(),
        maps_pagination: pagination,
        topic: header.into(),
    }))
}

async fn load_overview(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    request: &LearnerTopicDetailRequest,
) -> Result<Option<LearnerTopicOverview>, sqlx::Error> {
    let Some(header) = load_header(pool, &request.topic_slug).await? else {
        return Ok(None);
    };
    let total = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM learning_topics WHERE parent_id = $1 AND published_at IS NOT NULL",
    )
    .bind(header.id)
    .fetch_one(pool)
    .await?;
    let pagination = pagination(request.page, total, SUBTOPICS_PER_PAGE);
    let subtopics = sqlx::query_as::<_, TopicRow>(
        "SELECT topics.description, COUNT(maps.id) AS map_count, topics.slug, topics.title FROM learning_topics AS topics LEFT JOIN learning_maps AS maps ON maps.topic_id = topics.id AND maps.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) WHERE topics.parent_id = $1 AND topics.published_at IS NOT NULL GROUP BY topics.id ORDER BY topics.title ASC LIMIT $3 OFFSET $4",
    )
    .bind(header.id)
    .bind(&principal.roles)
    .bind(pagination.per_page)
    .bind((pagination.current_page - 1) * pagination.per_page)
    .fetch_all(pool)
    .await?;

    Ok(Some(LearnerTopicOverview {
        subtopics: subtopics
            .into_iter()
            .map(|topic| LearnerTopicSummary {
                description: topic.description,
                href: topic_href(&topic.slug),
                map_count: topic.map_count,
                slug: topic.slug,
                title: topic.title,
            })
            .collect(),
        subtopics_pagination: pagination,
        topic: header.into(),
    }))
}

async fn load_trail(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    request: &LearnerTopicDetailRequest,
) -> Result<Option<LearnerTopicTrail>, sqlx::Error> {
    let Some(header) = load_header(pool, &request.topic_slug).await? else {
        return Ok(None);
    };
    let Some(principal_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };
    let descendant_ids = load_descendant_topic_ids(pool, header.id, header.area_id).await?;
    let learning_areas = load_learning_areas(pool, &header, &principal.roles).await?;
    let learning_area_slugs = learning_areas
        .iter()
        .map(|area| area.slug.clone())
        .collect::<Vec<_>>();
    let learning_pulse =
        load_learning_pulse(pool, principal_id, &principal.roles, &learning_area_slugs).await?;
    let reflection_narrative =
        load_reflection_narrative(pool, principal_id, &principal.roles, &descendant_ids).await?;
    let competence = load_trail_competence(
        pool,
        principal_id,
        &principal.roles,
        &descendant_ids,
        &header.slug,
    )
    .await?;
    let (current_competence, subtopic_competence) =
        competence
            .into_iter()
            .fold((None, Vec::new()), |(current, mut subtopics), entry| {
                if entry.slug == header.slug && current.is_none() {
                    (Some(entry), subtopics)
                } else {
                    subtopics.push(entry);
                    (current, subtopics)
                }
            });

    Ok(Some(LearnerTopicTrail {
        competence: current_competence,
        learning_areas,
        learning_pulse,
        reflection_narrative,
        subtopic_competence,
        topic: header.into(),
    }))
}

async fn load_descendant_topic_ids(
    pool: &PgPool,
    topic_id: Uuid,
    area_id: Uuid,
) -> Result<Vec<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        "WITH RECURSIVE descendants AS (SELECT id FROM learning_topics WHERE id = $1 AND area_id = $2 AND published_at IS NOT NULL UNION ALL SELECT topics.id FROM learning_topics AS topics INNER JOIN descendants ON topics.parent_id = descendants.id WHERE topics.area_id = $2 AND topics.published_at IS NOT NULL) SELECT id FROM descendants",
    )
    .bind(topic_id)
    .bind(area_id)
    .fetch_all(pool)
    .await
}

async fn load_learning_areas(
    pool: &PgPool,
    header: &HeaderRow,
    roles: &[String],
) -> Result<Vec<LearnerTopicLearningArea>, sqlx::Error> {
    let activities = sqlx::query_as::<_, TrailActivityRow>(
        "SELECT activities.activity_config, activities.activity_type FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE maps.topic_id = $1 AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2)))",
    )
    .bind(header.id)
    .bind(roles)
    .fetch_all(pool)
    .await?;

    let mut areas = BTreeMap::<String, (String, Vec<String>)>::new();
    for activity in activities {
        let intent = learning_intent(&activity.activity_type, &activity.activity_config);
        for (slug, name) in configured_learning_areas(&activity.activity_config) {
            let entry = areas.entry(slug).or_insert_with(|| (name, Vec::new()));
            if !entry.1.contains(&intent) {
                entry.1.push(intent.clone());
                entry.1.sort();
            }
        }
    }

    let mut result = areas
        .into_iter()
        .map(
            |(slug, (name, learning_intents))| LearnerTopicLearningArea {
                learning_intents,
                name,
                slug,
            },
        )
        .collect::<Vec<_>>();
    result.sort_by(|left, right| left.name.cmp(&right.name));
    result.truncate(100);
    Ok(result)
}

async fn load_learning_pulse(
    pool: &PgPool,
    principal_id: Uuid,
    roles: &[String],
    learning_area_slugs: &[String],
) -> Result<Vec<LearnerTopicLearningPulse>, sqlx::Error> {
    if learning_area_slugs.is_empty() {
        return Ok(Vec::new());
    }
    let rows = sqlx::query_as::<_, TrailPulseRow>(
        "SELECT activities.activity_config, activities.slug AS activity_slug, activities.title AS activity_title, check_ins.feeling, nodes.title AS node_title, check_ins.note, to_char(check_ins.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS recorded_at FROM learner_activity_check_ins AS check_ins INNER JOIN learning_activities AS activities ON activities.id = check_ins.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE check_ins.principal_id = $1 AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) ORDER BY check_ins.recorded_at DESC, check_ins.id DESC LIMIT 30",
    )
    .bind(principal_id)
    .bind(roles)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .filter(|row| {
            configured_learning_areas(&row.activity_config)
                .iter()
                .any(|(slug, _)| learning_area_slugs.contains(slug))
        })
        .take(4)
        .map(|row| LearnerTopicLearningPulse {
            activity_slug: row.activity_slug,
            activity_title: row.activity_title,
            feeling: row.feeling,
            node_title: row.node_title,
            note: row.note,
            recorded_at: row.recorded_at,
        })
        .collect())
}

async fn load_reflection_narrative(
    pool: &PgPool,
    principal_id: Uuid,
    roles: &[String],
    descendant_ids: &[Uuid],
) -> Result<Option<LearnerTopicReflectionNarrative>, sqlx::Error> {
    if descendant_ids.is_empty() {
        return Ok(None);
    }
    let rows = sqlx::query_as::<_, TrailReflectionRow>(
        "SELECT activities.title AS activity_title, to_char(reflections.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, reflections.id, reflections.question, reflections.reflection FROM learner_reflections AS reflections INNER JOIN learning_activities AS activities ON activities.id = reflections.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE reflections.principal_id = $1 AND maps.topic_id = ANY($2) AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($3))) ORDER BY reflections.created_at DESC, reflections.id DESC LIMIT 12",
    )
    .bind(principal_id)
    .bind(descendant_ids)
    .bind(roles)
    .fetch_all(pool)
    .await?;
    if rows.len() < 2 {
        return Ok(None);
    }
    let earliest = sqlx::query_as::<_, TrailReflectionRow>(
        "SELECT activities.title AS activity_title, to_char(reflections.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, reflections.id, reflections.question, reflections.reflection FROM learner_reflections AS reflections INNER JOIN learning_activities AS activities ON activities.id = reflections.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE reflections.principal_id = $1 AND maps.topic_id = ANY($2) AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($3))) ORDER BY reflections.created_at ASC, reflections.id ASC LIMIT 1",
    )
    .bind(principal_id)
    .bind(descendant_ids)
    .bind(roles)
    .fetch_one(pool)
    .await?;
    let mut entries = rows
        .into_iter()
        .map(Into::into)
        .collect::<Vec<LearnerTopicReflectionSnapshot>>();
    entries.sort_by(|left, right| {
        left.created_at
            .cmp(&right.created_at)
            .then(left.id.cmp(&right.id))
    });
    let later = entries[0].clone();

    Ok(Some(LearnerTopicReflectionNarrative {
        earlier: earliest.into(),
        entries,
        later,
    }))
}

async fn load_trail_competence(
    pool: &PgPool,
    principal_id: Uuid,
    roles: &[String],
    descendant_ids: &[Uuid],
    topic_slug: &str,
) -> Result<Vec<LearnerTopicTrailCompetence>, sqlx::Error> {
    if descendant_ids.is_empty() {
        return Ok(Vec::new());
    }
    let rows = sqlx::query_as::<_, TrailCompetenceRow>(
        "WITH visible_events AS (SELECT events.*, maps.topic_id AS map_topic_id FROM learner_evidence_events AS events INNER JOIN learning_activities AS activities ON activities.id = events.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE events.principal_id = $1 AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) AND (events.topic_slug = $4 OR events.topic_slug IN (SELECT topics.slug FROM learning_topics AS topics WHERE topics.id = ANY($3) AND topics.published_at IS NOT NULL) OR maps.topic_id = ANY($3))), latest_names AS (SELECT DISTINCT ON (topic_slug) topic_slug, topic_name FROM visible_events ORDER BY topic_slug, created_at DESC, id DESC) SELECT events.topic_slug AS slug, COALESCE(definitions.name, latest_names.topic_name) AS name, SUM(events.contribution)::double precision AS total_signal, COALESCE(SUM(events.contribution) FILTER (WHERE events.created_at >= NOW() - INTERVAL '30 days'), 0)::double precision AS recent_signal, COALESCE(definitions.growth_threshold, 20)::double precision AS growth_threshold, COALESCE(definitions.emittance_threshold, 20)::double precision AS brightness_threshold, COALESCE(definitions.aura_threshold, 10)::double precision AS aura_threshold, ARRAY(SELECT DISTINCT evidence_type FROM visible_events AS type_events WHERE type_events.topic_slug = events.topic_slug ORDER BY evidence_type) AS evidence_types, ARRAY(SELECT to_char(period, 'Mon YYYY') FROM (SELECT DISTINCT date_trunc('month', period_events.created_at AT TIME ZONE 'UTC') AS period FROM visible_events AS period_events WHERE period_events.topic_slug = events.topic_slug ORDER BY period DESC LIMIT 12) AS periods ORDER BY period ASC) AS learning_periods FROM visible_events AS events INNER JOIN latest_names ON latest_names.topic_slug = events.topic_slug LEFT JOIN competence_topic_definitions AS definitions ON definitions.slug = events.topic_slug AND definitions.is_active GROUP BY events.topic_slug, definitions.name, definitions.growth_threshold, definitions.emittance_threshold, definitions.aura_threshold, latest_names.topic_name ORDER BY total_signal DESC, events.topic_slug ASC LIMIT 100",
    )
    .bind(principal_id)
    .bind(roles)
    .bind(descendant_ids)
    .bind(topic_slug)
    .fetch_all(pool)
    .await?;
    let slugs = rows.iter().map(|row| row.slug.clone()).collect::<Vec<_>>();
    let mut ledger = load_trail_evidence(
        pool,
        principal_id,
        roles,
        descendant_ids,
        &slugs,
        topic_slug,
    )
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| LearnerTopicTrailCompetence {
            name: row.name,
            slug: row.slug.clone(),
            visual: visual_for_topic(
                row.total_signal,
                row.recent_signal,
                row.growth_threshold,
                row.brightness_threshold,
                row.aura_threshold,
                row.evidence_types,
                row.learning_periods,
                ledger.remove(&row.slug).unwrap_or_default(),
            ),
        })
        .collect())
}

async fn load_trail_evidence(
    pool: &PgPool,
    principal_id: Uuid,
    roles: &[String],
    descendant_ids: &[Uuid],
    topic_slugs: &[String],
    topic_slug: &str,
) -> Result<HashMap<String, Vec<LearnerCompetenceEvidence>>, sqlx::Error> {
    if topic_slugs.is_empty() {
        return Ok(HashMap::new());
    }
    let rows = sqlx::query_as::<_, TrailEvidenceRow>(
        "WITH visible_events AS (SELECT events.*, maps.topic_id AS map_topic_id FROM learner_evidence_events AS events INNER JOIN learning_activities AS activities ON activities.id = events.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE events.principal_id = $1 AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) AND (events.topic_slug = $5 OR events.topic_slug IN (SELECT topics.slug FROM learning_topics AS topics WHERE topics.id = ANY($3) AND topics.published_at IS NOT NULL) OR maps.topic_id = ANY($3))), ranked_events AS (SELECT visible_events.*, ROW_NUMBER() OVER (PARTITION BY topic_slug ORDER BY created_at DESC, id DESC) AS topic_position FROM visible_events WHERE topic_slug = ANY($4)) SELECT ranked_events.id, ranked_events.topic_slug, activities.title AS activity_title, ranked_events.assistance_level, ranked_events.attempt_number, ranked_events.concepts, ranked_events.confidence, ranked_events.confidence_after_feedback, ranked_events.evidence_criterion, ranked_events.evidence_rubric, ranked_events.evidence_type, ranked_events.is_independent_check AS independent_check, ranked_events.learning_purpose, nodes.title AS node_title, ranked_events.objective, ranked_events.observed_cues, ranked_events.outcome, to_char(ranked_events.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS recorded_at, ranked_events.source_references FROM ranked_events INNER JOIN learning_activities AS activities ON activities.id = ranked_events.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id WHERE ranked_events.topic_position <= 12 ORDER BY ranked_events.topic_slug ASC, ranked_events.created_at DESC, ranked_events.id DESC",
    )
    .bind(principal_id)
    .bind(roles)
    .bind(descendant_ids)
    .bind(topic_slugs)
    .bind(topic_slug)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().fold(HashMap::new(), |mut ledger, row| {
        let claim = evidence_claim(&row);
        ledger
            .entry(row.topic_slug.clone())
            .or_default()
            .push(LearnerCompetenceEvidence {
                activity_title: row.activity_title,
                assistance_level: (row.assistance_level != "untracked"
                    && !row.assistance_level.is_empty())
                .then_some(row.assistance_level),
                attempt_number: row.attempt_number,
                concepts: string_array(row.concepts),
                confidence: row.confidence,
                confidence_after_feedback: row.confidence_after_feedback,
                evidence_claim: claim,
                evidence_criterion: row.evidence_criterion,
                evidence_rubric: string_array(row.evidence_rubric),
                evidence_type: row.evidence_type,
                id: row.id.to_string(),
                independent_check: row.independent_check,
                learning_purpose: row.learning_purpose,
                node_title: row.node_title,
                objective: row.objective,
                observed_cues: string_array(row.observed_cues),
                outcome: row.outcome,
                recorded_at: row.recorded_at,
                sources: source_references(row.source_references),
            });
        ledger
    }))
}

impl From<TrailReflectionRow> for LearnerTopicReflectionSnapshot {
    fn from(row: TrailReflectionRow) -> Self {
        Self {
            activity_title: row.activity_title,
            created_at: row.created_at,
            id: row.id.to_string(),
            question: row.question,
            reflection: row.reflection,
        }
    }
}

fn configured_learning_areas(config: &Value) -> Vec<(String, String)> {
    config
        .get("competenceTopics")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|entry| {
            let name = entry.get("topic")?.as_str()?.trim();
            let slug = entry.get("slug")?.as_str()?.trim();
            (!name.is_empty() && name.chars().count() <= 120 && valid_slug(slug))
                .then(|| (slug.to_owned(), name.to_owned()))
        })
        .fold(Vec::new(), |mut areas, area| {
            if !areas.iter().any(|(slug, _)| slug == &area.0) {
                areas.push(area);
            }
            areas
        })
}

fn learning_intent(activity_type: &str, config: &Value) -> String {
    config
        .get("learningIntent")
        .and_then(Value::as_str)
        .filter(|intent| {
            matches!(
                *intent,
                "apply"
                    | "explain"
                    | "participate"
                    | "reflect"
                    | "retrieve"
                    | "review"
                    | "transfer"
            )
        })
        .unwrap_or_else(|| match activity_type {
            "question" => "retrieve",
            "reflection" => "reflect",
            "review" => "review",
            "shared_task" | "message_prompt" | "message_wall" => "explain",
            "obstacle" | "item_obstacle" | "tool_obstacle" => "apply",
            _ => "participate",
        })
        .to_owned()
}

fn valid_slug(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 140
        && value.bytes().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == b'-'
        })
}

fn evidence_claim(row: &TrailEvidenceRow) -> String {
    if row.independent_check && row.evidence_type == "explain" {
        return "independent_explanation_attempt".to_owned();
    }
    if row.independent_check && row.evidence_type == "transfer" {
        return "independent_transfer_attempt".to_owned();
    }
    if row.evidence_type == "retrieve"
        && row.outcome == "correct"
        && row.assistance_level == "independent"
    {
        return "independent_recall".to_owned();
    }
    match row.evidence_type.as_str() {
        "apply" => "application_attempt",
        "explain" => "explanation_attempt",
        "participate" => "participation",
        "reflect" => "reflection",
        "retrieve" => "retrieval_attempt",
        "review" => "review",
        "transfer" => "transfer_attempt",
        _ => "learning_encounter",
    }
    .to_owned()
}

fn string_array(value: Option<Value>) -> Vec<String> {
    value
        .and_then(|value| value.as_array().cloned())
        .unwrap_or_default()
        .into_iter()
        .filter_map(|value| value.as_str().map(str::to_owned))
        .collect()
}

fn source_references(value: Option<Value>) -> Vec<LearnerCompetenceSource> {
    value
        .and_then(|value| value.as_array().cloned())
        .unwrap_or_default()
        .into_iter()
        .filter_map(|value| {
            let value = value.as_object()?;
            Some(LearnerCompetenceSource {
                anchor: optional_text(value.get("anchor")),
                concepts: string_array(value.get("concepts").cloned()),
                excerpt: optional_text(value.get("excerpt")),
                published_at: optional_text(value.get("publishedAt")),
                publisher: optional_text(value.get("publisher")),
                rights: optional_text(value.get("rights")),
                title: value.get("title")?.as_str()?.to_owned(),
                url: value.get("url")?.as_str()?.to_owned(),
            })
        })
        .collect()
}

fn optional_text(value: Option<&Value>) -> Option<String> {
    value.and_then(Value::as_str).map(str::to_owned)
}

fn map_href(slug: &str) -> String {
    format!("/world?map={slug}")
}

fn topic_href(slug: &str) -> String {
    format!("/topics/{slug}")
}

async fn load_header(pool: &PgPool, topic_slug: &str) -> Result<Option<HeaderRow>, sqlx::Error> {
    sqlx::query_as::<_, HeaderRow>(
        "SELECT topics.area_id, areas.slug AS area_slug, areas.title AS area_title, topics.content, topics.description, topics.id, parents.slug AS parent_slug, parents.title AS parent_title, topics.slug, topics.title FROM learning_topics AS topics INNER JOIN learning_topic_areas AS areas ON areas.id = topics.area_id LEFT JOIN learning_topics AS parents ON parents.id = topics.parent_id WHERE topics.slug = $1 AND topics.published_at IS NOT NULL",
    )
    .bind(topic_slug)
    .fetch_optional(pool)
    .await
}

fn pagination(requested_page: i64, total: i64, per_page: i64) -> LearnerTopicPagination {
    let last_page = (total + per_page - 1).div_euclid(per_page).max(1);

    LearnerTopicPagination {
        current_page: if total > 0 {
            requested_page.min(last_page)
        } else {
            requested_page
        },
        last_page,
        per_page,
        total,
    }
}

impl From<HeaderRow> for LearnerTopicDetailHeader {
    fn from(row: HeaderRow) -> Self {
        Self {
            area_slug: row.area_slug,
            area_title: row.area_title,
            content: row.content,
            description: row.description,
            parent: row
                .parent_slug
                .zip(row.parent_title)
                .map(|(slug, title)| LearnerTopicParent {
                    href: topic_href(&slug),
                    slug,
                    title,
                }),
            slug: row.slug,
            title: row.title,
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{configured_learning_areas, pagination};

    #[test]
    fn detail_pagination_clamps_only_nonempty_overflow_pages() {
        assert_eq!(pagination(8, 5, 4).current_page, 2);
        assert_eq!(pagination(8, 0, 4).current_page, 8);
    }

    #[test]
    fn trail_learning_areas_keep_only_bounded_unique_source_topics() {
        assert_eq!(
            configured_learning_areas(&json!({
                "competenceTopics": [
                    { "topic": " Orientation ", "slug": "orientation" },
                    { "topic": "Another name", "slug": "orientation" },
                    { "topic": "Ignored", "slug": "not A slug" },
                    { "topic": "", "slug": "empty" }
                ]
            })),
            vec![("orientation".to_owned(), "Orientation".to_owned())]
        );
    }
}
