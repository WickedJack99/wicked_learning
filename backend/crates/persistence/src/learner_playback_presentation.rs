use std::collections::{BTreeMap, HashMap, HashSet};

use serde_json::Value;
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::{
    admin_activity_feedback_guidance::ActivityFeedbackGuidanceForm,
    admin_activity_source_references::{
        ActivitySourceReferencesForm, SubmittedActivitySourceReference,
    },
};
use wicked_learning_domain::learner_state::{
    LearnerItem, LearnerNpcDialogueNode, LearnerNpcDialogueTypingSound,
    LearnerNpcDialogueTypingSoundSet, LearnerPlaybackConfiguredSound,
    LearnerPlaybackFeedbackGuidance, LearnerPlaybackGraph, LearnerPlaybackNpcTransition,
    LearnerPlaybackPresentation, LearnerPlaybackQuestion, LearnerPlaybackQuestionOption,
    LearnerPlaybackSourceReference, LearnerTool,
};

use crate::learner_media::{learner_item, learner_media_config, learner_media_url, learner_tool};

const MAX_RESOURCES: usize = 4096;
const MAX_NPC_EDGES: usize = 8192;
const MAX_SOUND_SETS: usize = 256;
const MAX_TYPING_SOUNDS: usize = MAX_SOUND_SETS * 26;

fn unavailable() -> sqlx::Error {
    sqlx::Error::Protocol("incomplete published playback presentation".into())
}

fn text<'a>(value: &'a Value, key: &str) -> Option<&'a str> {
    value.get(key).and_then(Value::as_str)
}

pub(super) fn metadata(
    id: Uuid,
    kind: &str,
    config: &Value,
) -> Result<LearnerPlaybackPresentation, sqlx::Error> {
    let references = config
        .get("sourceReferences")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or_default();
    let sources = ActivitySourceReferencesForm::parse(
        references
            .iter()
            .take(5)
            .map(|value| SubmittedActivitySourceReference {
                title: text(value, "title"),
                url: text(value, "url"),
                publisher: text(value, "publisher"),
                published_at: text(value, "publishedAt"),
                rights: text(value, "rights"),
                anchor: text(value, "anchor"),
                excerpt: text(value, "excerpt"),
                concepts: value
                    .get("concepts")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                    .take(8)
                    .filter_map(Value::as_str)
                    .collect(),
            })
            .collect(),
    )
    .ok_or_else(unavailable)?
    .references
    .into_iter()
    .map(|source| LearnerPlaybackSourceReference {
        title: source.title,
        url: source.url,
        publisher: source.publisher,
        published_at: source.published_at,
        rights: source.rights,
        anchor: source.anchor,
        excerpt: source.excerpt,
        concepts: source.concepts,
    })
    .collect();
    let guidance = &config["feedbackGuidance"];
    let rubric: Vec<_> = match &guidance["rubric"] {
        Value::String(value) => value.lines().take(3).collect(),
        Value::Array(values) => values.iter().take(3).filter_map(Value::as_str).collect(),
        _ => Vec::new(),
    };
    let guidance = ActivityFeedbackGuidanceForm::parse(
        text(guidance, "purpose"),
        text(guidance, "evidence"),
        text(guidance, "responseFeedback"),
        text(guidance, "nextAction"),
        rubric,
        text(guidance, "independentCheckPrompt"),
        text(guidance, "independentCheckFeedback"),
    )
    .ok_or_else(unavailable)?;
    let feedback_guidance = (!guidance.is_empty()).then_some(LearnerPlaybackFeedbackGuidance {
        purpose: guidance.purpose,
        evidence: guidance.evidence,
        next_action: guidance.next_action,
        response_feedback: guidance.response_feedback,
        independent_check_prompt: guidance.independent_check_prompt,
        independent_check_feedback: guidance.independent_check_feedback,
        rubric: guidance.rubric,
    });
    Ok(LearnerPlaybackPresentation {
        sources,
        feedback_guidance,
        completion_choice_prompt: text(config, "completionChoicePrompt")
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(str::to_owned),
        question: if kind == "question" {
            Some(question(id, config).ok_or_else(unavailable)?)
        } else {
            None
        },
        ..Default::default()
    })
}

fn question(id: Uuid, config: &Value) -> Option<LearnerPlaybackQuestion> {
    let options = config.get("options")?.as_array()?;
    if options.is_empty() || options.len() > 24 {
        return None;
    }
    let mut keys = HashSet::new();
    let options = options
        .iter()
        .map(|option| {
            let key = text(option, "key")?;
            if key.is_empty() || !keys.insert(key) {
                return None;
            }
            let weights = match option.get("weights") {
                Some(Value::Object(values)) if values.len() <= 128 => values
                    .iter()
                    .map(|(key, value)| Some((key.clone(), value.as_f64()?)))
                    .collect::<Option<BTreeMap<_, _>>>()?,
                None | Some(Value::Null) => BTreeMap::new(),
                _ => return None,
            };
            Some(LearnerPlaybackQuestionOption {
                key: key.into(),
                label: text(option, "label")?.into(),
                body: text(option, "body")?.into(),
                outcome_key: text(option, "outcomeKey").map(str::to_owned),
                weights,
            })
        })
        .collect::<Option<Vec<_>>>()?;
    Some(LearnerPlaybackQuestion {
        activity_id: id,
        prompt: text(config, "prompt")?.into(),
        allow_multiple: config.get("allowMultiple")?.as_bool()?,
        options,
    })
}

#[derive(FromRow)]
struct ItemRow {
    id: Uuid,
    slug: String,
    title: String,
    description: Option<String>,
    image_dark: Option<String>,
    image_light: Option<String>,
    config: Value,
}
#[derive(FromRow)]
struct ToolRow {
    id: Uuid,
    slug: String,
    title: String,
    description: Option<String>,
    image_dark: Option<String>,
    image_light: Option<String>,
    animation_dark: Option<String>,
    animation_light: Option<String>,
    config: Value,
}
#[derive(FromRow)]
struct SoundRow {
    id: Uuid,
    slug: String,
    name: String,
    icon: Option<String>,
    url: String,
    volume: i16,
    play_seconds: Option<f64>,
    looped: bool,
}
#[derive(FromRow)]
struct NpcNodeRow {
    activity_id: Uuid,
    id: Uuid,
    node_type: String,
    title: String,
    body: Option<String>,
    config: Value,
}
#[derive(FromRow)]
struct NpcEdgeRow {
    activity_id: Uuid,
    id: Uuid,
    from_node_id: Option<Uuid>,
    to_node_id: Uuid,
    from_connector: String,
    to_connector: Option<String>,
}
#[derive(FromRow)]
struct SoundSetRow {
    id: Uuid,
    name: String,
    is_default: bool,
}
#[derive(FromRow)]
struct TypingSoundRow {
    id: Uuid,
    sound_set_id: Uuid,
    letter: String,
    url: String,
    volume: i16,
}

fn item_references<'a>(kind: &str, config: &'a Value) -> Vec<&'a str> {
    config
        .get(if kind == "item_grant" {
            "items"
        } else {
            "slots"
        })
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|v| text(v, "itemId"))
        .collect()
}
fn sound_references(config: &Value) -> HashSet<Uuid> {
    config
        .get("sounds")
        .and_then(Value::as_object)
        .into_iter()
        .flat_map(|v| v.values())
        .chain(config.get("ambientSound"))
        .filter_map(|v| text(v, "soundId"))
        .filter_map(|v| Uuid::parse_str(v).ok())
        .collect()
}
fn checked_len(len: usize, maximum: usize) -> Result<(), sqlx::Error> {
    if len > maximum {
        Err(unavailable())
    } else {
        Ok(())
    }
}

/// Called only after the active run's published node graph was authorized.
/// Catalogs and dialogue definitions are loaded once for the whole graph,
/// never once per activity. Missing authored references retain source null/empty
/// semantics; collection overflow is unavailable rather than silently truncated.
pub(super) async fn enrich(
    transaction: &mut Transaction<'_, Postgres>,
    graph: &mut LearnerPlaybackGraph,
    configs: &HashMap<Uuid, Value>,
) -> Result<(), sqlx::Error> {
    let mut item_slugs = HashSet::new();
    let mut tool_slugs = HashSet::new();
    let mut sound_ids = HashSet::new();
    let mut npc_ids = Vec::new();
    for activity in &graph.activities {
        let config = configs.get(&activity.id).ok_or_else(unavailable)?;
        item_slugs.extend(
            item_references(&activity.activity_type, config)
                .into_iter()
                .map(str::to_owned),
        );
        if activity.activity_type == "tool_grant" {
            if let Some(slug) = text(config, "toolId") {
                tool_slugs.insert(slug.to_owned());
            }
        }
        sound_ids.extend(sound_references(config));
        if activity.activity_type == "npc_dialogue" {
            npc_ids.push(activity.id);
        }
    }
    for count in [item_slugs.len(), tool_slugs.len(), sound_ids.len()] {
        checked_len(count, MAX_RESOURCES)?;
    }
    let items = if item_slugs.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_,ItemRow>("SELECT id,slug,title,description,image_dark,image_light,config FROM learning_items WHERE slug = ANY($1) ORDER BY id LIMIT $2")
            .bind(item_slugs.into_iter().collect::<Vec<_>>()).bind((MAX_RESOURCES+1) as i64).fetch_all(&mut **transaction).await?
    };
    let tools = if tool_slugs.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_,ToolRow>("SELECT id,slug,title,description,image_dark,image_light,animation_dark,animation_light,config FROM learning_tools WHERE slug = ANY($1) ORDER BY id LIMIT $2")
            .bind(tool_slugs.into_iter().collect::<Vec<_>>()).bind((MAX_RESOURCES+1) as i64).fetch_all(&mut **transaction).await?
    };
    let sounds = if sound_ids.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_,SoundRow>("SELECT id,slug,name,icon,url,volume,play_seconds::float8 AS play_seconds,loop AS looped FROM learning_sounds WHERE id = ANY($1) AND published_at IS NOT NULL ORDER BY id LIMIT $2")
            .bind(sound_ids.into_iter().collect::<Vec<_>>()).bind((MAX_RESOURCES+1) as i64).fetch_all(&mut **transaction).await?
    };
    let nodes = if npc_ids.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_,NpcNodeRow>("SELECT activity_id,id,node_type,title,body,node_config AS config FROM learning_npc_dialogue_nodes WHERE activity_id = ANY($1) ORDER BY activity_id,sort_order,id LIMIT $2")
            .bind(&npc_ids).bind((MAX_RESOURCES+1) as i64).fetch_all(&mut **transaction).await?
    };
    let edges = if npc_ids.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_,NpcEdgeRow>("SELECT activity_id,id,from_node_id,to_node_id,from_connector,to_connector FROM learning_npc_dialogue_transitions WHERE activity_id = ANY($1) ORDER BY activity_id,created_at,id LIMIT $2")
            .bind(&npc_ids).bind((MAX_NPC_EDGES+1) as i64).fetch_all(&mut **transaction).await?
    };
    for count in [items.len(), tools.len(), sounds.len(), nodes.len()] {
        checked_len(count, MAX_RESOURCES)?;
    }
    checked_len(edges.len(), MAX_NPC_EDGES)?;
    let enabled: Vec<_> = nodes
        .iter()
        .filter(|n| n.config.get("typingSoundEnabled").and_then(Value::as_bool) == Some(true))
        .collect();
    let configured_sets: HashSet<_> = enabled
        .iter()
        .filter_map(|n| text(&n.config, "typingSoundSetId"))
        .filter_map(|v| Uuid::parse_str(v).ok())
        .collect();
    let uses_default = enabled.iter().any(|node| {
        text(&node.config, "typingSoundSetId")
            .and_then(|id| Uuid::parse_str(id).ok())
            .is_none()
    });
    checked_len(configured_sets.len(), MAX_SOUND_SETS)?;
    let sets = if enabled.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_,SoundSetRow>("SELECT id,name,is_default FROM learning_dialogue_typing_sound_sets WHERE (is_default AND $3) OR id = ANY($1) ORDER BY is_default DESC,name,id LIMIT $2")
            .bind(configured_sets.into_iter().collect::<Vec<_>>()).bind((MAX_SOUND_SETS+1) as i64).bind(uses_default).fetch_all(&mut **transaction).await?
    };
    checked_len(sets.len(), MAX_SOUND_SETS)?;
    let typing = if sets.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_,TypingSoundRow>("SELECT id,sound_set_id,letter,url,volume FROM learning_dialogue_typing_sounds WHERE sound_set_id = ANY($1) ORDER BY sound_set_id,letter LIMIT $2")
            .bind(sets.iter().map(|s|s.id).collect::<Vec<_>>()).bind((MAX_TYPING_SOUNDS+1) as i64).fetch_all(&mut **transaction).await?
    };
    checked_len(typing.len(), MAX_TYPING_SOUNDS)?;
    let items: HashMap<_, _> = items
        .into_iter()
        .map(|i| {
            let item = learner_item(LearnerItem {
                id: i.id,
                slug: i.slug,
                title: i.title,
                description: i.description,
                image_dark: i.image_dark,
                image_light: i.image_light,
                config: i.config,
                quantity: 0,
            });
            (item.slug.clone(), item)
        })
        .collect();
    let tools: HashMap<_, _> = tools
        .into_iter()
        .map(|t| {
            let tool = learner_tool(LearnerTool {
                id: t.id,
                slug: t.slug,
                title: t.title,
                description: t.description,
                image_dark: t.image_dark,
                image_light: t.image_light,
                animation_dark: t.animation_dark,
                animation_light: t.animation_light,
                config: t.config,
            });
            (tool.slug.clone(), tool)
        })
        .collect();
    let sounds: HashMap<_, _> = sounds
        .into_iter()
        .map(|s| {
            (
                s.id,
                LearnerPlaybackConfiguredSound {
                    id: s.id,
                    slug: s.slug,
                    name: s.name,
                    icon: s.icon,
                    url: learner_media_url(&s.url),
                    volume: s.volume,
                    play_seconds: s.play_seconds,
                    looped: s.looped,
                },
            )
        })
        .collect();
    let mut typing_by_set: HashMap<_, BTreeMap<_, _>> = HashMap::new();
    for s in typing {
        typing_by_set.entry(s.sound_set_id).or_default().insert(
            s.letter.clone(),
            LearnerNpcDialogueTypingSound {
                id: s.id.to_string(),
                letter: s.letter,
                url: learner_media_url(&s.url),
                volume: s.volume,
            },
        );
    }
    let sets: Vec<_> = sets
        .into_iter()
        .map(|s| LearnerNpcDialogueTypingSoundSet {
            id: s.id.to_string(),
            name: s.name,
            is_default: s.is_default,
            sounds: typing_by_set.remove(&s.id).unwrap_or_default(),
        })
        .collect();
    let mut nodes_by_activity: HashMap<Uuid, Vec<NpcNodeRow>> = HashMap::new();
    let mut edges_by_activity: HashMap<Uuid, Vec<NpcEdgeRow>> = HashMap::new();
    for node in nodes {
        nodes_by_activity
            .entry(node.activity_id)
            .or_default()
            .push(node);
    }
    for edge in edges {
        edges_by_activity
            .entry(edge.activity_id)
            .or_default()
            .push(edge);
    }
    for activity in &mut graph.activities {
        let config = configs.get(&activity.id).ok_or_else(unavailable)?;
        let item_refs: HashSet<_> = item_references(&activity.activity_type, config)
            .into_iter()
            .collect();
        let sound_refs = sound_references(config);
        let presentation = &mut activity.presentation;
        presentation.configured_items = item_refs
            .into_iter()
            .filter_map(|reference| items.get(reference))
            .cloned()
            .collect();
        presentation.configured_items.sort_by_key(|item| item.id);
        presentation.configured_tool = if activity.activity_type == "tool_grant" {
            text(config, "toolId").and_then(|s| tools.get(s)).cloned()
        } else {
            None
        };
        presentation.configured_sounds = sound_refs
            .iter()
            .filter_map(|id| sounds.get(id))
            .cloned()
            .collect();
        presentation.configured_sounds.sort_by_key(|sound| sound.id);
        let activity_nodes = nodes_by_activity.remove(&activity.id).unwrap_or_default();
        presentation.dialogue_typing_sound_sets = sets
            .iter()
            .filter(|set| {
                activity_nodes.iter().any(|n| {
                    n.config.get("typingSoundEnabled").and_then(Value::as_bool) == Some(true)
                        && match text(&n.config, "typingSoundSetId")
                            .and_then(|id| Uuid::parse_str(id).ok())
                        {
                            Some(id) => set.id == id.to_string(),
                            None => set.is_default,
                        }
                })
            })
            .cloned()
            .collect();
        presentation.npc_dialogue_nodes = activity_nodes
            .iter()
            .map(|n| LearnerNpcDialogueNode {
                id: n.id.to_string(),
                node_type: n.node_type.clone(),
                title: n.title.clone(),
                body: n.body.clone(),
                config: learner_media_config(n.config.clone()),
            })
            .collect();
        presentation.npc_dialogue_transitions = edges_by_activity
            .remove(&activity.id)
            .unwrap_or_default()
            .into_iter()
            .map(|e| LearnerPlaybackNpcTransition {
                id: e.id,
                from_node_id: e.from_node_id,
                to_node_id: e.to_node_id,
                from_connector: e.from_connector.clone(),
                to_connector: e.to_connector.clone().unwrap_or_else(|| "in".into()),
            })
            .collect();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::metadata;
    use serde_json::json;
    use uuid::Uuid;

    #[test]
    fn source_metadata_normalizes_optional_fields_without_exposing_unknown_configuration() {
        let presentation = metadata(Uuid::new_v4(),"reflection",&json!({
            "sourceReferences":[{"title":" Source ","url":"https://example.test","excerpt":"é".repeat(900),"concepts":["Pattern","pattern"," Connection "]}],
            "feedbackGuidance":{"purpose":" Explain ","rubric":" First cue\n\n Second cue\nNot in the first three lines"},
            "completionChoicePrompt":" Choose your next direction ","internalReview":"private"
        })).unwrap();
        assert_eq!(presentation.sources[0].title, "Source");
        assert_eq!(
            presentation.sources[0]
                .excerpt
                .as_ref()
                .unwrap()
                .chars()
                .count(),
            800
        );
        assert_eq!(
            presentation.sources[0].concepts,
            vec!["Pattern", "Connection"]
        );
        let guidance = presentation.feedback_guidance.as_ref().unwrap();
        assert_eq!(guidance.purpose.as_deref(), Some("Explain"));
        assert_eq!(guidance.rubric, vec!["First cue", "Second cue"]);
        assert_eq!(
            presentation.completion_choice_prompt.as_deref(),
            Some("Choose your next direction")
        );
        assert!(
            !serde_json::to_string(&presentation)
                .unwrap()
                .contains("private")
        );
        let empty = metadata(Uuid::new_v4(), "open_practice", &json!({})).unwrap();
        assert!(empty.feedback_guidance.is_none());
        assert!(empty.completion_choice_prompt.is_none());
        assert!(empty.sources.is_empty());
    }

    #[test]
    fn question_uses_native_keys_and_excludes_correctness_and_feedback() {
        let id = Uuid::new_v4();
        let mut config = json!({"prompt":"Choose","allowMultiple":false,"options":[{"key":"stable-key","label":"A","body":"A direction","outcomeKey":"explore","weights":{"orientation":0.5},"isCorrect":true,"feedback":"Private feedback"}],"explanation":"Private explanation"});
        let presentation = metadata(id, "question", &config).unwrap();
        let question = presentation.question.as_ref().unwrap();
        assert_eq!(question.activity_id, id);
        assert_eq!(question.options[0].key, "stable-key");
        assert_eq!(question.options[0].outcome_key.as_deref(), Some("explore"));
        assert_eq!(question.options[0].weights["orientation"], 0.5);
        let serialized = serde_json::to_string(&presentation).unwrap();
        assert!(!serialized.contains("isCorrect"));
        assert!(!serialized.contains("Private"));
        config["options"][0]["weights"] = json!({"orientation":"not a number"});
        assert!(metadata(id, "question", &config).is_err());
        config["options"][0]["weights"] = json!({});
        let duplicate = config["options"][0].clone();
        config["options"].as_array_mut().unwrap().push(duplicate);
        assert!(metadata(id, "question", &config).is_err());
    }

    #[test]
    fn source_references_use_the_first_five_and_ignore_incomplete_entries() {
        let config = json!({"sourceReferences":[{}, {"title":"One","url":"https://example.test/one"}, {"title":"Two","url":"https://example.test/two"}, {}, {}, {"title":"Excluded","url":"https://example.test/six"}]});
        let presentation = metadata(Uuid::new_v4(), "markdown", &config).unwrap();
        assert_eq!(presentation.sources.len(), 2);
        assert_eq!(presentation.sources[0].title, "One");
        assert_eq!(presentation.sources[1].title, "Two");
    }
}
