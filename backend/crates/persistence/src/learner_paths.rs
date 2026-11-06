use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_paths::{
    LearnerPathsReadError, LearnerPathsRepository as LearnerPathsRepositoryPort,
    LearnerPathsRequest,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearnerPathLearningArea, LearnerPathPagination, LearnerPathProgress, LearnerPathSummary,
        LearnerPathTopic, LearnerPaths, LearnerTopicDetailHeader, LearnerTopicParent,
    },
};

use crate::learner_node_availability::PostgresLearnerNodeAvailability;

const PATHS_PER_PAGE: i64 = 6;
const PATH_SCAN_CHUNK_SIZE: i64 = 100;

pub struct PostgresLearnerPathsRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerPathsRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct PathRow {
    activity_config: Value,
    activity_title: String,
    activity_type: String,
    current_activity_title: Option<String>,
    description: String,
    image_url: Option<String>,
    label: String,
    last_entered_at: Option<String>,
    map_slug: String,
    map_title: String,
    node_id: Uuid,
    node_slug: String,
    node_state: String,
    node_title: String,
    node_visual_config: Value,
    progress_status: Option<String>,
    route_description: String,
    start_id: Uuid,
    time_guide_minutes: Option<i16>,
    topic_slug: Option<String>,
    topic_title: Option<String>,
}

#[derive(FromRow)]
struct TopicContextRow {
    area_slug: String,
    area_title: String,
    content: Option<String>,
    description: Option<String>,
    parent_slug: Option<String>,
    parent_title: Option<String>,
    slug: String,
    title: String,
}

impl LearnerPathsRepositoryPort for PostgresLearnerPathsRepository<'_> {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerPathsRequest,
    ) -> impl std::future::Future<Output = Result<LearnerPaths, LearnerPathsReadError>> + Send {
        async move {
            load_paths(self.pool, principal, request)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load learner paths");
                    LearnerPathsReadError
                })
        }
    }
}

async fn load_paths(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    request: &LearnerPathsRequest,
) -> Result<LearnerPaths, sqlx::Error> {
    let topic_context = match request.topic_slug.as_deref() {
        Some(topic_slug) => load_topic_context(pool, topic_slug).await?,
        None => None,
    };
    let Some(availability) = PostgresLearnerNodeAvailability::load(pool, principal).await? else {
        return Ok(empty_paths(request, topic_context));
    };
    let (mut rows, total) =
        scan_paths(pool, &availability, principal, request, request.page).await?;
    let pagination = pagination(request.page, total);
    if pagination.current_page != request.page {
        (rows, _) = scan_paths(
            pool,
            &availability,
            principal,
            request,
            pagination.current_page,
        )
        .await?;
    }

    Ok(LearnerPaths {
        pagination,
        paths: rows.into_iter().map(Into::into).collect(),
        selected_purpose: request.purpose.clone(),
        selected_time_budget: request.time_budget,
        topic_context,
    })
}

fn empty_paths(
    request: &LearnerPathsRequest,
    topic_context: Option<LearnerTopicDetailHeader>,
) -> LearnerPaths {
    LearnerPaths {
        pagination: pagination(request.page, 0),
        paths: Vec::new(),
        selected_purpose: request.purpose.clone(),
        selected_time_budget: request.time_budget,
        topic_context,
    }
}

async fn scan_paths(
    pool: &PgPool,
    availability: &PostgresLearnerNodeAvailability,
    principal: &AuthorizedPrincipal,
    request: &LearnerPathsRequest,
    page: i64,
) -> Result<(Vec<PathRow>, i64), sqlx::Error> {
    let first_match = (page - 1) * PATHS_PER_PAGE;
    let mut candidate_offset = 0;
    let mut paths = Vec::with_capacity(PATHS_PER_PAGE as usize);
    let mut total = 0;

    loop {
        let candidates = sqlx::query_as::<_, PathRow>(PATH_CANDIDATE_SQL)
            .bind(availability.principal_id())
            .bind(&principal.roles)
            .bind(&request.topic_slug)
            .bind(&request.purpose)
            .bind(request.time_budget)
            .bind(PATH_SCAN_CHUNK_SIZE)
            .bind(candidate_offset)
            .fetch_all(pool)
            .await?;
        let candidate_count = candidates.len();

        for candidate in candidates {
            if !availability
                .state_for_node(
                    candidate.node_id,
                    &candidate.node_state,
                    &candidate.node_visual_config,
                )
                .can_play()
            {
                continue;
            }
            if total >= first_match && paths.len() < PATHS_PER_PAGE as usize {
                paths.push(candidate);
            }
            total += 1;
        }

        if candidate_count < PATH_SCAN_CHUNK_SIZE as usize {
            break;
        }
        candidate_offset += PATH_SCAN_CHUNK_SIZE;
    }

    Ok((paths, total))
}

async fn load_topic_context(
    pool: &PgPool,
    topic_slug: &str,
) -> Result<Option<LearnerTopicDetailHeader>, sqlx::Error> {
    let row = sqlx::query_as::<_, TopicContextRow>(
        "SELECT areas.slug AS area_slug, areas.title AS area_title, topics.content, topics.description, parents.slug AS parent_slug, parents.title AS parent_title, topics.slug, topics.title FROM learning_topics AS topics INNER JOIN learning_topic_areas AS areas ON areas.id = topics.area_id LEFT JOIN learning_topics AS parents ON parents.id = topics.parent_id WHERE topics.slug = $1 AND topics.published_at IS NOT NULL",
    )
    .bind(topic_slug)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|row| LearnerTopicDetailHeader {
        area_slug: row.area_slug,
        area_title: row.area_title,
        content: row.content,
        description: row.description,
        parent: row
            .parent_slug
            .zip(row.parent_title)
            .map(|(slug, title)| LearnerTopicParent {
                href: format!("/topics/{slug}"),
                slug,
                title,
            }),
        slug: row.slug,
        title: row.title,
    }))
}

const PATH_CANDIDATE_SQL: &str = r#"
SELECT activities.activity_config, activities.title AS activity_title, activities.activity_type,
  current_activities.title AS current_activity_title,
  COALESCE(NULLIF(activities.description, ''), nodes.description) AS description,
  assets.image_url, COALESCE(starts.label, activities.title) AS label,
  to_char(progress.last_entered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS last_entered_at,
  maps.slug AS map_slug, maps.title AS map_title, nodes.id AS node_id, nodes.slug AS node_slug, nodes.state AS node_state, nodes.title AS node_title, nodes.visual_config AS node_visual_config,
  progress.status AS progress_status, routes.description AS route_description, starts.id AS start_id,
  CASE WHEN activities.activity_config->>'timeGuideMinutes' ~ '^[1-9][0-9]*$' THEN (activities.activity_config->>'timeGuideMinutes')::smallint ELSE NULL END AS time_guide_minutes,
  topics.slug AS topic_slug, topics.title AS topic_title
FROM learning_activity_starts AS starts
INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id
INNER JOIN learning_activities AS activities ON activities.id = starts.activity_id
INNER JOIN learning_routes AS routes ON routes.id = activities.route_id
INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id
INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id
LEFT JOIN learning_topics AS topics ON topics.id = maps.topic_id
LEFT JOIN learner_route_progress AS progress ON progress.principal_id = $1 AND progress.activity_start_id = starts.id
LEFT JOIN learning_activities AS current_activities ON current_activities.id = progress.current_activity_id
WHERE nodes.map_asset_id = assets.id
  AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL
  AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL
  AND activities.published_at IS NOT NULL
  AND NOT (nodes.visual_config @> '{"hideEmptySpace": true}'::jsonb)
  AND (activities.activity_type <> 'portal' OR COALESCE(activities.activity_config->>'portalMode', 'output') <> 'input')
  AND (maps.access_roles @> '["public"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2)))
  AND ($3::text IS NULL OR topics.slug = $3)
  AND ($4::text IS NULL OR CASE
      WHEN activities.activity_config->>'learningIntent' IN ('apply', 'explain', 'participate', 'reflect', 'retrieve', 'review', 'transfer') THEN activities.activity_config->>'learningIntent'
      WHEN activities.activity_type = 'question' THEN 'retrieve'
      WHEN activities.activity_type = 'reflection' THEN 'reflect'
      WHEN activities.activity_type = 'review' THEN 'review'
      WHEN activities.activity_type IN ('shared_task', 'message_prompt', 'message_wall') THEN 'explain'
      WHEN activities.activity_type IN ('obstacle', 'item_obstacle', 'tool_obstacle') THEN 'apply'
      ELSE 'participate' END = $4)
  AND ($5::smallint IS NULL OR CASE WHEN activities.activity_config->>'timeGuideMinutes' ~ '^[1-9][0-9]*$' THEN (activities.activity_config->>'timeGuideMinutes')::integer ELSE NULL END <= $5)
ORDER BY nodes.id ASC, starts.sort_order ASC, starts.id ASC LIMIT $6 OFFSET $7
"#;

fn pagination(requested_page: i64, total: i64) -> LearnerPathPagination {
    let last_page = (total + PATHS_PER_PAGE - 1)
        .div_euclid(PATHS_PER_PAGE)
        .max(1);
    LearnerPathPagination {
        current_page: if total > 0 {
            requested_page.min(last_page)
        } else {
            requested_page
        },
        last_page,
        per_page: PATHS_PER_PAGE,
        total,
    }
}

impl From<PathRow> for LearnerPathSummary {
    fn from(row: PathRow) -> Self {
        Self {
            activity_title: row.activity_title,
            activity_type: row.activity_type.clone(),
            description: row.description,
            image_url: row.image_url,
            label: row.label,
            learning_areas: learning_areas(&row.activity_config),
            learning_intent: learning_intent(&row.activity_type, &row.activity_config),
            map_href: format!("/world?map={}", row.map_slug),
            map_title: row.map_title,
            node_href: format!("/world?map={}&focused={}", row.map_slug, row.node_slug),
            node_slug: row.node_slug,
            node_title: row.node_title,
            progress: row.progress_status.map(|status| LearnerPathProgress {
                current_activity_title: row.current_activity_title,
                last_entered_at: row.last_entered_at,
                status,
            }),
            route_description: (!row.route_description.is_empty()).then_some(row.route_description),
            start_id: row.start_id.to_string(),
            time_guide_minutes: row.time_guide_minutes,
            topic: row
                .topic_slug
                .zip(row.topic_title)
                .map(|(slug, title)| LearnerPathTopic {
                    href: format!("/topics/{slug}"),
                    slug,
                    title,
                }),
        }
    }
}

pub(crate) fn learning_intent(activity_type: &str, config: &Value) -> String {
    config
        .get("learningIntent")
        .and_then(Value::as_str)
        .filter(|value| {
            matches!(
                *value,
                "apply"
                    | "explain"
                    | "participate"
                    | "reflect"
                    | "retrieve"
                    | "review"
                    | "transfer"
            )
        })
        .map(str::to_owned)
        .unwrap_or_else(|| {
            match activity_type {
                "question" => "retrieve",
                "reflection" => "reflect",
                "review" => "review",
                "shared_task" | "message_prompt" | "message_wall" => "explain",
                "obstacle" | "item_obstacle" | "tool_obstacle" => "apply",
                _ => "participate",
            }
            .to_owned()
        })
}

pub(crate) fn time_guide_minutes(config: &Value) -> Option<i16> {
    config
        .get("timeGuideMinutes")
        .and_then(Value::as_i64)
        .and_then(|value| i16::try_from(value).ok())
        .filter(|value| *value > 0)
}

pub(crate) fn learning_areas(config: &Value) -> Vec<LearnerPathLearningArea> {
    config
        .get("competenceTopics")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .take(20)
        .filter_map(|entry| {
            let name = entry.get("topic")?.as_str()?.trim();
            let slug = entry.get("slug")?.as_str()?.trim();
            (!name.is_empty() && valid_slug(slug)).then(|| LearnerPathLearningArea {
                name: name.to_owned(),
                slug: slug.to_owned(),
            })
        })
        .collect()
}

fn valid_slug(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 140
        && value.bytes().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == b'-'
        })
}

#[cfg(test)]
mod tests {
    use super::{learning_areas, learning_intent, pagination, time_guide_minutes};
    use serde_json::json;

    #[test]
    fn source_activity_defaults_and_authored_learning_areas_are_projected() {
        assert_eq!(learning_intent("question", &json!({})), "retrieve");
        assert_eq!(
            learning_intent("portal", &json!({ "learningIntent": "transfer" })),
            "transfer"
        );
        assert_eq!(
            learning_areas(
                &json!({ "competenceTopics": [{ "topic": "Orientation", "slug": "orientation" }, { "topic": "", "slug": "ignored" }] })
            ),
            vec![
                wicked_learning_domain::learner_state::LearnerPathLearningArea {
                    name: "Orientation".to_owned(),
                    slug: "orientation".to_owned()
                }
            ]
        );
        assert_eq!(pagination(9, 1).current_page, 1);
        assert_eq!(
            time_guide_minutes(&json!({ "timeGuideMinutes": 15 })),
            Some(15)
        );
        assert_eq!(time_guide_minutes(&json!({ "timeGuideMinutes": 0 })), None);
        assert_eq!(
            time_guide_minutes(&json!({ "timeGuideMinutes": "15" })),
            None
        );
    }
}
