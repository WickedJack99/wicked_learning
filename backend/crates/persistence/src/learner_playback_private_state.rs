use std::collections::{HashMap, HashSet};

use serde_json::Value;
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_domain::learner_state::{
    LearnerItemObstacleFilledSlot, LearnerItemObstacleState, LearnerPlaybackActivityProgress,
    LearnerPlaybackAnswerProgress, LearnerPlaybackGraph, LearnerPlaybackGraphActivity,
    LearnerPlaybackObstacleResolution, LearnerPlaybackPrivateState, LearnerPlaybackSavedChecklist,
    LearnerPlaybackSavedDialogue, LearnerPlaybackSavedItemObstacle, LearnerQuestionEarlierAttempt,
};

use crate::{
    learner_item_obstacle::{FilledSlotRow, conditions_met, configured_slots},
    learner_question::{QuestionConfig, selected_option_labels, transition_choice},
};

fn unavailable() -> sqlx::Error {
    sqlx::Error::Protocol("incomplete private playback state".into())
}

#[derive(FromRow)]
struct ProgressRow {
    activity_id: Uuid,
    status: String,
    completed_at: Option<String>,
}
#[derive(FromRow)]
struct AnswerRow {
    feedback: Option<String>,
    feedback_recorded: bool,
    activity_id: Uuid,
    config: Value,
    selected_option_keys: Value,
    is_correct: bool,
    attempt_number: i32,
    confidence: Option<String>,
    calibration: Option<String>,
    answered_at: String,
}
#[derive(FromRow)]
struct DialogueRow {
    activity_id: Uuid,
    current_node_id: Uuid,
    history: Value,
}
#[derive(FromRow)]
struct ChecklistRow {
    activity_id: Uuid,
    completed_step_indexes: Vec<i16>,
}
#[derive(FromRow)]
struct ItemStateRow {
    activity_id: Uuid,
    locked_until: Option<String>,
}
#[derive(FromRow)]
struct SlotRow {
    activity_id: Uuid,
    item_slug: String,
    slot_index: i16,
}
#[derive(FromRow)]
struct ResolutionRow {
    activity_id: Uuid,
    resolved_at: String,
}

/// The caller has already authorized the run and the bounded published graph.
/// Each collection is read in one batch and is private to this principal;
/// transient dialogue/checklist rows additionally belong to this exact run.
pub(crate) async fn load(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    play_run_id: Uuid,
    graph: &LearnerPlaybackGraph,
) -> Result<LearnerPlaybackPrivateState, sqlx::Error> {
    let activities: HashMap<_, _> = graph.activities.iter().map(|a| (a.id, a)).collect();
    let ids: Vec<_> = graph.activities.iter().map(|a| a.id).collect();
    let kind_ids = |kind: &str| {
        graph
            .activities
            .iter()
            .filter(|a| a.activity_type == kind)
            .map(|a| a.id)
            .collect::<Vec<_>>()
    };
    let progress = sqlx::query_as::<_, ProgressRow>(
        "SELECT activity_id,status,to_char(completed_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS completed_at FROM learner_activity_progress WHERE principal_id=$1 AND activity_id=ANY($2) ORDER BY activity_id")
        .bind(principal_id).bind(&ids).fetch_all(&mut **transaction).await?;
    let mut state = LearnerPlaybackPrivateState {
        activities: progress
            .into_iter()
            .map(|p| LearnerPlaybackActivityProgress {
                activity_id: p.activity_id,
                status: p.status,
                completed_at: p.completed_at,
            })
            .collect(),
        ..Default::default()
    };
    let questions = kind_ids("question");
    if !questions.is_empty() {
        // The history index bounds each question to four rows, including when
        // a learner has many old attempts. No all-history window materialization.
        let answers = sqlx::query_as::<_, AnswerRow>(
            "SELECT a.id AS activity_id,a.activity_config AS config,h.feedback,h.feedback_recorded,h.selected_option_keys,h.is_correct,h.attempt_number,h.confidence,h.calibration,to_char(h.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS answered_at FROM learning_activities a CROSS JOIN LATERAL (SELECT feedback,feedback_recorded,selected_option_keys,is_correct,attempt_number,confidence,calibration,created_at,id FROM learner_question_answers WHERE principal_id=$1 AND activity_id=a.id ORDER BY created_at DESC,id DESC LIMIT 4) h WHERE a.id=ANY($2) ORDER BY a.id,h.created_at DESC,h.id DESC")
            .bind(principal_id).bind(&questions).fetch_all(&mut **transaction).await?;
        let mut grouped: HashMap<Uuid, Vec<AnswerRow>> = HashMap::new();
        for answer in answers {
            grouped.entry(answer.activity_id).or_default().push(answer);
        }
        for activity in &graph.activities {
            if let Some(answers) = grouped.remove(&activity.id) {
                state.answers.push(answer_progress(activity, &answers)?);
            }
        }
        state.recall_activity_ids = sqlx::query_scalar("SELECT activity_id FROM learner_recall_items WHERE principal_id=$1 AND activity_id=ANY($2) ORDER BY activity_id")
            .bind(principal_id).bind(&questions).fetch_all(&mut **transaction).await?;
    }
    let dialogues = kind_ids("npc_dialogue");
    if !dialogues.is_empty() {
        let rows = sqlx::query_as::<_, DialogueRow>("SELECT activity_id,current_node_id,history FROM learner_npc_dialogue_states WHERE principal_id=$1 AND play_run_id=$2 AND activity_id=ANY($3) ORDER BY activity_id")
            .bind(principal_id).bind(play_run_id).bind(&dialogues).fetch_all(&mut **transaction).await?;
        for row in rows {
            let activity = activities[&row.activity_id];
            let history: Vec<Uuid> =
                serde_json::from_value(row.history).map_err(|_| unavailable())?;
            let nodes: HashSet<_> = activity
                .presentation
                .npc_dialogue_nodes
                .iter()
                .map(|n| n.id.as_str())
                .collect();
            validate_dialogue(row.current_node_id, &history, &nodes)?;
            state.npc_dialogues.push(LearnerPlaybackSavedDialogue {
                activity_id: row.activity_id,
                current_node_id: row.current_node_id,
                history,
            });
        }
    }
    let tasks = kind_ids("shared_task");
    if !tasks.is_empty() {
        let rows = sqlx::query_as::<_, ChecklistRow>("SELECT activity_id,completed_step_indexes FROM learner_shared_task_checklists WHERE principal_id=$1 AND play_run_id=$2 AND activity_id=ANY($3) ORDER BY activity_id")
            .bind(principal_id).bind(play_run_id).bind(&tasks).fetch_all(&mut **transaction).await?;
        for row in rows {
            let indexes = checklist_indexes(
                &activities[&row.activity_id].config,
                row.completed_step_indexes,
            )?;
            state
                .shared_task_checklists
                .push(LearnerPlaybackSavedChecklist {
                    activity_id: row.activity_id,
                    completed_step_indexes: indexes,
                });
        }
    }
    let obstacles = kind_ids("item_obstacle");
    if !obstacles.is_empty() {
        let rows = sqlx::query_as::<_, ItemStateRow>("SELECT activity_id,to_char(locked_until AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS locked_until FROM learner_item_obstacle_states WHERE principal_id=$1 AND activity_id=ANY($2) ORDER BY activity_id")
            .bind(principal_id).bind(&obstacles).fetch_all(&mut **transaction).await?;
        let slots = sqlx::query_as::<_, SlotRow>("SELECT s.activity_id,i.slug AS item_slug,s.slot_index FROM learner_item_obstacle_slots s INNER JOIN learning_items i ON i.id=s.item_id WHERE s.principal_id=$1 AND s.activity_id=ANY($2) ORDER BY s.activity_id,s.slot_index")
            .bind(principal_id).bind(&obstacles).fetch_all(&mut **transaction).await?;
        let mut by_activity: HashMap<Uuid, Vec<FilledSlotRow>> = HashMap::new();
        for slot in slots {
            by_activity
                .entry(slot.activity_id)
                .or_default()
                .push(FilledSlotRow {
                    item_slug: slot.item_slug,
                    slot_index: slot.slot_index,
                });
        }
        for row in rows {
            let slots = by_activity.remove(&row.activity_id).unwrap_or_default();
            let configured = configured_slots(&activities[&row.activity_id].config);
            let met = conditions_met(&configured, &slots);
            state.item_obstacles.push(LearnerPlaybackSavedItemObstacle {
                activity_id: row.activity_id,
                state: LearnerItemObstacleState {
                    can_continue: None,
                    conditions_met: met,
                    locked_until: row.locked_until,
                    filled_slots: slots
                        .into_iter()
                        .map(|s| LearnerItemObstacleFilledSlot {
                            item_slug: s.item_slug,
                            slot_index: s.slot_index,
                        })
                        .collect(),
                },
            });
        }
    }
    let obstacles = kind_ids("obstacle");
    if !obstacles.is_empty() {
        let rows = sqlx::query_as::<_, ResolutionRow>("SELECT activity_id,to_char(resolved_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS resolved_at FROM learner_obstacle_resolutions WHERE principal_id=$1 AND activity_id=ANY($2) ORDER BY activity_id")
            .bind(principal_id).bind(&obstacles).fetch_all(&mut **transaction).await?;
        state.obstacle_resolutions = rows
            .into_iter()
            .map(|r| LearnerPlaybackObstacleResolution {
                activity_id: r.activity_id,
                resolved_at: r.resolved_at,
            })
            .collect();
    }
    Ok(state)
}

fn validate_dialogue(
    current: Uuid,
    history: &[Uuid],
    nodes: &HashSet<&str>,
) -> Result<(), sqlx::Error> {
    if history.len() > 40
        || !nodes.contains(current.to_string().as_str())
        || history
            .iter()
            .any(|id| !nodes.contains(id.to_string().as_str()))
    {
        return Err(unavailable());
    }
    Ok(())
}
fn checklist_indexes(config: &Value, mut indexes: Vec<i16>) -> Result<Vec<i16>, sqlx::Error> {
    let count = config
        .get("projectSteps")
        .and_then(Value::as_array)
        .map(|steps| {
            steps
                .iter()
                .filter_map(Value::as_str)
                .filter(|s| !s.trim().is_empty())
                .count()
        })
        .unwrap_or(0);
    if indexes.len() > 6 || indexes.iter().any(|i| *i < 0 || *i as usize >= count) {
        return Err(unavailable());
    }
    indexes.sort_unstable();
    indexes.dedup();
    Ok(indexes)
}
fn answer_progress(
    activity: &LearnerPlaybackGraphActivity,
    rows: &[AnswerRow],
) -> Result<LearnerPlaybackAnswerProgress, sqlx::Error> {
    let latest = rows.first().ok_or_else(unavailable)?;
    if !latest.feedback_recorded {
        return Err(unavailable());
    }
    let config: QuestionConfig =
        serde_json::from_value(latest.config.clone()).map_err(|_| unavailable())?;
    let selected_keys = |row: &AnswerRow| -> Result<Vec<String>, sqlx::Error> {
        let keys: Vec<String> =
            serde_json::from_value(row.selected_option_keys.clone()).map_err(|_| unavailable())?;
        if keys.is_empty()
            || keys.len() > 24
            || keys.iter().collect::<HashSet<_>>().len() != keys.len()
            || (!config.allow_multiple && keys.len() != 1)
            || keys
                .iter()
                .any(|k| !config.options.iter().any(|o| &o.key == k))
        {
            return Err(unavailable());
        }
        Ok(keys)
    };
    let keys = selected_keys(latest)?;
    // Authored option ordering matches the existing native answer command.
    let selected = config
        .options
        .iter()
        .filter(|o| keys.contains(&o.key))
        .collect::<Vec<_>>();
    let (outcome, correct) = transition_choice(&config, &selected, latest.is_correct);
    let transition = outcome
        .and_then(|outcome| {
            activity
                .transitions
                .iter()
                .find(|e| e.trigger == "outcome" && e.trigger_value.as_deref() == Some(outcome))
        })
        .or_else(|| {
            activity
                .transitions
                .iter()
                .find(|e| e.trigger == if correct { "correct" } else { "incorrect" })
        });
    let earlier_attempts = rows
        .iter()
        .skip(1)
        .take(3)
        .map(|row| {
            let labels = selected_option_labels(&config.options, &selected_keys(row)?)
                .ok_or_else(unavailable)?;
            Ok(LearnerQuestionEarlierAttempt {
                answered_at: row.answered_at.clone(),
                calibration: row.calibration.clone(),
                confidence: row.confidence.clone(),
                is_correct: row.is_correct,
                option_label: labels.first().cloned(),
                option_labels: labels,
            })
        })
        .collect::<Result<Vec<_>, sqlx::Error>>()?;
    Ok(LearnerPlaybackAnswerProgress {
        activity_id: activity.id,
        selected_option_keys: keys,
        is_correct: latest.is_correct,
        attempt_number: latest.attempt_number,
        confidence: latest.confidence.clone(),
        calibration: latest.calibration.clone(),
        feedback: latest.feedback.clone(),
        explanation: config.explanation,
        next_activity_id: transition.and_then(|e| e.to_activity_id),
        next_transition_label: transition.and_then(|e| e.label.clone()),
        earlier_attempts,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn saved_dialogue_never_replaces_an_invalid_cursor_or_truncates_history() {
        let node = Uuid::new_v4();
        let id = node.to_string();
        let nodes = HashSet::from([id.as_str()]);
        assert!(validate_dialogue(node, &vec![node; 40], &nodes).is_ok());
        assert!(validate_dialogue(node, &vec![node; 41], &nodes).is_err());
        assert!(validate_dialogue(Uuid::new_v4(), &[], &nodes).is_err());
        assert!(validate_dialogue(node, &[Uuid::new_v4()], &nodes).is_err());
    }

    #[test]
    fn saved_checklist_preserves_source_ordering_and_rejects_removed_steps() {
        let config = json!({"projectSteps":["Notice","", " Explain "]});
        assert_eq!(
            checklist_indexes(&config, vec![1, 0, 1]).unwrap(),
            vec![0, 1]
        );
        assert!(checklist_indexes(&config, vec![2]).is_err());
        assert!(checklist_indexes(&config, vec![-1]).is_err());
        assert!(checklist_indexes(&config, vec![0; 7]).is_err());
    }

    #[test]
    fn earlier_answer_labels_follow_authored_order_not_submission_order() {
        let config: QuestionConfig = serde_json::from_value(json!({"allowMultiple":true,"options":[{"key":"a","label":"A","isCorrect":true},{"key":"b","label":"B","isCorrect":false}]})).unwrap();
        assert_eq!(
            selected_option_labels(&config.options, &["b".into(), "a".into()]).unwrap(),
            vec!["A", "B"]
        );
        assert!(selected_option_labels(&config.options, &["removed".into()]).is_none());
    }

    #[test]
    fn feedback_matches_source_single_and_multiple_choice_rules() {
        let mut config: QuestionConfig = serde_json::from_value(json!({"allowMultiple":false,"feedbackCorrect":"Aggregate","feedbackIncorrect":"Try again","options":[{"key":"a","label":"A","isCorrect":true,"feedback":"Specific"}]})).unwrap();
        assert_eq!(
            crate::learner_question::feedback_for_selection(&config, &[&config.options[0]], true)
                .as_deref(),
            Some("Specific")
        );
        config.allow_multiple = true;
        assert_eq!(
            crate::learner_question::feedback_for_selection(&config, &[&config.options[0]], true)
                .as_deref(),
            Some("Aggregate")
        );
        assert_eq!(
            crate::learner_question::feedback_for_selection(&config, &[&config.options[0]], false)
                .as_deref(),
            Some("Try again")
        );
        config.allow_multiple = false;
        config.options[0].feedback = Some(String::new());
        assert_eq!(
            crate::learner_question::feedback_for_selection(&config, &[&config.options[0]], true)
                .as_deref(),
            Some("Aggregate")
        );
    }

    #[test]
    fn multi_choice_uses_aggregate_correctness_instead_of_a_single_option_outcome() {
        let mut config: QuestionConfig = serde_json::from_value(json!({"allowMultiple":false,"options":[{"key":"a","label":"A","isCorrect":true,"outcomeKey":"option-a"}]})).unwrap();
        assert_eq!(
            transition_choice(&config, &[&config.options[0]], false),
            (Some("option-a"), true)
        );
        config.allow_multiple = true;
        assert_eq!(
            transition_choice(&config, &[&config.options[0]], false),
            (None, false)
        );
        assert_eq!(
            transition_choice(&config, &[&config.options[0]], true),
            (None, true)
        );
    }
}
