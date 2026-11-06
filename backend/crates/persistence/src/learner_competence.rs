use std::collections::HashMap;

use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_competence::{
    LearnerCompetenceReadError, LearnerCompetenceRepository as LearnerCompetenceRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearnerCompetenceCheckIn, LearnerCompetenceEvidence, LearnerCompetenceMap,
        LearnerCompetenceReviewAttempt, LearnerCompetenceSource, LearnerCompetenceTopic,
        LearnerCompetenceTransition, LearnerCompetenceVisual,
    },
};

const EVIDENCE_PER_TOPIC: i64 = 12;
const RECENT_WINDOW_DAYS: i16 = 30;
const TOPIC_LIMIT: i64 = 100;
const TRANSITION_LIMIT: i64 = 1_000;
const CHECK_IN_LIMIT: i64 = 30;
const REVIEW_ATTEMPT_LIMIT: i64 = 12;

pub struct PostgresLearnerCompetenceRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerCompetenceRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct TopicRow {
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
struct EvidenceRow {
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

#[derive(FromRow)]
struct TransitionRow {
    count: i32,
    from_topic_name: String,
    from_topic_slug: String,
    to_topic_name: String,
    to_topic_slug: String,
}

#[derive(FromRow)]
struct CheckInRow {
    activity_slug: String,
    activity_title: String,
    feeling: Option<String>,
    map_slug: String,
    node_slug: String,
    node_title: String,
    note: Option<String>,
    recorded_at: String,
}

#[derive(FromRow)]
struct ReviewAttemptRow {
    activity_slug: String,
    activity_title: String,
    attempted_at: String,
    attempt_number: i32,
    confidence: Option<String>,
    confidence_after_feedback: Option<String>,
    node_slug: String,
    node_title: String,
    outcome: Option<String>,
    revisit_reason: String,
}

impl LearnerCompetenceRepositoryPort for PostgresLearnerCompetenceRepository<'_> {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerCompetenceMap>, LearnerCompetenceReadError>,
    > + Send {
        async move {
            load(self.pool, principal).await.map_err(|error| {
                tracing::error!(%error, "could not load learner competence map");
                LearnerCompetenceReadError
            })
        }
    }
}

async fn load(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<Option<LearnerCompetenceMap>, sqlx::Error> {
    let principal_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(pool)
    .await?;
    let Some(principal_id) = principal_id else {
        return Ok(None);
    };
    let month_key =
        sqlx::query_scalar::<_, String>("SELECT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')")
            .fetch_one(pool)
            .await?;
    let topic_rows = sqlx::query_as::<_, TopicRow>(
        "WITH learner_events AS (SELECT * FROM learner_evidence_events WHERE principal_id = $1), latest_names AS (SELECT DISTINCT ON (topic_slug) topic_slug, topic_name FROM learner_events ORDER BY topic_slug, created_at DESC, id DESC) SELECT events.topic_slug AS slug, COALESCE(definitions.name, latest_names.topic_name) AS name, SUM(events.contribution)::double precision AS total_signal, COALESCE(SUM(events.contribution) FILTER (WHERE events.created_at >= NOW() - INTERVAL '30 days'), 0)::double precision AS recent_signal, COALESCE(definitions.growth_threshold, 20)::double precision AS growth_threshold, COALESCE(definitions.emittance_threshold, 20)::double precision AS brightness_threshold, COALESCE(definitions.aura_threshold, 10)::double precision AS aura_threshold, ARRAY(SELECT DISTINCT evidence_type FROM learner_events AS type_events WHERE type_events.topic_slug = events.topic_slug ORDER BY evidence_type) AS evidence_types, ARRAY(SELECT to_char(period, 'Mon YYYY') FROM (SELECT DISTINCT date_trunc('month', period_events.created_at AT TIME ZONE 'UTC') AS period FROM learner_events AS period_events WHERE period_events.topic_slug = events.topic_slug ORDER BY period DESC LIMIT 12) AS periods ORDER BY period ASC) AS learning_periods FROM learner_events AS events INNER JOIN latest_names ON latest_names.topic_slug = events.topic_slug LEFT JOIN competence_topic_definitions AS definitions ON definitions.slug = events.topic_slug AND definitions.is_active GROUP BY events.topic_slug, definitions.name, definitions.growth_threshold, definitions.emittance_threshold, definitions.aura_threshold, latest_names.topic_name ORDER BY total_signal DESC, events.topic_slug ASC LIMIT $2",
    )
    .bind(principal_id)
    .bind(TOPIC_LIMIT)
    .fetch_all(pool)
    .await?;
    let topic_slugs = topic_rows
        .iter()
        .map(|topic| topic.slug.clone())
        .collect::<Vec<_>>();
    let ledger = load_evidence_ledger(pool, principal_id, &topic_slugs).await?;
    let transitions = load_transitions(pool, principal_id, &topic_slugs).await?;
    let check_ins = load_check_ins(pool, principal_id, &principal.roles).await?;
    let review_attempts = load_review_attempts(pool, principal_id, &principal.roles).await?;

    Ok(Some(LearnerCompetenceMap {
        check_ins,
        month_key,
        recent_window_days: RECENT_WINDOW_DAYS,
        review_attempts,
        topics: topic_rows
            .into_iter()
            .map(|topic| LearnerCompetenceTopic {
                name: topic.name,
                slug: topic.slug.clone(),
                visual: visual_for_topic(
                    topic.total_signal,
                    topic.recent_signal,
                    topic.growth_threshold,
                    topic.brightness_threshold,
                    topic.aura_threshold,
                    topic.evidence_types,
                    topic.learning_periods,
                    ledger.get(&topic.slug).cloned().unwrap_or_default(),
                ),
            })
            .collect(),
        transitions,
    }))
}

async fn load_check_ins(
    pool: &PgPool,
    principal_id: Uuid,
    roles: &[String],
) -> Result<Vec<LearnerCompetenceCheckIn>, sqlx::Error> {
    let rows = sqlx::query_as::<_, CheckInRow>("SELECT activities.slug AS activity_slug, activities.title AS activity_title, check_ins.feeling, maps.slug AS map_slug, nodes.slug AS node_slug, nodes.title AS node_title, check_ins.note, to_char(check_ins.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS recorded_at FROM learner_activity_check_ins AS check_ins INNER JOIN learning_activities AS activities ON activities.id = check_ins.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE check_ins.principal_id = $1 AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) ORDER BY check_ins.recorded_at DESC, check_ins.id DESC LIMIT $3")
        .bind(principal_id).bind(roles).bind(CHECK_IN_LIMIT).fetch_all(pool).await?;
    Ok(rows
        .into_iter()
        .map(|row| LearnerCompetenceCheckIn {
            activity_slug: row.activity_slug,
            activity_title: row.activity_title,
            feeling: row.feeling,
            map_slug: row.map_slug,
            node_slug: row.node_slug,
            node_title: row.node_title,
            note: row.note,
            recorded_at: row.recorded_at,
        })
        .collect())
}

async fn load_review_attempts(
    pool: &PgPool,
    principal_id: Uuid,
    roles: &[String],
) -> Result<Vec<LearnerCompetenceReviewAttempt>, sqlx::Error> {
    let rows = sqlx::query_as::<_, ReviewAttemptRow>("SELECT activities.slug AS activity_slug, activities.title AS activity_title, to_char(attempts.attempted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS attempted_at, attempts.attempt_number, attempts.confidence, attempts.confidence_after_feedback, nodes.slug AS node_slug, nodes.title AS node_title, attempts.outcome, attempts.revisit_reason FROM learner_review_attempts AS attempts INNER JOIN learning_activities AS activities ON activities.id = attempts.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE attempts.principal_id = $1 AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) ORDER BY attempts.attempted_at DESC, attempts.id DESC LIMIT $3")
        .bind(principal_id).bind(roles).bind(REVIEW_ATTEMPT_LIMIT).fetch_all(pool).await?;
    Ok(rows
        .into_iter()
        .map(|row| LearnerCompetenceReviewAttempt {
            activity_slug: row.activity_slug,
            activity_title: row.activity_title,
            attempted_at: row.attempted_at,
            attempt_number: row.attempt_number,
            confidence: row.confidence,
            confidence_after_feedback: row.confidence_after_feedback,
            node_slug: row.node_slug,
            node_title: row.node_title,
            outcome: row.outcome,
            revisit_reason: row.revisit_reason,
        })
        .collect())
}

async fn load_evidence_ledger(
    pool: &PgPool,
    principal_id: Uuid,
    topic_slugs: &[String],
) -> Result<HashMap<String, Vec<LearnerCompetenceEvidence>>, sqlx::Error> {
    if topic_slugs.is_empty() {
        return Ok(HashMap::new());
    }
    let rows = sqlx::query_as::<_, EvidenceRow>(
        "WITH ranked_events AS (SELECT events.*, ROW_NUMBER() OVER (PARTITION BY events.topic_slug ORDER BY events.created_at DESC, events.id DESC) AS topic_position FROM learner_evidence_events AS events WHERE events.principal_id = $1 AND events.topic_slug = ANY($2)) SELECT ranked_events.id, ranked_events.topic_slug, activities.title AS activity_title, ranked_events.assistance_level, ranked_events.attempt_number, ranked_events.concepts, ranked_events.confidence, ranked_events.confidence_after_feedback, ranked_events.evidence_criterion, ranked_events.evidence_rubric, ranked_events.evidence_type, ranked_events.is_independent_check AS independent_check, ranked_events.learning_purpose, NULL::text AS node_title, ranked_events.objective, ranked_events.observed_cues, ranked_events.outcome, to_char(ranked_events.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS recorded_at, ranked_events.source_references FROM ranked_events INNER JOIN learning_activities AS activities ON activities.id = ranked_events.activity_id WHERE ranked_events.topic_position <= $3 ORDER BY ranked_events.topic_slug ASC, ranked_events.created_at DESC, ranked_events.id DESC",
    )
    .bind(principal_id)
    .bind(topic_slugs)
    .bind(EVIDENCE_PER_TOPIC)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().fold(HashMap::new(), |mut ledger, row| {
        let claim = evidence_claim(&row);
        ledger
            .entry(row.topic_slug.clone())
            .or_default()
            .push(LearnerCompetenceEvidence {
                activity_title: row.activity_title,
                assistance_level: assistance_level(&row.assistance_level),
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

async fn load_transitions(
    pool: &PgPool,
    principal_id: Uuid,
    topic_slugs: &[String],
) -> Result<Vec<LearnerCompetenceTransition>, sqlx::Error> {
    if topic_slugs.is_empty() {
        return Ok(Vec::new());
    }
    let rows = sqlx::query_as::<_, TransitionRow>(
        "SELECT transition_count AS count, from_topic_name, from_topic_slug, to_topic_name, to_topic_slug FROM learner_competence_topic_transitions WHERE principal_id = $1 AND from_topic_slug = ANY($2) AND to_topic_slug = ANY($2) AND transition_count > 0 ORDER BY transition_count DESC, from_topic_slug ASC, to_topic_slug ASC LIMIT $3",
    )
    .bind(principal_id)
    .bind(topic_slugs)
    .bind(TRANSITION_LIMIT)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| LearnerCompetenceTransition {
            count: row.count,
            from_topic_name: row.from_topic_name,
            from_topic_slug: row.from_topic_slug,
            to_topic_name: row.to_topic_name,
            to_topic_slug: row.to_topic_slug,
        })
        .collect())
}

pub(crate) fn visual_for_topic(
    total_signal: f64,
    recent_signal: f64,
    growth_threshold: f64,
    brightness_threshold: f64,
    aura_threshold: f64,
    evidence_types: Vec<String>,
    learning_periods: Vec<String>,
    evidence_ledger: Vec<LearnerCompetenceEvidence>,
) -> LearnerCompetenceVisual {
    let size_ratio = ratio(total_signal, growth_threshold);
    let brightness_ratio = ratio(recent_signal, brightness_threshold);
    let aura_ratio = ratio(recent_signal, aura_threshold);
    let size_tier = if size_ratio >= 1.0 {
        "constellation"
    } else if size_ratio >= 2.0 / 3.0 {
        "beacon"
    } else if size_ratio >= 0.34 {
        "star"
    } else {
        "spark"
    };
    let description = match size_tier {
        "constellation" => "A strong, well-established light.",
        "beacon" => "A well-established light.",
        "star" => "A growing light.",
        _ => "A newly emerging light.",
    };
    let recent_description = if aura_ratio >= 1.0 {
        "Recent learning moments are strongly lighting this area."
    } else if aura_ratio >= 0.5 {
        "Recent learning moments are gently lighting this area."
    } else if aura_ratio > 0.0 {
        "A recent learning moment is gently lighting this area."
    } else {
        "The glow is resting for now; the established pattern remains."
    };

    LearnerCompetenceVisual {
        aura_ratio,
        brightness_ratio,
        description: description.to_owned(),
        evidence_ledger,
        evidence_types,
        learning_periods,
        recent_description: recent_description.to_owned(),
        size_ratio,
        size_tier: size_tier.to_owned(),
    }
}

fn ratio(value: f64, threshold: f64) -> f64 {
    if value <= 0.0 || threshold <= 0.0 {
        return 0.0;
    }
    ((value / threshold).min(1.0) * 10_000.0).round() / 10_000.0
}

fn assistance_level(value: &str) -> Option<String> {
    (value != "untracked" && !value.is_empty()).then(|| value.to_owned())
}

fn evidence_claim(row: &EvidenceRow) -> String {
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

#[cfg(test)]
mod tests {
    use super::visual_for_topic;

    #[test]
    fn visual_ratios_remain_qualitative_and_match_the_source_thresholds() {
        let visual = visual_for_topic(8.0, 5.0, 12.0, 16.0, 6.0, vec![], vec![], vec![]);

        assert_eq!(visual.size_ratio, 0.6667);
        assert_eq!(visual.brightness_ratio, 0.3125);
        assert_eq!(visual.aura_ratio, 0.8333);
        assert_eq!(visual.size_tier, "beacon");
        assert_eq!(visual.description, "A well-established light.");
        assert_eq!(
            visual.recent_description,
            "Recent learning moments are gently lighting this area."
        );
    }
}
