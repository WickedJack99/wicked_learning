use std::collections::BTreeMap;

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
        LearnerNpcDialogue, LearnerNpcDialogueNode, LearnerNpcDialogueTransition,
        LearnerNpcDialogueTypingSound, LearnerNpcDialogueTypingSoundSet, LearnerPlaybackActivity,
        LearnerPlaybackCheckIn, LearnerPlaybackCompletion, LearnerPlaybackCompletionResult,
        LearnerPlaybackContext, LearnerPlaybackDocument, LearnerPlaybackLearningArea,
        LearnerPlaybackReviewContext, LearnerPlaybackRunKind, LearnerTool,
    },
};

use crate::{
    learner_evidence::{CompletionEvidence, record_completion_evidence, record_topic_visit},
    learner_item_grant::{configured_chance_basis_points, configured_item_grants},
    learner_item_obstacle::{
        configured_slots, item_obstacle_passed_for_run, load_inventory,
        load_state as load_item_obstacle_state,
    },
    learner_obstacle_tool::{
        configured_tool_slugs as configured_obstacle_tool_slugs, obstacle_is_persistently_resolved,
        obstacle_passed_for_run, persists_after_solved,
    },
    learner_question::{
        latest_answer_for_completion, question_feedback_for_playback, valid_confidence,
    },
    learner_revisit_completion::{RevisitCompletion, complete_active_revisit},
    learner_shared_task::{
        load_state_for_playback, safe_playback_config, shared_task_complete_for_run,
    },
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
    is_recall: bool,
    is_replay: bool,
    is_revisit: bool,
    principal_id: Uuid,
    route_id: Uuid,
}

#[derive(FromRow)]
struct ReviewContextRow {
    created_at: String,
    id: Uuid,
    question: String,
    reflection: String,
}

#[derive(FromRow)]
struct LatestReflectionRow {
    id: Uuid,
    is_independent_check: bool,
    observed_cues: Option<serde_json::Value>,
    response_type: String,
}

#[derive(FromRow)]
struct CompletionTransitionRow {
    to_activity_id: Option<Uuid>,
}

#[derive(FromRow)]
struct SupportPromptCompletionRow {
    activity_config: serde_json::Value,
    activity_id: Uuid,
    activity_type: String,
    principal_id: Uuid,
    route_id: Uuid,
}

#[derive(FromRow)]
struct NextPlayableActivityRow {
    activity_config: serde_json::Value,
    activity_type: String,
    id: Uuid,
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

#[derive(FromRow)]
struct ItemObstaclePlaybackRow {
    image_dark: Option<String>,
    image_light: Option<String>,
    slug: String,
    title: String,
}

#[derive(FromRow)]
struct NpcDialogueNodeRow {
    body: Option<String>,
    config: serde_json::Value,
    id: Uuid,
    node_type: String,
    title: String,
}

#[derive(FromRow)]
struct NpcDialogueTransitionRow {
    from_connector: String,
    from_node_id: Option<Uuid>,
    to_node_id: Uuid,
}

#[derive(FromRow)]
struct NpcDialogueTypingSoundSetRow {
    id: Uuid,
    is_default: bool,
    name: String,
}

#[derive(FromRow)]
struct NpcDialogueTypingSoundRow {
    id: Uuid,
    letter: String,
    sound_set_id: Uuid,
    url: String,
    volume: i16,
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
#[serde(rename_all = "camelCase")]
struct MessagePromptPlaybackConfig {
    message_audience: String,
    message_allow_responses: Option<bool>,
    message_input_label: Option<String>,
    message_prompt: Option<String>,
    message_response_prompt: Option<String>,
    message_topic_id: Option<String>,
    message_ui: Option<MessagePromptUiConfig>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MessagePromptUiConfig {
    accent_color_dark: Option<String>,
    accent_color_light: Option<String>,
    card_color_dark: Option<String>,
    card_color_light: Option<String>,
    surface_color_dark: Option<String>,
    surface_color_light: Option<String>,
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
        "reflection" | "review" => reflection_safe_config(config),
        "tool_grant" => tool_grant_safe_config(config),
        "item_grant" => item_grant_safe_config(config),
        "item_obstacle" => item_obstacle_safe_config(config),
        "obstacle" => obstacle_safe_config(config),
        "markdown" => markdown_safe_config(config),
        "message_prompt" => message_prompt_safe_config(config),
        "message_wall" => message_wall_safe_config(config),
        "npc_dialogue" => Some(config),
        "shared_task" => safe_playback_config(config),
        _ => None,
    }
}

fn message_wall_safe_config(config: serde_json::Value) -> Option<serde_json::Value> {
    let config = serde_json::from_value::<MessagePromptPlaybackConfig>(config).ok()?;
    if config.message_audience != "peers" {
        return None;
    }
    Uuid::parse_str(config.message_topic_id.as_deref()?).ok()?;
    let prompt = config
        .message_prompt
        .as_deref()
        .and_then(|value| bounded_text(value, 2_000))?;
    let input_label = config
        .message_input_label
        .as_deref()
        .and_then(|value| bounded_text(value, 160))?;
    let response_prompt = config
        .message_response_prompt
        .as_deref()
        .and_then(|value| bounded_text(value, 2_000));
    let colors = message_ui_safe_config(config.message_ui);
    Some(json!({
        "messageAudience": "peers",
        "messageAllowResponses": config.message_allow_responses.unwrap_or(false),
        "messageInputLabel": input_label,
        "messagePrompt": prompt,
        "messageResponsePrompt": response_prompt,
        "messageUi": colors,
    }))
}

fn message_prompt_safe_config(config: serde_json::Value) -> Option<serde_json::Value> {
    let config = serde_json::from_value::<MessagePromptPlaybackConfig>(config).ok()?;
    if !matches!(config.message_audience.as_str(), "peers" | "support") {
        return None;
    }
    if config.message_audience == "peers" {
        Uuid::parse_str(config.message_topic_id.as_deref()?).ok()?;
    }
    let prompt = config
        .message_prompt
        .as_deref()
        .and_then(|value| bounded_text(value, 2_000))
        .unwrap_or_else(|| {
            "Leave a helpful note or an encouraging thought for the next learner.".to_owned()
        });
    let input_label = config
        .message_input_label
        .as_deref()
        .and_then(|value| bounded_text(value, 160))
        .unwrap_or_else(|| "Your message".to_owned());
    let colors = message_ui_safe_config(config.message_ui);

    Some(json!({
        "messageAudience": config.message_audience,
        "messageAllowResponses": config.message_allow_responses.unwrap_or(false),
        "messageInputLabel": input_label,
        "messagePrompt": prompt,
        "messageUi": colors,
    }))
}

fn message_ui_safe_config(config: Option<MessagePromptUiConfig>) -> serde_json::Value {
    config.map_or_else(
        || json!({}),
        |colors| {
            json!({
                "accentColorDark": colors.accent_color_dark.filter(|value| is_hex_color(value)),
                "accentColorLight": colors.accent_color_light.filter(|value| is_hex_color(value)),
                "cardColorDark": colors.card_color_dark.filter(|value| is_hex_color(value)),
                "cardColorLight": colors.card_color_light.filter(|value| is_hex_color(value)),
                "surfaceColorDark": colors.surface_color_dark.filter(|value| is_hex_color(value)),
                "surfaceColorLight": colors.surface_color_light.filter(|value| is_hex_color(value)),
            })
        },
    )
}

fn is_hex_color(value: &String) -> bool {
    let value = value.as_bytes();
    (value.len() == 4 || value.len() == 7)
        && value[0] == b'#'
        && value[1..].iter().all(u8::is_ascii_hexdigit)
}

fn reflection_safe_config(config: serde_json::Value) -> Option<serde_json::Value> {
    let config = config.as_object()?;
    let prompt = config
        .get("prompt")
        .and_then(serde_json::Value::as_str)
        .and_then(|prompt| bounded_text(prompt, 2_000))
        .unwrap_or_else(|| "What feels clearer now?".to_owned());
    let note = config
        .get("note")
        .and_then(serde_json::Value::as_str)
        .and_then(|note| bounded_text(note, 2_000));
    let learning_intent = config
        .get("learningIntent")
        .and_then(serde_json::Value::as_str)
        .filter(|intent| matches!(*intent, "explain" | "transfer" | "review"))
        .map(ToOwned::to_owned);
    let feedback_guidance = config
        .get("feedbackGuidance")
        .and_then(serde_json::Value::as_object)
        .map(|guidance| {
            let text = |key: &str| {
                guidance
                    .get(key)
                    .and_then(serde_json::Value::as_str)
                    .and_then(|value| bounded_text(value, 2_000))
            };
            let rubric = guidance
                .get("rubric")
                .and_then(serde_json::Value::as_array)
                .map_or_else(Vec::new, |values| normalized_texts(values, 3, 300));
            json!({
                "purpose": text("purpose"),
                "evidence": text("evidence"),
                "responseFeedback": text("responseFeedback"),
                "nextAction": text("nextAction"),
                "independentCheckPrompt": text("independentCheckPrompt"),
                "independentCheckFeedback": text("independentCheckFeedback"),
                "rubric": rubric,
            })
        });

    Some(json!({
        "note": note,
        "prompt": prompt,
        "learningIntent": learning_intent,
        "feedbackGuidance": feedback_guidance,
    }))
}

fn is_review_activity(activity_type: &str, config: &serde_json::Value) -> bool {
    activity_type == "review"
        || config
            .as_object()
            .and_then(|config| config.get("learningIntent"))
            .and_then(serde_json::Value::as_str)
            == Some("review")
}

async fn load_review_context(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_config: &serde_json::Value,
    node_title: &str,
) -> Result<Vec<LearnerPlaybackReviewContext>, sqlx::Error> {
    let topic = activity_config
        .as_object()
        .and_then(|config| config.get("topic"))
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|topic| !topic.is_empty())
        .unwrap_or(node_title);
    let subtopic = activity_config
        .as_object()
        .and_then(|config| config.get("subtopic"))
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .unwrap_or_default();
    let rows = sqlx::query_as::<_, ReviewContextRow>(
        "SELECT reflections.id, reflections.question, reflections.reflection, to_char(reflections.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at FROM learner_reflections AS reflections INNER JOIN learner_journal_pages AS pages ON pages.id = reflections.learner_journal_page_id WHERE reflections.principal_id = $1 AND pages.topic = $2 AND ($3 = '' OR pages.subtopic = $3) ORDER BY reflections.created_at DESC, reflections.id DESC LIMIT 3",
    )
    .bind(principal_id)
    .bind(topic)
    .bind(subtopic)
    .fetch_all(&mut **transaction)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| LearnerPlaybackReviewContext {
            id: row.id.to_string(),
            question: row.question,
            reflection: row.reflection,
            created_at: row.created_at,
        })
        .collect())
}

fn markdown_safe_config(config: serde_json::Value) -> Option<serde_json::Value> {
    let object = config.as_object()?;
    let pages = object
        .get("markdownPages")
        .and_then(serde_json::Value::as_array)
        .map_or_else(Vec::new, |pages| {
            pages
                .iter()
                .take(30)
                .enumerate()
                .filter_map(|(index, page)| {
                    let page = page.as_object()?;
                    let id = page
                        .get("id")
                        .and_then(serde_json::Value::as_str)
                        .and_then(|value| bounded_text(value, 100))
                        .unwrap_or_else(|| format!("page-{}", index + 1));
                    let title = page
                        .get("title")
                        .and_then(serde_json::Value::as_str)
                        .and_then(|value| bounded_text(value, 160))
                        .unwrap_or_else(|| format!("Page {}", index + 1));
                    let body = page
                        .get("body")
                        .and_then(serde_json::Value::as_str)
                        .and_then(|value| bounded_text(value, 20_000))
                        .unwrap_or_default();
                    let visual = page.get("visual").and_then(serde_json::Value::as_object);
                    let color = |name: &str, fallback: &str| {
                        visual
                            .and_then(|visual| visual.get(name))
                            .and_then(serde_json::Value::as_str)
                            .filter(|value| valid_hex_color(value))
                            .map(ToOwned::to_owned)
                            .unwrap_or_else(|| fallback.to_owned())
                    };

                    Some(json!({
                        "body": body,
                        "id": id,
                        "title": title,
                        "visual": {
                            "borderColorDark": color("borderColorDark", "#2dd4bf"),
                            "borderColorLight": color("borderColorLight", "#0891b2"),
                            "headingColorDark": color("headingColorDark", "#67e8f9"),
                            "headingColorLight": color("headingColorLight", "#0e7490"),
                            "pageColorDark": color("pageColorDark", "#0f172a"),
                            "pageColorLight": color("pageColorLight", "#ffffff"),
                            "textColorDark": color("textColorDark", "#f8fafc"),
                            "textColorLight": color("textColorLight", "#0f172a"),
                        },
                    }))
                })
                .fold(Vec::new(), |mut pages, page| {
                    let duplicate = page
                        .get("id")
                        .and_then(serde_json::Value::as_str)
                        .is_some_and(|id| {
                            pages.iter().any(|existing: &serde_json::Value| {
                                existing.get("id").and_then(serde_json::Value::as_str) == Some(id)
                            })
                        });
                    if !duplicate {
                        pages.push(page);
                    }
                    pages
                })
        });
    let page_ids = pages
        .iter()
        .filter_map(|page| page.get("id").and_then(serde_json::Value::as_str))
        .collect::<Vec<_>>();
    let transitions = object
        .get("markdownTransitions")
        .and_then(serde_json::Value::as_array)
        .map_or_else(Vec::new, |transitions| {
            transitions
                .iter()
                .take(60)
                .filter_map(|transition| {
                    let transition = transition.as_object()?;
                    let from = transition
                        .get("from")
                        .and_then(serde_json::Value::as_str)
                        .and_then(|value| bounded_text(value, 100))?;
                    let to = transition
                        .get("to")
                        .and_then(serde_json::Value::as_str)
                        .and_then(|value| bounded_text(value, 100))?;
                    ((from == "start" || page_ids.contains(&from.as_str()))
                        && (to == "end" || page_ids.contains(&to.as_str())))
                    .then(|| json!({ "from": from, "to": to }))
                })
                .collect()
        });

    Some(json!({
        "markdownPages": pages,
        "markdownTransitions": transitions,
    }))
}

fn obstacle_safe_config(config: serde_json::Value) -> Option<serde_json::Value> {
    let object = config.as_object()?;
    let allowed_tool_ids = configured_obstacle_tool_slugs(&config);
    if allowed_tool_ids.is_empty() {
        return None;
    }
    let success_animation = object
        .get("successAnimation")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("zoom");
    if !matches!(success_animation, "none" | "zoom" | "shake" | "rotate") {
        return None;
    }

    Some(json!({
        "allowedToolIds": allowed_tool_ids,
        "backgroundDark": optional_bounded_config_text(object, "backgroundDark", 2_048)?,
        "backgroundLight": optional_bounded_config_text(object, "backgroundLight", 2_048)?,
        "backgroundMirrored": object.get("backgroundMirrored").and_then(serde_json::Value::as_bool).unwrap_or(false),
        "bubbleBorderColorDark": optional_bounded_config_text(object, "bubbleBorderColorDark", 64)?,
        "bubbleBorderColorLight": optional_bounded_config_text(object, "bubbleBorderColorLight", 64)?,
        "bubbleColorDark": optional_bounded_config_text(object, "bubbleColorDark", 64)?,
        "bubbleColorLight": optional_bounded_config_text(object, "bubbleColorLight", 64)?,
        "bubbleOpacityDark": bounded_config_number(object, "bubbleOpacityDark", 92.0, 0.0, 100.0)?,
        "bubbleOpacityLight": bounded_config_number(object, "bubbleOpacityLight", 94.0, 0.0, 100.0)?,
        "obstacleImageDark": optional_bounded_config_text(object, "obstacleImageDark", 2_048)?,
        "obstacleImageLight": optional_bounded_config_text(object, "obstacleImageLight", 2_048)?,
        "obstacleImageMirrored": object.get("obstacleImageMirrored").and_then(serde_json::Value::as_bool).unwrap_or(false),
        "obstacleWidth": bounded_config_number(object, "obstacleWidth", 28.0, 1.0, 100.0)?,
        "obstacleX": bounded_config_number(object, "obstacleX", 50.0, 0.0, 100.0)?,
        "obstacleY": bounded_config_number(object, "obstacleY", 50.0, 0.0, 100.0)?,
        "persistAfterSolved": persists_after_solved(&config),
        "promptText": optional_bounded_config_text(object, "promptText", 2_000)?,
        "revisitBackgroundDark": optional_bounded_config_text(object, "revisitBackgroundDark", 2_048)?,
        "revisitBackgroundLight": optional_bounded_config_text(object, "revisitBackgroundLight", 2_048)?,
        "revisitBackgroundMirrored": object.get("revisitBackgroundMirrored").and_then(serde_json::Value::as_bool).unwrap_or(false),
        "revisitImageDark": optional_bounded_config_text(object, "revisitImageDark", 2_048)?,
        "revisitImageLight": optional_bounded_config_text(object, "revisitImageLight", 2_048)?,
        "revisitImageMirrored": object.get("revisitImageMirrored").and_then(serde_json::Value::as_bool).unwrap_or(false),
        "revisitText": optional_bounded_config_text(object, "revisitText", 2_000)?,
        "successAnimation": success_animation,
        "successText": optional_bounded_config_text(object, "successText", 2_000)?,
        "typingSpeed": bounded_config_number(object, "typingSpeed", 24.0, 0.0, 240.0)?,
    }))
}

fn item_obstacle_safe_config(config: serde_json::Value) -> Option<serde_json::Value> {
    let object = config.as_object()?;
    let slots = configured_slots(&config);
    if slots.is_empty() {
        return None;
    }

    Some(json!({
        "backgroundDark": optional_bounded_config_text(object, "backgroundDark", 2_048)?,
        "backgroundLight": optional_bounded_config_text(object, "backgroundLight", 2_048)?,
        "backgroundMirrored": object.get("backgroundMirrored").and_then(serde_json::Value::as_bool).unwrap_or(false),
        "consumeOnEachEntry": object.get("consumeOnEachEntry").and_then(serde_json::Value::as_bool).unwrap_or(false),
        "lockMinutes": bounded_config_number(object, "lockMinutes", 0.0, 0.0, 10_080.0)?,
        "metBackgroundDark": optional_bounded_config_text(object, "metBackgroundDark", 2_048)?,
        "metBackgroundLight": optional_bounded_config_text(object, "metBackgroundLight", 2_048)?,
        "metBackgroundMirrored": object.get("metBackgroundMirrored").and_then(serde_json::Value::as_bool).unwrap_or(false),
        "overlayDark": optional_bounded_config_text(object, "overlayDark", 2_048)?,
        "overlayLight": optional_bounded_config_text(object, "overlayLight", 2_048)?,
        "overlayMirrored": object.get("overlayMirrored").and_then(serde_json::Value::as_bool).unwrap_or(false),
        "overlayWidth": bounded_config_number(object, "overlayWidth", 30.0, 1.0, 100.0)?,
        "overlayX": bounded_config_number(object, "overlayX", 50.0, 0.0, 100.0)?,
        "overlayY": bounded_config_number(object, "overlayY", 50.0, 0.0, 100.0)?,
        "slots": slots.into_iter().map(|slot| json!({
            "itemId": slot.item_slug,
            "slotIndex": slot.slot_index,
            "width": slot.width,
            "x": slot.x,
            "y": slot.y,
        })).collect::<Vec<_>>(),
    }))
}

fn item_grant_safe_config(config: serde_json::Value) -> Option<serde_json::Value> {
    let object = config.as_object()?;
    let items = configured_item_grants(&config)
        .into_iter()
        .map(|item| json!({ "itemId": item.slug, "quantity": item.quantity }))
        .collect::<Vec<_>>();

    Some(json!({
        "backgroundDark": optional_bounded_config_text(object, "backgroundDark", 2_048)?,
        "backgroundLight": optional_bounded_config_text(object, "backgroundLight", 2_048)?,
        "backgroundMirrored": object.get("backgroundMirrored").and_then(serde_json::Value::as_bool).unwrap_or(false),
        "items": items,
        "probabilityPercent": configured_chance_basis_points(&config) as f64 / 100.0,
    }))
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

async fn enrich_item_obstacle_config(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
    config: &mut serde_json::Value,
) -> Result<(), sqlx::Error> {
    let slots = configured_slots(config);
    let item_slugs = slots
        .iter()
        .map(|slot| slot.item_slug.as_str())
        .collect::<Vec<_>>();
    let items = sqlx::query_as::<_, ItemObstaclePlaybackRow>(
        "SELECT image_dark, image_light, slug, title FROM learning_items WHERE slug = ANY($1) ORDER BY slug ASC",
    )
    .bind(&item_slugs)
    .fetch_all(&mut **transaction)
    .await?;
    let state = load_item_obstacle_state(transaction, principal_id, activity_id, &slots).await?;
    let Some(object) = config.as_object_mut() else {
        return Ok(());
    };
    object.insert(
        "configuredItems".to_owned(),
        json!(
            items
                .into_iter()
                .map(|item| json!({
                    "image_dark": item.image_dark,
                    "image_light": item.image_light,
                    "slug": item.slug,
                    "title": item.title,
                }))
                .collect::<Vec<_>>()
        ),
    );
    object.insert(
        "state".to_owned(),
        serde_json::to_value(state).unwrap_or_default(),
    );
    Ok(())
}

async fn enrich_obstacle_config(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
    config: &mut serde_json::Value,
) -> Result<(), sqlx::Error> {
    let is_resolved =
        obstacle_is_persistently_resolved(transaction, principal_id, activity_id).await?;
    let Some(object) = config.as_object_mut() else {
        return Ok(());
    };
    object.insert("isResolved".to_owned(), json!(is_resolved));
    Ok(())
}

/// The playback row has already bound this slug to the authorized active run.
/// Resolve its internal identifier only after that authorization check, so the
/// subsequent read of private obstacle state cannot be redirected by the
/// browser.
async fn active_item_obstacle_id(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT progress.current_activity_id FROM learner_route_progress AS progress INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id WHERE progress.principal_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'item_obstacle' UNION ALL SELECT runs.activity_id FROM learner_activity_replay_runs AS runs INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id WHERE runs.principal_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'item_obstacle' LIMIT 1",
    )
    .bind(principal_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .fetch_optional(&mut **transaction)
    .await
}

async fn active_obstacle_id(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT progress.current_activity_id FROM learner_route_progress AS progress INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id WHERE progress.principal_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'obstacle' UNION ALL SELECT runs.activity_id FROM learner_activity_replay_runs AS runs INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id WHERE runs.principal_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'obstacle' LIMIT 1",
    )
    .bind(principal_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .fetch_optional(&mut **transaction)
    .await
}

/// The playback row already established that this question belongs to the
/// authenticated active run. Resolve the internal ID through the same run
/// ownership boundary before reading its private answer history.
async fn active_question_id(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT progress.current_activity_id FROM learner_route_progress AS progress INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id WHERE progress.principal_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'question' UNION ALL SELECT runs.activity_id FROM learner_revisit_runs AS runs INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id WHERE runs.principal_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'question' UNION ALL SELECT runs.activity_id FROM learner_recall_runs AS runs INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id WHERE runs.principal_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'question' UNION ALL SELECT runs.activity_id FROM learner_activity_replay_runs AS runs INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id WHERE runs.principal_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'question' LIMIT 1",
    )
    .bind(principal_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .fetch_optional(&mut **transaction)
    .await
}

async fn load_tools(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
) -> Result<Vec<LearnerTool>, sqlx::Error> {
    sqlx::query_as::<_, ToolPlaybackRow>(
        "SELECT tools.animation_dark, tools.animation_light, tools.config, tools.description, tools.image_dark, tools.image_light, tools.slug, tools.title FROM learner_tools AS holdings INNER JOIN learning_tools AS tools ON tools.id = holdings.tool_id WHERE holdings.principal_id = $1 ORDER BY holdings.acquired_at ASC, tools.slug ASC LIMIT 100",
    )
    .bind(principal_id)
    .fetch_all(&mut **transaction)
    .await
    .map(|tools| {
        tools
            .into_iter()
            .map(|tool| LearnerTool {
                animation_dark: tool.animation_dark,
                animation_light: tool.animation_light,
                config: tool.config,
                description: tool.description,
                image_dark: tool.image_dark,
                image_light: tool.image_light,
                slug: tool.slug,
                title: tool.title,
            })
            .collect()
    })
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

/// Reads only the graph belonging to an already-authorized route or historical
/// replay run. A missing durable state uses the authored start node
/// deterministically; the first command creates it under the relevant run lock.
async fn load_npc_dialogue(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<LearnerNpcDialogue>, sqlx::Error> {
    let activity_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT activities.id FROM learner_route_progress AS progress INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id WHERE progress.principal_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'npc_dialogue' UNION ALL SELECT activities.id FROM learner_activity_replay_runs AS runs INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id WHERE runs.principal_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'npc_dialogue' LIMIT 1",
    )
    .bind(principal_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .fetch_optional(&mut **transaction)
    .await?;
    let Some(activity_id) = activity_id else {
        return Ok(None);
    };
    let nodes = sqlx::query_as::<_, NpcDialogueNodeRow>(
        "SELECT id, node_type, title, body, node_config AS config FROM learning_npc_dialogue_nodes WHERE activity_id = $1 ORDER BY sort_order ASC, id ASC",
    )
    .bind(activity_id)
    .fetch_all(&mut **transaction)
    .await?;
    if nodes.is_empty()
        || nodes.iter().any(|node| {
            node.title.trim().is_empty()
                || !matches!(
                    node.node_type.as_str(),
                    "npc_monologue" | "npc_question" | "answer" | "reflection" | "end"
                )
                || !node.config.is_object()
        })
    {
        return Ok(None);
    }
    let transitions = sqlx::query_as::<_, NpcDialogueTransitionRow>(
        "SELECT from_node_id, to_node_id, from_connector FROM learning_npc_dialogue_transitions WHERE activity_id = $1 ORDER BY created_at ASC, id ASC",
    )
    .bind(activity_id)
    .fetch_all(&mut **transaction)
    .await?;
    let initial_node_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT to_node_id FROM learning_npc_dialogue_transitions WHERE activity_id = $1 AND from_node_id IS NULL AND from_connector = 'out'",
    )
    .bind(activity_id)
    .fetch_optional(&mut **transaction)
    .await?;
    let Some(initial_node_id) = initial_node_id else {
        return Ok(None);
    };
    let state = sqlx::query_as::<_, DialoguePlaybackStateRow>(
        "SELECT current_node_id, history FROM learner_npc_dialogue_states WHERE principal_id = $1 AND play_run_id = $2 AND activity_id = $3",
    )
    .bind(principal_id)
    .bind(play_run_id)
    .bind(activity_id)
    .fetch_optional(&mut **transaction)
    .await?;
    let (current_node_id, history) = match state {
        Some(state) => (
            state.current_node_id,
            serde_json::from_value::<Vec<Uuid>>(state.history)
                .unwrap_or_default()
                .into_iter()
                .take(40)
                .collect(),
        ),
        None => (initial_node_id, Vec::new()),
    };
    if !nodes.iter().any(|node| node.id == current_node_id)
        || history
            .iter()
            .any(|id| !nodes.iter().any(|node| node.id == *id))
    {
        return Ok(None);
    }
    let configured_sound_set_ids = nodes
        .iter()
        .filter(|node| node.config["typingSoundEnabled"].as_bool() == Some(true))
        .filter_map(|node| node.config["typingSoundSetId"].as_str())
        .filter_map(|id| Uuid::parse_str(id).ok())
        .collect::<Vec<_>>();
    let typing_sound_sets = if configured_sound_set_ids.is_empty()
        && !nodes
            .iter()
            .any(|node| node.config["typingSoundEnabled"].as_bool() == Some(true))
    {
        Vec::new()
    } else {
        load_dialogue_typing_sound_sets(transaction, &configured_sound_set_ids).await?
    };
    Ok(Some(LearnerNpcDialogue {
        current_node_id: current_node_id.to_string(),
        history: history.into_iter().map(|id| id.to_string()).collect(),
        nodes: nodes
            .into_iter()
            .map(|node| LearnerNpcDialogueNode {
                id: node.id.to_string(),
                node_type: node.node_type,
                title: node.title,
                body: node.body,
                config: node.config,
            })
            .collect(),
        typing_sound_sets,
        transitions: transitions
            .into_iter()
            .map(|transition| LearnerNpcDialogueTransition {
                from_node_id: transition.from_node_id.map(|id| id.to_string()),
                to_node_id: transition.to_node_id.to_string(),
                from_connector: transition.from_connector,
            })
            .collect(),
    }))
}

async fn load_dialogue_typing_sound_sets(
    transaction: &mut Transaction<'_, Postgres>,
    configured_set_ids: &[Uuid],
) -> Result<Vec<LearnerNpcDialogueTypingSoundSet>, sqlx::Error> {
    let sets = sqlx::query_as::<_, NpcDialogueTypingSoundSetRow>(
        "SELECT id, name, is_default FROM learning_dialogue_typing_sound_sets WHERE is_default OR id = ANY($1) ORDER BY is_default DESC, name ASC, id ASC",
    )
    .bind(configured_set_ids)
    .fetch_all(&mut **transaction)
    .await?;
    if sets.is_empty() {
        return Ok(Vec::new());
    }
    let set_ids = sets.iter().map(|set| set.id).collect::<Vec<_>>();
    let sounds = sqlx::query_as::<_, NpcDialogueTypingSoundRow>(
        "SELECT id, sound_set_id, letter, url, volume FROM learning_dialogue_typing_sounds WHERE sound_set_id = ANY($1) ORDER BY sound_set_id ASC, letter ASC",
    )
    .bind(&set_ids)
    .fetch_all(&mut **transaction)
    .await?;
    let mut sounds_by_set =
        BTreeMap::<Uuid, BTreeMap<String, LearnerNpcDialogueTypingSound>>::new();
    for sound in sounds {
        sounds_by_set.entry(sound.sound_set_id).or_default().insert(
            sound.letter.clone(),
            LearnerNpcDialogueTypingSound {
                id: sound.id.to_string(),
                letter: sound.letter,
                url: sound.url,
                volume: sound.volume,
            },
        );
    }
    Ok(sets
        .into_iter()
        .map(|set| LearnerNpcDialogueTypingSoundSet {
            id: set.id.to_string(),
            is_default: set.is_default,
            name: set.name,
            sounds: sounds_by_set.remove(&set.id).unwrap_or_default(),
        })
        .collect())
}

#[derive(FromRow)]
struct DialoguePlaybackStateRow {
    current_node_id: Uuid,
    history: serde_json::Value,
}

/// Message activities have their own reader because topic binding is part of
/// the authorization boundary: a malformed authored topic must not render a
/// browser form that can target another MapAsset. The generic reader only
/// accepts other already-migrated activity types.
async fn load_message_activity_playback(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
) -> Result<Option<PlaybackRow>, sqlx::Error> {
    sqlx::query_as::<_, PlaybackRow>(
        "SELECT progress.activity_start_id AS start_id, progress.principal_id, activities.slug AS activity_slug, activities.title, activities.description, activities.activity_type, activities.activity_config, maps.slug AS map_slug, maps.title AS map_title, nodes.slug AS node_slug, nodes.title AS node_title, COALESCE(starts.label, routes.title) AS route_label, 'route'::text AS run_kind, transition.label AS transition_label, next_activity.slug AS next_activity_slug \
         FROM learner_route_progress AS progress \
         INNER JOIN application_principals AS principals ON principals.id = progress.principal_id \
         INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id \
         INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id \
         INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id \
         INNER JOIN learning_routes AS routes ON routes.id = activities.route_id \
         INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id \
         INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id \
         INNER JOIN learning_message_topics AS topics ON topics.id::text = activities.activity_config ->> 'messageTopicId' AND topics.map_asset_id = assets.id \
         LEFT JOIN LATERAL (SELECT transitions.label, transitions.to_activity_id FROM learning_activity_transitions AS transitions WHERE transitions.from_activity_id = activities.id AND transitions.from_connector = 'completed' AND transitions.trigger = 'completed' ORDER BY transitions.created_at ASC, transitions.id ASC LIMIT 1) AS transition ON TRUE \
         LEFT JOIN learning_activities AS next_activity ON next_activity.id = transition.to_activity_id \
         WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' \
           AND ((activities.activity_type = 'message_prompt' AND activities.activity_config ->> 'messageAudience' IN ('support', 'peers')) \
             OR (activities.activity_type = 'message_wall' AND activities.activity_config ->> 'messageAudience' = 'peers')) \
           AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL \
           AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL \
           AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($3)))",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await
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
            let row = if let Some(row) =
                load_message_activity_playback(&mut transaction, principal, play_run_id)
                    .await
                    .map_err(|_| LearnerPlaybackReadError)?
            {
                Some(row)
            } else {
                sqlx::query_as::<_, PlaybackRow>(
                "SELECT progress.activity_start_id AS start_id, progress.principal_id, activities.slug AS activity_slug, activities.title, activities.description, activities.activity_type, activities.activity_config, maps.slug AS map_slug, maps.title AS map_title, nodes.slug AS node_slug, nodes.title AS node_title, COALESCE(starts.label, routes.title) AS route_label, 'route'::text AS run_kind, transition.label AS transition_label, next_activity.slug AS next_activity_slug FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id LEFT JOIN LATERAL (SELECT transitions.label, transitions.to_activity_id FROM learning_activity_transitions AS transitions WHERE transitions.from_activity_id = activities.id AND transitions.from_connector = 'completed' AND transitions.trigger = 'completed' ORDER BY transitions.created_at ASC, transitions.id ASC LIMIT 1) AS transition ON TRUE LEFT JOIN learning_activities AS next_activity ON next_activity.id = transition.to_activity_id WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND activities.activity_type IN ('open_practice', 'question', 'reflection', 'review', 'tool_grant', 'item_grant', 'item_obstacle', 'obstacle', 'markdown', 'npc_dialogue', 'shared_task') AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($3))) UNION ALL SELECT NULL::uuid AS start_id, runs.principal_id, activities.slug AS activity_slug, activities.title, activities.description, activities.activity_type, activities.activity_config, maps.slug AS map_slug, maps.title AS map_title, nodes.slug AS node_slug, nodes.title AS node_title, NULL::text AS route_label, 'revisit'::text AS run_kind, NULL::text AS transition_label, NULL::text AS next_activity_slug FROM learner_revisit_runs AS runs INNER JOIN application_principals AS principals ON principals.id = runs.principal_id INNER JOIN learner_activity_check_ins AS check_ins ON check_ins.id = runs.check_in_id AND check_ins.principal_id = runs.principal_id AND check_ins.activity_id = runs.activity_id INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND activities.activity_type IN ('open_practice', 'question', 'reflection', 'review') AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($3))) UNION ALL SELECT NULL::uuid AS start_id, runs.principal_id, activities.slug AS activity_slug, activities.title, activities.description, activities.activity_type, activities.activity_config, maps.slug AS map_slug, maps.title AS map_title, nodes.slug AS node_slug, nodes.title AS node_title, NULL::text AS route_label, 'recall'::text AS run_kind, NULL::text AS transition_label, NULL::text AS next_activity_slug FROM learner_recall_runs AS runs INNER JOIN application_principals AS principals ON principals.id = runs.principal_id INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND activities.activity_type = 'question' AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($3))) UNION ALL SELECT NULL::uuid AS start_id, runs.principal_id, activities.slug AS activity_slug, activities.title, activities.description, activities.activity_type, activities.activity_config, maps.slug AS map_slug, maps.title AS map_title, nodes.slug AS node_slug, nodes.title AS node_title, NULL::text AS route_label, 'replay'::text AS run_kind, NULL::text AS transition_label, NULL::text AS next_activity_slug FROM learner_activity_replay_runs AS runs INNER JOIN application_principals AS principals ON principals.id = runs.principal_id INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND activities.activity_type IN ('open_practice', 'question', 'reflection', 'review', 'tool_grant', 'item_grant', 'item_obstacle', 'obstacle', 'markdown', 'npc_dialogue') AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($3)))",
            )
            .bind(principal.subject_id)
            .bind(play_run_id)
            .bind(&principal.roles)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|_| LearnerPlaybackReadError)?
            };
            let Some(row) = row else {
                transaction
                    .commit()
                    .await
                    .map_err(|_| LearnerPlaybackReadError)?;
                return Ok(None);
            };
            let activity_config = row.activity_config.clone();
            let check_in = check_in_context(&activity_config);
            let review_context = if is_review_activity(&row.activity_type, &activity_config) {
                load_review_context(
                    &mut transaction,
                    row.principal_id,
                    &activity_config,
                    &row.node_title,
                )
                .await
                .map_err(|_| LearnerPlaybackReadError)?
            } else {
                Vec::new()
            };
            let Some(mut config) = learner_safe_config(&row.activity_type, row.activity_config)
            else {
                transaction
                    .commit()
                    .await
                    .map_err(|_| LearnerPlaybackReadError)?;
                return Ok(None);
            };
            let npc_dialogue = if row.activity_type == "npc_dialogue" {
                let Some(dialogue) = load_npc_dialogue(
                    &mut transaction,
                    row.principal_id,
                    play_run_id,
                    &row.activity_slug,
                )
                .await
                .map_err(|_| LearnerPlaybackReadError)?
                else {
                    transaction
                        .commit()
                        .await
                        .map_err(|_| LearnerPlaybackReadError)?;
                    return Ok(None);
                };
                Some(dialogue)
            } else {
                None
            };
            let (question_feedback, recall_item_id) = if row.activity_type == "question" {
                let Some(activity_id) = active_question_id(
                    &mut transaction,
                    row.principal_id,
                    play_run_id,
                    &row.activity_slug,
                )
                .await
                .map_err(|_| LearnerPlaybackReadError)?
                else {
                    transaction
                        .commit()
                        .await
                        .map_err(|_| LearnerPlaybackReadError)?;
                    return Ok(None);
                };
                let feedback = question_feedback_for_playback(
                    &mut transaction,
                    row.principal_id,
                    activity_id,
                    play_run_id,
                    &row.activity_slug,
                    &activity_config,
                )
                .await
                .map_err(|_| LearnerPlaybackReadError)?;
                let recall_item_id =
                    learner_recall_item_id(&mut transaction, row.principal_id, activity_id)
                        .await
                        .map_err(|_| LearnerPlaybackReadError)?;

                (feedback, recall_item_id)
            } else {
                (None, None)
            };
            if row.activity_type == "tool_grant" {
                enrich_tool_grant_config(&mut transaction, row.principal_id, &mut config)
                    .await
                    .map_err(|_| LearnerPlaybackReadError)?;
            }
            if row.activity_type == "item_obstacle" {
                let Some(activity_id) = active_item_obstacle_id(
                    &mut transaction,
                    row.principal_id,
                    play_run_id,
                    &row.activity_slug,
                )
                .await
                .map_err(|_| LearnerPlaybackReadError)?
                else {
                    transaction
                        .commit()
                        .await
                        .map_err(|_| LearnerPlaybackReadError)?;
                    return Ok(None);
                };
                enrich_item_obstacle_config(
                    &mut transaction,
                    row.principal_id,
                    activity_id,
                    &mut config,
                )
                .await
                .map_err(|_| LearnerPlaybackReadError)?;
            }
            if row.activity_type == "obstacle" {
                let Some(activity_id) = active_obstacle_id(
                    &mut transaction,
                    row.principal_id,
                    play_run_id,
                    &row.activity_slug,
                )
                .await
                .map_err(|_| LearnerPlaybackReadError)?
                else {
                    transaction
                        .commit()
                        .await
                        .map_err(|_| LearnerPlaybackReadError)?;
                    return Ok(None);
                };
                enrich_obstacle_config(
                    &mut transaction,
                    row.principal_id,
                    activity_id,
                    &mut config,
                )
                .await
                .map_err(|_| LearnerPlaybackReadError)?;
            }
            let shared_task = if row.activity_type == "shared_task" {
                let Some(state) = load_state_for_playback(
                    &mut transaction,
                    row.principal_id,
                    play_run_id,
                    &activity_config,
                )
                .await
                .map_err(|_| LearnerPlaybackReadError)?
                else {
                    transaction
                        .commit()
                        .await
                        .map_err(|_| LearnerPlaybackReadError)?;
                    return Ok(None);
                };
                Some(state)
            } else {
                None
            };
            let items = load_inventory(&mut transaction, row.principal_id)
                .await
                .map_err(|_| LearnerPlaybackReadError)?;
            let tools = load_tools(&mut transaction, row.principal_id)
                .await
                .map_err(|_| LearnerPlaybackReadError)?;
            let run_kind = match row.run_kind.as_str() {
                "route" => LearnerPlaybackRunKind::Route,
                "revisit" => LearnerPlaybackRunKind::Revisit,
                "recall" => LearnerPlaybackRunKind::Recall,
                "replay" => LearnerPlaybackRunKind::Replay,
                _ => {
                    transaction
                        .commit()
                        .await
                        .map_err(|_| LearnerPlaybackReadError)?;
                    return Ok(None);
                }
            };
            if run_kind != LearnerPlaybackRunKind::Recall {
                record_topic_visit(
                    &mut transaction,
                    row.principal_id,
                    &activity_config,
                    &row.activity_type,
                )
                .await
                .map_err(|_| LearnerPlaybackReadError)?;
            }
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
                items,
                tools,
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
                    question_feedback,
                    recall_item_id,
                    check_in,
                    review_context,
                    npc_dialogue,
                    shared_task,
                },
            }))
        }
    }
}

async fn learner_recall_item_id(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM learner_recall_items WHERE principal_id = $1 AND activity_id = $2",
    )
    .bind(principal_id)
    .bind(activity_id)
    .fetch_optional(&mut **transaction)
    .await
    .map(|item| item.map(|item| item.to_string()))
}

impl LearnerPlaybackCompletionRepositoryPort for PostgresLearnerPlaybackRepository<'_> {
    fn complete_current_activity(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        confidence: Option<&str>,
        confidence_after_feedback: Option<&str>,
        outcome: Option<&str>,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerPlaybackCompletionResult>, LearnerPlaybackCompletionError>,
    > + Send {
        async move {
            complete_current_activity(
                self.pool,
                principal,
                play_run_id,
                activity_slug,
                confidence,
                confidence_after_feedback,
                outcome,
            )
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
    confidence: Option<&str>,
    confidence_after_feedback: Option<&str>,
    outcome: Option<&str>,
) -> Result<Option<LearnerPlaybackCompletionResult>, sqlx::Error> {
    if !valid_confidence(confidence)
        || !valid_confidence(confidence_after_feedback)
        || !valid_review_outcome(outcome)
    {
        return Ok(None);
    }
    if let Some(result) =
        complete_current_message_activity(pool, principal, play_run_id, activity_slug).await?
    {
        return Ok(Some(result));
    }
    let mut transaction = pool.begin().await?;
    let Some(current) =
        load_current_activity_for_update(&mut transaction, principal, play_run_id, activity_slug)
            .await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };

    if current.activity_type != "question"
        && current.activity_type != "reflection"
        && current.activity_type != "review"
        && (confidence.is_some() || confidence_after_feedback.is_some() || outcome.is_some())
    {
        transaction.commit().await?;
        return Ok(None);
    }

    let reflection = if matches!(current.activity_type.as_str(), "reflection" | "review") {
        let response_type = reflection_response_type(&current.activity_config);
        let reflection = latest_reflection_for_completion(
            &mut transaction,
            current.principal_id,
            current.activity_id,
            play_run_id,
            response_type,
        )
        .await?;
        let Some(reflection) = reflection else {
            transaction.commit().await?;
            return Ok(None);
        };
        Some(reflection)
    } else {
        None
    };

    if outcome.is_some() && !is_review_activity(&current.activity_type, &current.activity_config) {
        transaction.commit().await?;
        return Ok(None);
    }

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

    if current.activity_type == "item_grant"
        && !learner_has_item_grant_for_run(
            &mut transaction,
            current.principal_id,
            current.activity_id,
            play_run_id,
        )
        .await?
    {
        transaction.commit().await?;
        return Ok(None);
    }

    if current.activity_type == "item_obstacle"
        && !item_obstacle_passed_for_run(
            &mut transaction,
            current.principal_id,
            current.activity_id,
            play_run_id,
        )
        .await?
    {
        transaction.commit().await?;
        return Ok(None);
    }

    if current.activity_type == "shared_task"
        && !shared_task_complete_for_run(
            &mut transaction,
            current.activity_id,
            &current.activity_config,
        )
        .await?
    {
        transaction.commit().await?;
        return Ok(None);
    }

    if current.activity_type == "obstacle"
        && !obstacle_passed_for_run(
            &mut transaction,
            current.principal_id,
            current.activity_id,
            play_run_id,
        )
        .await?
    {
        transaction.commit().await?;
        return Ok(None);
    }

    if current.activity_type == "npc_dialogue"
        && !npc_dialogue_reached_end(
            &mut transaction,
            current.principal_id,
            play_run_id,
            current.activity_id,
        )
        .await?
    {
        transaction.commit().await?;
        return Ok(None);
    }

    let question_attempt = if current.activity_type == "question" {
        let Some(attempt) = latest_answer_for_completion(
            &mut transaction,
            current.principal_id,
            current.activity_id,
            play_run_id,
            &current.activity_config,
        )
        .await?
        else {
            transaction.commit().await?;
            return Ok(None);
        };
        Some(attempt)
    } else {
        None
    };

    if current.is_revisit {
        let observable_reflection = reflection.as_ref().filter(|reflection| {
            matches!(reflection.response_type.as_str(), "explain" | "transfer")
        });
        let evidence_observed_cues =
            if is_review_activity(&current.activity_type, &current.activity_config) {
                reflection
                    .as_ref()
                    .and_then(|reflection| reflection.observed_cues.clone())
            } else {
                observable_reflection.and_then(|reflection| reflection.observed_cues.clone())
            };
        let attempt_confidence = question_attempt
            .as_ref()
            .and_then(|attempt| attempt.confidence.as_deref())
            .or(confidence);
        let calibration = question_attempt
            .as_ref()
            .and_then(|attempt| attempt.calibration.as_deref());
        let completion_outcome = question_attempt
            .as_ref()
            .map(|attempt| {
                if attempt.is_correct {
                    "correct"
                } else {
                    "incorrect"
                }
            })
            .or(outcome)
            .unwrap_or("completed");
        let Some(attempt_number) = complete_active_revisit(
            &mut transaction,
            RevisitCompletion {
                activity_id: current.activity_id,
                confidence: attempt_confidence,
                confidence_after_feedback,
                learner_reflection_id: reflection.as_ref().map(|reflection| reflection.id),
                observed_cues: reflection
                    .as_ref()
                    .and_then(|reflection| reflection.observed_cues.clone()),
                outcome: completion_outcome,
                play_run_id,
                principal_id: current.principal_id,
                response_type: reflection
                    .as_ref()
                    .map(|reflection| reflection.response_type.as_str()),
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
                assistance_level: if question_attempt.is_some() {
                    "independent"
                } else {
                    "untracked"
                },
                attempt_number,
                calibration,
                confidence: attempt_confidence,
                confidence_after_feedback,
                learner_reflection_id: observable_reflection.map(|reflection| reflection.id),
                reflection_is_independent_check: observable_reflection
                    .is_some_and(|reflection| reflection.is_independent_check),
                reflection_observed_cues: evidence_observed_cues,
                outcome: completion_outcome,
                play_run_id,
                principal_id: current.principal_id,
                reflection_response_type: observable_reflection
                    .map(|reflection| reflection.response_type.as_str()),
            },
        )
        .await?;
        transaction.commit().await?;

        return Ok(Some(LearnerPlaybackCompletionResult {
            play_run_id: play_run_id.to_string(),
            status: "completed".to_owned(),
        }));
    }

    if current.is_recall {
        // A recall attempt is terminal and isolated. It must never advance an
        // authored route or create progress/evidence records.
        let updated = sqlx::query(
            "UPDATE learner_recall_runs SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1 AND principal_id = $2 AND activity_id = $3 AND status = 'in_progress'",
        )
        .bind(play_run_id)
        .bind(current.principal_id)
        .bind(current.activity_id)
        .execute(&mut *transaction)
        .await?
        .rows_affected();
        if updated != 1 {
            transaction.commit().await?;
            return Ok(None);
        }
        if let Some(confidence_after_feedback) = confidence_after_feedback {
            sqlx::query(
                "UPDATE learner_recall_items SET last_confidence_after_feedback = $3, updated_at = NOW() WHERE principal_id = $1 AND activity_id = $2",
            )
            .bind(current.principal_id)
            .bind(current.activity_id)
            .bind(confidence_after_feedback)
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await?;

        return Ok(Some(LearnerPlaybackCompletionResult {
            play_run_id: play_run_id.to_string(),
            status: "completed".to_owned(),
        }));
    }

    if current.is_replay {
        // The legacy direct-activity player records the activity itself but
        // has no route run from which to create route evidence or transitions.
        // Preserve that behavior while still making completion idempotent and
        // keeping the browser on an opaque, owned run.
        mark_activity_completed(&mut transaction, current.principal_id, current.activity_id)
            .await?;
        let updated = sqlx::query(
            "UPDATE learner_activity_replay_runs SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1 AND principal_id = $2 AND activity_id = $3 AND status = 'in_progress'",
        )
        .bind(play_run_id)
        .bind(current.principal_id)
        .bind(current.activity_id)
        .execute(&mut *transaction)
        .await?
        .rows_affected();
        if updated != 1 {
            transaction.commit().await?;
            return Ok(None);
        }
        transaction.commit().await?;

        return Ok(Some(LearnerPlaybackCompletionResult {
            play_run_id: play_run_id.to_string(),
            status: "completed".to_owned(),
        }));
    }

    let next_activity_id = if let Some(attempt) = &question_attempt {
        attempt.next_activity_id
    } else {
        sqlx::query_as::<_, CompletionTransitionRow>(
            "SELECT to_activity_id FROM learning_activity_transitions WHERE from_activity_id = $1 AND from_connector = 'completed' AND trigger = 'completed' ORDER BY created_at ASC, id ASC LIMIT 1",
        )
        .bind(current.activity_id)
        .fetch_optional(&mut *transaction)
        .await?
        .and_then(|transition| transition.to_activity_id)
    };

    let next_activity_id = match next_activity_id {
        Some(next_activity_id) => {
            let next_activity = sqlx::query_as::<_, NextPlayableActivityRow>(
                "SELECT activities.activity_config, activities.activity_type, activities.id FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id WHERE activities.id = $1 AND routes.id = $2 AND activities.published_at IS NOT NULL",
            )
            .bind(next_activity_id)
            .bind(current.route_id)
            .fetch_optional(&mut *transaction)
            .await?;

            let Some(next_activity) = next_activity else {
                transaction.commit().await?;
                return Ok(None);
            };

            if learner_safe_config(&next_activity.activity_type, next_activity.activity_config)
                .is_none()
            {
                transaction.commit().await?;
                return Ok(None);
            }

            Some(next_activity.id)
        }
        None => None,
    };

    mark_activity_completed(&mut transaction, current.principal_id, current.activity_id).await?;
    let attempt_confidence = question_attempt
        .as_ref()
        .and_then(|attempt| attempt.confidence.as_deref())
        .or(confidence);
    let calibration = question_attempt
        .as_ref()
        .and_then(|attempt| attempt.calibration.as_deref());
    let completion_outcome = question_attempt
        .as_ref()
        .map(|attempt| {
            if attempt.is_correct {
                "correct"
            } else {
                "incorrect"
            }
        })
        .or(outcome)
        .unwrap_or("completed");
    let observable_reflection = reflection
        .as_ref()
        .filter(|reflection| matches!(reflection.response_type.as_str(), "explain" | "transfer"));
    let evidence_observed_cues =
        if is_review_activity(&current.activity_type, &current.activity_config) {
            reflection
                .as_ref()
                .and_then(|reflection| reflection.observed_cues.clone())
        } else {
            observable_reflection.and_then(|reflection| reflection.observed_cues.clone())
        };
    record_completion_evidence(
        &mut transaction,
        CompletionEvidence {
            activity_config: &current.activity_config,
            activity_id: current.activity_id,
            activity_type: &current.activity_type,
            assistance_level: if question_attempt.is_some() {
                "independent"
            } else {
                "untracked"
            },
            attempt_number: question_attempt
                .as_ref()
                .map_or(1, |attempt| attempt.attempt_number),
            calibration,
            confidence: attempt_confidence,
            confidence_after_feedback,
            learner_reflection_id: observable_reflection.map(|reflection| reflection.id),
            reflection_is_independent_check: observable_reflection
                .is_some_and(|reflection| reflection.is_independent_check),
            reflection_observed_cues: evidence_observed_cues,
            outcome: completion_outcome,
            play_run_id,
            principal_id: current.principal_id,
            reflection_response_type: observable_reflection
                .map(|reflection| reflection.response_type.as_str()),
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

async fn npc_dialogue_reached_end(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    play_run_id: Uuid,
    activity_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learner_npc_dialogue_states AS states INNER JOIN learning_npc_dialogue_nodes AS nodes ON nodes.id = states.current_node_id AND nodes.activity_id = states.activity_id WHERE states.principal_id = $1 AND states.play_run_id = $2 AND states.activity_id = $3 AND nodes.node_type = 'end')",
    )
    .bind(principal_id)
    .bind(play_run_id)
    .bind(activity_id)
    .fetch_one(&mut **transaction)
    .await
}

/// Source message activities have a dedicated completion path because their
/// topic must belong to the active map asset. Support prompts require their
/// one private request; peer prompts and peer walls are explicitly optional.
async fn complete_current_message_activity(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<LearnerPlaybackCompletionResult>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let current = sqlx::query_as::<_, SupportPromptCompletionRow>(
        "SELECT activities.activity_config, activities.id AS activity_id, activities.activity_type, progress.principal_id, routes.id AS route_id \
         FROM learner_route_progress AS progress \
         INNER JOIN application_principals AS principals ON principals.id = progress.principal_id \
         INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id \
         INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id \
         INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id \
         INNER JOIN learning_routes AS routes ON routes.id = activities.route_id \
         INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id \
         INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id \
         INNER JOIN learning_message_topics AS topics ON topics.id::text = activities.activity_config ->> 'messageTopicId' AND topics.map_asset_id = assets.id \
         WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' \
           AND activities.slug = $3 \
           AND ((activities.activity_type = 'message_prompt' AND (activities.activity_config ->> 'messageAudience' = 'peers' OR (activities.activity_config ->> 'messageAudience' = 'support' AND EXISTS (SELECT 1 FROM learner_messages AS messages WHERE messages.topic_id = topics.id AND messages.principal_id = progress.principal_id AND messages.audience = 'support')))) OR (activities.activity_type = 'message_wall' AND activities.activity_config ->> 'messageAudience' = 'peers')) \
           AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL \
           AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL \
           AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) \
         FOR UPDATE OF progress",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(current) = current else {
        transaction.commit().await?;
        return Ok(None);
    };

    let next = sqlx::query_as::<_, NextPlayableActivityRow>(
        "SELECT activities.id, activities.activity_type, activities.activity_config \
         FROM learning_activity_transitions AS transitions \
         INNER JOIN learning_activities AS activities ON activities.id = transitions.to_activity_id \
         WHERE transitions.from_activity_id = $1 AND transitions.from_connector = 'completed' AND transitions.trigger = 'completed' \
           AND activities.route_id = $2 AND activities.published_at IS NOT NULL \
         ORDER BY transitions.created_at ASC, transitions.id ASC LIMIT 1",
    )
    .bind(current.activity_id)
    .bind(current.route_id)
    .fetch_optional(&mut *transaction)
    .await?;
    let next_activity_id = match next {
        Some(next)
            if learner_safe_config(&next.activity_type, next.activity_config.clone()).is_some() =>
        {
            Some(next.id)
        }
        Some(_) => {
            transaction.commit().await?;
            return Ok(None);
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
            reflection_is_independent_check: false,
            reflection_observed_cues: None,
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

fn reflection_response_type(config: &serde_json::Value) -> &'static str {
    match config
        .as_object()
        .and_then(|config| config.get("learningIntent"))
        .and_then(serde_json::Value::as_str)
    {
        Some("explain") => "explain",
        Some("transfer") => "transfer",
        _ => "reflection",
    }
}

fn valid_review_outcome(value: Option<&str>) -> bool {
    value.is_none_or(|value| matches!(value, "clearer" | "connected" | "open"))
}

async fn latest_reflection_for_completion(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
    play_run_id: Uuid,
    response_type: &str,
) -> Result<Option<LatestReflectionRow>, sqlx::Error> {
    sqlx::query_as::<_, LatestReflectionRow>(
        "SELECT id, is_independent_check, observed_cues, response_type FROM learner_reflections WHERE principal_id = $1 AND activity_id = $2 AND play_run_id = $3 AND response_type = $4 ORDER BY created_at DESC, id DESC LIMIT 1",
    )
    .bind(principal_id)
    .bind(activity_id)
    .bind(play_run_id)
    .bind(response_type)
    .fetch_optional(&mut **transaction)
    .await
}

async fn load_current_activity_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<CurrentActivityRow>, sqlx::Error> {
    let route = sqlx::query_as::<_, CurrentActivityRow>(
        "SELECT activities.activity_config, activities.activity_type, progress.current_activity_id AS activity_id, FALSE AS is_recall, FALSE AS is_replay, FALSE AS is_revisit, progress.principal_id, routes.id AS route_id FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND activities.slug = $3 AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND activities.activity_type IN ('open_practice', 'question', 'reflection', 'review', 'tool_grant', 'item_grant', 'item_obstacle', 'obstacle', 'markdown', 'npc_dialogue', 'shared_task') AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF progress",
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

    let revisit = sqlx::query_as::<_, CurrentActivityRow>(
        "SELECT activities.activity_config, activities.activity_type, activities.id AS activity_id, FALSE AS is_recall, FALSE AS is_replay, TRUE AS is_revisit, runs.principal_id, routes.id AS route_id FROM learner_revisit_runs AS runs INNER JOIN application_principals AS principals ON principals.id = runs.principal_id INNER JOIN learner_activity_check_ins AS check_ins ON check_ins.id = runs.check_in_id AND check_ins.principal_id = runs.principal_id AND check_ins.activity_id = runs.activity_id INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND activities.slug = $3 AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND activities.activity_type IN ('open_practice', 'question', 'reflection', 'review') AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF runs",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await?;
    if revisit.is_some() {
        return Ok(revisit);
    }

    let recall = sqlx::query_as::<_, CurrentActivityRow>(
        "SELECT activities.activity_config, activities.activity_type, activities.id AS activity_id, TRUE AS is_recall, FALSE AS is_replay, FALSE AS is_revisit, runs.principal_id, routes.id AS route_id FROM learner_recall_runs AS runs INNER JOIN application_principals AS principals ON principals.id = runs.principal_id INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'question' AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF runs",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await?;
    if recall.is_some() {
        return Ok(recall);
    }
    let replay = sqlx::query_as::<_, CurrentActivityRow>(
        "SELECT activities.activity_config, activities.activity_type, activities.id AS activity_id, FALSE AS is_recall, TRUE AS is_replay, FALSE AS is_revisit, runs.principal_id, routes.id AS route_id FROM learner_activity_replay_runs AS runs INNER JOIN application_principals AS principals ON principals.id = runs.principal_id INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type IN ('open_practice', 'question', 'reflection', 'review', 'tool_grant', 'item_grant', 'item_obstacle', 'obstacle', 'markdown', 'npc_dialogue') AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF runs",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await?;

    Ok(replay)
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

async fn learner_has_item_grant_for_run(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
    play_run_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learner_item_grants WHERE principal_id = $1 AND activity_id = $2 AND play_run_id = $3)",
    )
    .bind(principal_id)
    .bind(activity_id)
    .bind(play_run_id)
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

    use super::{
        check_in_context, is_review_activity, markdown_safe_config, message_wall_safe_config,
        reflection_safe_config, valid_review_outcome,
    };

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

    #[test]
    fn markdown_config_exposes_a_bounded_valid_page_graph() {
        let oversized_body = "x".repeat(20_001);
        let config = markdown_safe_config(json!({
            "markdownPages": [
                {
                    "id": "first",
                    "title": "First page",
                    "body": oversized_body,
                    "visual": {
                        "pageColorDark": "not-a-colour",
                        "pageColorLight": "#ffffff"
                    }
                },
                {
                    "id": "first",
                    "title": "Duplicate page",
                    "body": "must not be exposed"
                },
                {
                    "id": "second",
                    "title": "Second page",
                    "body": "A valid page"
                }
            ],
            "markdownTransitions": [
                { "from": "start", "to": "first" },
                { "from": "first", "to": "second" },
                { "from": "second", "to": "end" },
                { "from": "missing", "to": "second" }
            ]
        }))
        .expect("a JSON object has a safe Markdown projection");

        assert_eq!(
            config["markdownPages"]
                .as_array()
                .expect("pages are an array")
                .len(),
            2
        );
        assert_eq!(
            config["markdownPages"][0]["body"].as_str().map(str::len),
            Some(20_000)
        );
        assert_eq!(
            config["markdownPages"][0]["visual"]["pageColorDark"],
            "#0f172a"
        );
        assert_eq!(
            config["markdownTransitions"],
            json!([
                { "from": "start", "to": "first" },
                { "from": "first", "to": "second" },
                { "from": "second", "to": "end" }
            ])
        );
    }

    #[test]
    fn reflection_projection_retains_the_source_review_intent() {
        let config = reflection_safe_config(json!({
            "prompt": "Review this idea.",
            "learningIntent": "review",
        }))
        .expect("review has a safe reflection projection");

        assert_eq!(config["learningIntent"], "review");
        assert!(is_review_activity("reflection", &config));
        assert!(is_review_activity("review", &json!({})));
    }

    #[test]
    fn review_outcomes_are_limited_to_the_source_defined_choices() {
        assert!(valid_review_outcome(None));
        assert!(valid_review_outcome(Some("clearer")));
        assert!(valid_review_outcome(Some("connected")));
        assert!(valid_review_outcome(Some("open")));
        assert!(!valid_review_outcome(Some("completed")));
        assert!(!valid_review_outcome(Some("invented")));
    }

    #[test]
    fn peer_wall_requires_the_source_audience_and_topic_binding() {
        let valid = json!({
            "messageAudience": "peers",
            "messageTopicId": "00000000-0000-4000-8000-000000000042",
            "messagePrompt": "What did you notice?",
            "messageInputLabel": "Your note",
            "messageAllowResponses": true,
            "messageResponsePrompt": "Add a small clue or question.",
            "messageUi": { "accentColorDark": "#5eead4" },
        });
        let safe = message_wall_safe_config(valid).expect("valid peer wall config");
        assert_eq!(
            safe["messageResponsePrompt"],
            "Add a small clue or question."
        );
        assert_eq!(safe["messageUi"]["accentColorDark"], "#5eead4");
        assert!(
            message_wall_safe_config(json!({
                "messageAudience": "support",
                "messageTopicId": "00000000-0000-4000-8000-000000000042",
                "messagePrompt": "What did you notice?",
                "messageInputLabel": "Your note",
            }))
            .is_none()
        );
        assert!(
            message_wall_safe_config(json!({
                "messageAudience": "peers",
                "messageTopicId": "not-a-uuid",
                "messagePrompt": "What did you notice?",
                "messageInputLabel": "Your note",
            }))
            .is_none()
        );
    }

    #[test]
    fn reflection_projection_retains_only_source_safe_explanation_guidance() {
        let config = reflection_safe_config(json!({
            "prompt": "Explain the idea.",
            "learningIntent": "explain",
            "feedbackGuidance": {
                "purpose": "Make your reasoning visible.",
                "independentCheckFeedback": "Compare your fresh response.",
                "rubric": ["Names a reason", "Names a reason", 4]
            }
        }))
        .expect("explanation has a safe learner projection");

        assert_eq!(config["learningIntent"], "explain");
        assert_eq!(
            config["feedbackGuidance"]["independentCheckFeedback"],
            "Compare your fresh response."
        );
        assert_eq!(
            config["feedbackGuidance"]["rubric"],
            json!(["Names a reason"])
        );
    }
}
