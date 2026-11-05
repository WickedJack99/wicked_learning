use serde::Deserialize;
use serde_json::json;
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_playback::{
    LearnerPlaybackCompletionError,
    LearnerPlaybackCompletionRepository as LearnerPlaybackCompletionRepositoryPort,
    LearnerPlaybackReadError, LearnerPlaybackRepository as LearnerPlaybackRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearnerPlaybackActivity, LearnerPlaybackCheckIn, LearnerPlaybackCompletion,
        LearnerPlaybackCompletionResult, LearnerPlaybackContext, LearnerPlaybackDocument,
        LearnerPlaybackLearningArea, LearnerPlaybackRunKind,
    },
};

use crate::{
    learner_evidence::{CompletionEvidence, record_completion_evidence, record_topic_visit},
    learner_revisit_completion::{RevisitCompletion, complete_active_revisit},
    learner_tool_grant::configured_tool_slug,
};

pub struct PostgresLearnerPlaybackRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerPlaybackRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct PlaybackRow {
    activity_config: serde_json::Value,
    activity_slug: String,
    activity_type: String,
    description: String,
    map_slug: String,
    map_title: String,
    next_activity_slug: Option<String>,
    node_slug: String,
    node_title: String,
    principal_id: Uuid,
    route_label: Option<String>,
    run_kind: String,
    start_id: Option<Uuid>,
    title: String,
    transition_label: Option<String>,
}

#[derive(FromRow)]
struct CurrentActivityRow {
    activity_config: serde_json::Value,
    activity_id: Uuid,
    activity_type: String,
    is_revisit: bool,
    principal_id: Uuid,
    route_id: Uuid,
}

#[derive(FromRow)]
struct CompletionTransitionRow {
    to_activity_id: Option<Uuid>,
}

#[derive(FromRow)]
struct ToolPlaybackRow {
    animation_dark: Option<String>,
    animation_light: Option<String>,
    config: serde_json::Value,
    description: Option<String>,
    image_dark: Option<String>,
    image_light: Option<String>,
    slug: String,
    title: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuestionPlaybackConfig {
    allow_multiple: bool,
    options: Vec<QuestionPlaybackOption>,
    prompt: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuestionPlaybackOption {
    body: String,
    key: String,
    label: String,
}

#[derive(Deserialize)]
struct ReflectionPlaybackConfig {
    note: Option<String>,
    prompt: String,
}

fn learner_safe_config(
    activity_type: &str,
    config: serde_json::Value,
) -> Option<serde_json::Value> {
    match activity_type {
        "open_practice" => Some(config),
        "question" => {
            let config = serde_json::from_value::<QuestionPlaybackConfig>(config).ok()?;
            if config.prompt.trim().is_empty()
                || config.options.is_empty()
                || config.options.iter().any(|option| {
                    option.key.trim().is_empty()
                        || option.label.trim().is_empty()
                        || option.body.trim().is_empty()
                })
            {
                return None;
            }
            Some(json!({
                "allowMultiple": config.allow_multiple,
                "prompt": config.prompt,
                "options": config.options.into_iter().map(|option| json!({
                    "key": option.key,
                    "label": option.label,
                    "body": option.body,
                })).collect::<Vec<_>>(),
            }))
        }
        "reflection" => {
            let config = serde_json::from_value::<ReflectionPlaybackConfig>(config).ok()?;
            if config.prompt.trim().is_empty()
                || config.prompt.chars().count() > 2_000
                || config
                    .note
                    .as_deref()
                    .is_some_and(|note| note.chars().count() > 2_000)
            {
                return None;
            }
            Some(json!({
                "note": config.note,
                "prompt": config.prompt,
            }))
        }
        "tool_grant" => tool_grant_safe_config(config),
        _ => None,
    }
}

fn tool_grant_safe_config(config: serde_json::Value) -> Option<serde_json::Value> {
    let tool_id = configured_tool_slug(&config)?.to_owned();
    let object = config.as_object()?;
    let text = optional_bounded_config_text(object, "text", 2_000)?.unwrap_or_default();
    let slide_direction = object
        .get("slideDirection")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("left");
    if !matches!(
        slide_direction,
        "left" | "right" | "top" | "bottom" | "none"
    ) {
        return None;
    }
    let colors = [
        ("bubbleBorderColorDark", "#2dd4bf"),
        ("bubbleBorderColorLight", "#0891b2"),
        ("bubbleColorDark", "#0f172a"),
        ("bubbleColorLight", "#ffffff"),
    ]
    .into_iter()
    .map(|(name, fallback)| {
        let value = object
            .get(name)
            .and_then(serde_json::Value::as_str)
            .unwrap_or(fallback);
        valid_hex_color(value).then_some((name, value))
    })
    .collect::<Option<Vec<_>>>()?;

    Some(json!({
        "backgroundDark": optional_bounded_config_text(object, "backgroundDark", 2_048)?,
        "backgroundLight": optional_bounded_config_text(object, "backgroundLight", 2_048)?,
        "backgroundMirrored": object.get("backgroundMirrored").and_then(serde_json::Value::as_bool).unwrap_or(false),
        "bubbleBorderColorDark": colors[0].1,
        "bubbleBorderColorLight": colors[1].1,
        "bubbleColorDark": colors[2].1,
        "bubbleColorLight": colors[3].1,
        "bubbleOpacityDark": bounded_config_number(object, "bubbleOpacityDark", 92.0, 0.0, 100.0)?,
        "bubbleOpacityLight": bounded_config_number(object, "bubbleOpacityLight", 94.0, 0.0, 100.0)?,
        "fadeDurationSeconds": bounded_config_number(object, "fadeDurationSeconds", 0.4, 0.0, 30.0)?,
        "slideDirection": slide_direction,
        "slideDurationSeconds": bounded_config_number(object, "slideDurationSeconds", 0.6, 0.0, 30.0)?,
        "text": text,
        "toolId": tool_id,
        "toolMirrored": object.get("toolMirrored").and_then(serde_json::Value::as_bool).unwrap_or(false),
        "toolX": bounded_config_number(object, "toolX", 50.0, 0.0, 100.0)?,
        "toolY": bounded_config_number(object, "toolY", 50.0, 0.0, 100.0)?,
        "typingSpeed": bounded_config_number(object, "typingSpeed", 24.0, 1.0, 250.0)?,
    }))
}

fn optional_bounded_config_text(
    object: &serde_json::Map<String, serde_json::Value>,
    name: &str,
    maximum_characters: usize,
) -> Option<Option<String>> {
    match object.get(name) {
        Some(value) => {
            let value = value.as_str()?;
            (value.chars().count() <= maximum_characters).then(|| Some(value.to_owned()))
        }
        None => Some(None),
    }
}

fn bounded_config_number(
    object: &serde_json::Map<String, serde_json::Value>,
    name: &str,
    fallback: f64,
    minimum: f64,
    maximum: f64,
) -> Option<f64> {
    let value = object
        .get(name)
        .map_or(Some(fallback), serde_json::Value::as_f64)?;
    (value.is_finite() && (minimum..=maximum).contains(&value)).then_some(value)
}

fn valid_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value
            .bytes()
            .skip(1)
            .all(|character| character.is_ascii_hexdigit())
}

async fn enrich_tool_grant_config(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    config: &mut serde_json::Value,
) -> Result<(), sqlx::Error> {
    let Some(tool_slug) = configured_tool_slug(config).map(str::to_owned) else {
        return Ok(());
    };
    let tool = sqlx::query_as::<_, ToolPlaybackRow>(
        "SELECT animation_dark, animation_light, config, description, image_dark, image_light, slug, title FROM learning_tools WHERE slug = $1",
    )
    .bind(&tool_slug)
    .fetch_optional(&mut **transaction)
    .await?;
    let owned = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learner_tools AS holdings INNER JOIN learning_tools AS tools ON tools.id = holdings.tool_id WHERE holdings.principal_id = $1 AND tools.slug = $2)",
    )
    .bind(principal_id)
    .bind(&tool_slug)
    .fetch_one(&mut **transaction)
    .await?;
    let Some(object) = config.as_object_mut() else {
        return Ok(());
    };
    object.insert("alreadyOwned".to_owned(), json!(owned));
    object.insert(
        "tool".to_owned(),
        tool.map(|tool| {
            json!({
                "animation_dark": tool.animation_dark,
                "animation_light": tool.animation_light,
                "config": tool.config,
                "description": tool.description,
                "image_dark": tool.image_dark,
                "image_light": tool.image_light,
                "slug": tool.slug,
                "title": tool.title,
            })
        })
        .unwrap_or(serde_json::Value::Null),
    );
    Ok(())
}

fn check_in_context(config: &serde_json::Value) -> LearnerPlaybackCheckIn {
    let object = config.as_object();
    let choice_prompt = object
        .and_then(|value| value.get("completionChoicePrompt"))
        .and_then(serde_json::Value::as_str)
        .and_then(|value| bounded_text(value, 600));
    let objective = object
        .and_then(|value| value.get("evidenceObjective"))
        .and_then(serde_json::Value::as_str)
        .and_then(|value| bounded_text(value, 600));
    let concepts = object
        .and_then(|value| value.get("evidenceConcepts"))
        .and_then(serde_json::Value::as_array)
        .map_or_else(Vec::new, |values| normalized_texts(values, 8, 120));
    let learning_areas = object
        .and_then(|value| value.get("competenceTopics"))
        .and_then(serde_json::Value::as_array)
        .map_or_else(Vec::new, |values| {
            values
                .iter()
                .take(3)
                .filter_map(|value| {
                    let value = value.as_object()?;
                    let name = value
                        .get("topic")
                        .and_then(serde_json::Value::as_str)
                        .and_then(|value| bounded_text(value, 120))?;
                    let slug = value
                        .get("slug")
                        .and_then(serde_json::Value::as_str)
                        .map(str::trim)
                        .filter(|value| valid_topic_slug(value))?;

                    Some(LearnerPlaybackLearningArea {
                        name,
                        slug: slug.to_owned(),
                    })
                })
                .fold(Vec::new(), |mut areas, area| {
                    if !areas
                        .iter()
                        .any(|existing: &LearnerPlaybackLearningArea| existing.slug == area.slug)
                    {
                        areas.push(area);
                    }

                    areas
                })
        });

    LearnerPlaybackCheckIn {
        choice_prompt,
        concepts,
        learning_areas,
        objective,
    }
}

fn normalized_texts(
    values: &[serde_json::Value],
    maximum_items: usize,
    maximum_characters: usize,
) -> Vec<String> {
    values
        .iter()
        .take(maximum_items)
        .filter_map(serde_json::Value::as_str)
        .filter_map(|value| bounded_text(value, maximum_characters))
        .fold(Vec::new(), |mut collected, value| {
            if !collected
                .iter()
                .any(|existing: &String| existing.eq_ignore_ascii_case(&value))
            {
                collected.push(value);
            }

            collected
        })
}

fn bounded_text(value: &str, maximum_characters: usize) -> Option<String> {
    let value = value.trim();

    (!value.is_empty()).then(|| value.chars().take(maximum_characters).collect())
}

fn valid_topic_slug(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 140
        && value.bytes().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == b'-'
        })
}

impl LearnerPlaybackRepositoryPort for PostgresLearnerPlaybackRepository<'_> {
    fn load_active_run(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerPlaybackDocument>, LearnerPlaybackReadError>,
    > + Send {
        async move {
            let mut transaction = self
                .pool
                .begin()
                .await
                .map_err(|_| LearnerPlaybackReadError)?;
            let row = sqlx::query_as::<_, PlaybackRow>(
                "SELECT progress.activity_start_id AS start_id, progress.principal_id, activities.slug AS activity_slug, activities.title, activities.description, activities.activity_type, activities.activity_config, maps.slug AS map_slug, maps.title AS map_title, nodes.slug AS node_slug, nodes.title AS node_title, COALESCE(starts.label, routes.title) AS route_label, 'route'::text AS run_kind, transition.label AS transition_label, next_activity.slug AS next_activity_slug FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id LEFT JOIN LATERAL (SELECT transitions.label, transitions.to_activity_id FROM learning_activity_transitions AS transitions WHERE transitions.from_activity_id = activities.id AND transitions.from_connector = 'completed' AND transitions.trigger = 'completed' ORDER BY transitions.created_at ASC, transitions.id ASC LIMIT 1) AS transition ON TRUE LEFT JOIN learning_activities AS next_activity ON next_activity.id = transition.to_activity_id WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND activities.activity_type IN ('open_practice', 'question', 'reflection', 'tool_grant') AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($3))) UNION ALL SELECT NULL::uuid AS start_id, runs.principal_id, activities.slug AS activity_slug, activities.title, activities.description, activities.activity_type, activities.activity_config, maps.slug AS map_slug, maps.title AS map_title, nodes.slug AS node_slug, nodes.title AS node_title, NULL::text AS route_label, 'revisit'::text AS run_kind, NULL::text AS transition_label, NULL::text AS next_activity_slug FROM learner_revisit_runs AS runs INNER JOIN application_principals AS principals ON principals.id = runs.principal_id INNER JOIN learner_activity_check_ins AS check_ins ON check_ins.id = runs.check_in_id AND check_ins.principal_id = runs.principal_id AND check_ins.activity_id = runs.activity_id INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND activities.activity_type IN ('open_practice', 'question', 'reflection') AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($3)))",
            )
            .bind(principal.subject_id)
            .bind(play_run_id)
            .bind(&principal.roles)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|_| LearnerPlaybackReadError)?;
            let Some(row) = row else {
                transaction
                    .commit()
                    .await
                    .map_err(|_| LearnerPlaybackReadError)?;
                return Ok(None);
            };
            let activity_config = row.activity_config.clone();
            let check_in = check_in_context(&activity_config);
            let Some(mut config) = learner_safe_config(&row.activity_type, row.activity_config)
            else {
                transaction
                    .commit()
                    .await
                    .map_err(|_| LearnerPlaybackReadError)?;
                return Ok(None);
            };
            if row.activity_type == "tool_grant" {
                enrich_tool_grant_config(&mut transaction, row.principal_id, &mut config)
                    .await
                    .map_err(|_| LearnerPlaybackReadError)?;
            }
            let run_kind = match row.run_kind.as_str() {
                "route" => LearnerPlaybackRunKind::Route,
                "revisit" => LearnerPlaybackRunKind::Revisit,
                _ => {
                    transaction
                        .commit()
                        .await
                        .map_err(|_| LearnerPlaybackReadError)?;
                    return Ok(None);
                }
            };
            record_topic_visit(
                &mut transaction,
                row.principal_id,
                &activity_config,
                &row.activity_type,
            )
            .await
            .map_err(|_| LearnerPlaybackReadError)?;
            transaction
                .commit()
                .await
                .map_err(|_| LearnerPlaybackReadError)?;

            Ok(Some(LearnerPlaybackDocument {
                start_id: row.start_id.map(|start_id| start_id.to_string()),
                play_run_id: play_run_id.to_string(),
                run_kind,
                context: LearnerPlaybackContext {
                    node_slug: row.node_slug,
                    node_title: row.node_title,
                    map_slug: row.map_slug,
                    map_title: row.map_title,
                    route_label: row.route_label,
                },
                activity: LearnerPlaybackActivity {
                    slug: row.activity_slug,
                    title: row.title,
                    description: row.description,
                    activity_type: row.activity_type,
                    config,
                    completion: LearnerPlaybackCompletion {
                        label: row.transition_label,
                        next_activity_slug: row.next_activity_slug,
                    },
                    check_in,
                },
            }))
        }
    }
}

impl LearnerPlaybackCompletionRepositoryPort for PostgresLearnerPlaybackRepository<'_> {
    fn complete_current_activity(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerPlaybackCompletionResult>, LearnerPlaybackCompletionError>,
    > + Send {
        async move {
            complete_current_activity(self.pool, principal, play_run_id, activity_slug)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not complete learner playback activity");
                    LearnerPlaybackCompletionError
                })
        }
    }
}

async fn complete_current_activity(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<LearnerPlaybackCompletionResult>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(current) =
        load_current_activity_for_update(&mut transaction, principal, play_run_id, activity_slug)
            .await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };

    if current.activity_type == "tool_grant"
        && !learner_owns_configured_tool(
            &mut transaction,
            current.principal_id,
            &current.activity_config,
        )
        .await?
    {
        transaction.commit().await?;
        return Ok(None);
    }

    if current.is_revisit {
        let Some(attempt_number) = complete_active_revisit(
            &mut transaction,
            RevisitCompletion {
                activity_id: current.activity_id,
                confidence: None,
                confidence_after_feedback: None,
                learner_reflection_id: None,
                outcome: "completed",
                play_run_id,
                principal_id: current.principal_id,
            },
        )
        .await?
        else {
            transaction.commit().await?;
            return Ok(None);
        };
        record_completion_evidence(
            &mut transaction,
            CompletionEvidence {
                activity_config: &current.activity_config,
                activity_id: current.activity_id,
                activity_type: &current.activity_type,
                assistance_level: "untracked",
                attempt_number,
                calibration: None,
                confidence: None,
                confidence_after_feedback: None,
                learner_reflection_id: None,
                outcome: "completed",
                play_run_id,
                principal_id: current.principal_id,
                reflection_response_type: None,
            },
        )
        .await?;
        transaction.commit().await?;

        return Ok(Some(LearnerPlaybackCompletionResult {
            play_run_id: play_run_id.to_string(),
            status: "completed".to_owned(),
        }));
    }

    let transition = sqlx::query_as::<_, CompletionTransitionRow>(
        "SELECT to_activity_id FROM learning_activity_transitions WHERE from_activity_id = $1 AND from_connector = 'completed' AND trigger = 'completed' ORDER BY created_at ASC, id ASC LIMIT 1",
    )
    .bind(current.activity_id)
    .fetch_optional(&mut *transaction)
    .await?;

    let next_activity_id = match transition.and_then(|transition| transition.to_activity_id) {
        Some(next_activity_id) => {
            let next_activity_id = sqlx::query_scalar::<_, Uuid>(
                "SELECT activities.id FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id WHERE activities.id = $1 AND routes.id = $2 AND activities.published_at IS NOT NULL AND activities.activity_type IN ('open_practice', 'question', 'reflection', 'tool_grant')",
            )
            .bind(next_activity_id)
            .bind(current.route_id)
            .fetch_optional(&mut *transaction)
            .await?;

            let Some(next_activity_id) = next_activity_id else {
                transaction.commit().await?;
                return Ok(None);
            };

            Some(next_activity_id)
        }
        None => None,
    };

    mark_activity_completed(&mut transaction, current.principal_id, current.activity_id).await?;
    record_completion_evidence(
        &mut transaction,
        CompletionEvidence {
            activity_config: &current.activity_config,
            activity_id: current.activity_id,
            activity_type: &current.activity_type,
            assistance_level: "untracked",
            attempt_number: 1,
            calibration: None,
            confidence: None,
            confidence_after_feedback: None,
            learner_reflection_id: None,
            outcome: "completed",
            play_run_id,
            principal_id: current.principal_id,
            reflection_response_type: None,
        },
    )
    .await?;

    let status = if let Some(next_activity_id) = next_activity_id {
        mark_activity_reached(&mut transaction, current.principal_id, next_activity_id).await?;
        sqlx::query(
            "UPDATE learner_route_progress SET current_activity_id = $3, status = 'in_progress', last_entered_at = NOW(), last_exited_at = NOW(), updated_at = NOW() WHERE principal_id = $1 AND current_play_run_id = $2",
        )
        .bind(current.principal_id)
        .bind(play_run_id)
        .bind(next_activity_id)
        .execute(&mut *transaction)
        .await?;

        "in_progress"
    } else {
        sqlx::query(
            "UPDATE learner_route_progress SET status = 'completed', completion_count = completion_count + 1, last_completed_at = NOW(), last_exited_at = NOW(), updated_at = NOW() WHERE principal_id = $1 AND current_play_run_id = $2",
        )
        .bind(current.principal_id)
        .bind(play_run_id)
        .execute(&mut *transaction)
        .await?;

        "completed"
    };

    transaction.commit().await?;

    Ok(Some(LearnerPlaybackCompletionResult {
        play_run_id: play_run_id.to_string(),
        status: status.to_owned(),
    }))
}

async fn load_current_activity_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<CurrentActivityRow>, sqlx::Error> {
    let route = sqlx::query_as::<_, CurrentActivityRow>(
        "SELECT activities.activity_config, activities.activity_type, progress.current_activity_id AS activity_id, FALSE AS is_revisit, progress.principal_id, routes.id AS route_id FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND activities.slug = $3 AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND activities.activity_type IN ('open_practice', 'tool_grant') AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF progress",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await?;
    if route.is_some() {
        return Ok(route);
    }

    sqlx::query_as::<_, CurrentActivityRow>(
        "SELECT activities.activity_config, activities.activity_type, activities.id AS activity_id, TRUE AS is_revisit, runs.principal_id, routes.id AS route_id FROM learner_revisit_runs AS runs INNER JOIN application_principals AS principals ON principals.id = runs.principal_id INNER JOIN learner_activity_check_ins AS check_ins ON check_ins.id = runs.check_in_id AND check_ins.principal_id = runs.principal_id AND check_ins.activity_id = runs.activity_id INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND activities.slug = $3 AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND activities.activity_type = 'open_practice' AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF runs",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await
}

async fn learner_owns_configured_tool(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    config: &serde_json::Value,
) -> Result<bool, sqlx::Error> {
    let Some(tool_slug) = configured_tool_slug(config) else {
        return Ok(false);
    };
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learner_tools AS holdings INNER JOIN learning_tools AS tools ON tools.id = holdings.tool_id WHERE holdings.principal_id = $1 AND tools.slug = $2)",
    )
    .bind(principal_id)
    .bind(tool_slug)
    .fetch_one(&mut **transaction)
    .await
}

async fn mark_activity_completed(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO learner_activity_progress (principal_id, activity_id, status, completed_at) VALUES ($1, $2, 'completed', NOW()) ON CONFLICT (principal_id, activity_id) DO UPDATE SET status = 'completed', completed_at = COALESCE(learner_activity_progress.completed_at, EXCLUDED.completed_at), updated_at = NOW()",
    )
    .bind(principal_id)
    .bind(activity_id)
    .execute(&mut **transaction)
    .await?;

    Ok(())
}

async fn mark_activity_reached(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO learner_activity_progress (principal_id, activity_id, status) VALUES ($1, $2, 'reached') ON CONFLICT (principal_id, activity_id) DO UPDATE SET updated_at = NOW()",
    )
    .bind(principal_id)
    .bind(activity_id)
    .execute(&mut **transaction)
    .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::check_in_context;

    #[test]
    fn check_in_context_exposes_only_bounded_source_presentation_fields() {
        let context = check_in_context(&json!({
            "completionChoicePrompt": " Choose a direction that fits. ",
            "evidenceObjective": " Notice the next useful choice. ",
            "evidenceConcepts": ["Choice", "choice", "", 42],
            "competenceTopics": [
                { "topic": "Orientation", "slug": "orientation", "weight": 1 },
                { "topic": "Orientation again", "slug": "orientation", "weight": 2 },
                { "topic": "Invalid", "slug": "Not-a-slug", "weight": 1 }
            ]
        }));

        assert_eq!(
            context.choice_prompt.as_deref(),
            Some("Choose a direction that fits.")
        );
        assert_eq!(
            context.objective.as_deref(),
            Some("Notice the next useful choice.")
        );
        assert_eq!(context.concepts, vec!["Choice"]);
        assert_eq!(context.learning_areas.len(), 1);
        assert_eq!(context.learning_areas[0].name, "Orientation");
        assert_eq!(context.learning_areas[0].slug, "orientation");
    }
}
