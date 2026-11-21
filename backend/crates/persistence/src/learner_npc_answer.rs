use serde_json::Value;
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_domain::learner_state::LearnerNpcDialogueAnswerProgress;

pub(super) struct AnswerContext {
    pub principal_id: Uuid,
    pub play_run_id: Uuid,
    pub activity_id: Uuid,
    pub question_node_id: Uuid,
    pub answer_node_id: Uuid,
    pub world_id: Uuid,
}

#[derive(FromRow)]
struct AnswerRow {
    title: String,
    node_config: Value,
}

/// Called only after the current run/question and its authored answer edge
/// have been authorized and locked. Evidence, effects and cursor share one
/// transaction; no target or correctness value comes from the request body.
pub(super) async fn record_answer(
    transaction: &mut Transaction<'_, Postgres>,
    context: AnswerContext,
) -> Result<Option<LearnerNpcDialogueAnswerProgress>, sqlx::Error> {
    let Some(answer) = sqlx::query_as::<_, AnswerRow>(
        "SELECT title, node_config FROM learning_npc_dialogue_nodes WHERE id = $1 AND activity_id = $2 AND node_type = 'answer'",
    )
    .bind(context.answer_node_id)
    .bind(context.activity_id)
    .fetch_optional(&mut **transaction)
    .await? else { return Ok(None); };
    let Some(hidden) = event_targets(&answer.node_config, "hideNodeIds") else {
        return Ok(None);
    };
    let Some(unlocked) = event_targets(&answer.node_config, "unlockNodeIds") else {
        return Ok(None);
    };
    let is_correct = match answer.node_config.get("isCorrect") {
        None | Some(Value::Null) => false,
        Some(Value::Bool(value)) => *value,
        _ => return Ok(None),
    };
    let label = match answer.node_config.get("answerLabel") {
        None | Some(Value::Null) => &answer.title,
        Some(Value::String(value)) if value.chars().count() <= 120 => value,
        _ => return Ok(None),
    };
    let mut all_targets = hidden.clone();
    all_targets.extend(&unlocked);
    all_targets.sort_unstable();
    all_targets.dedup();
    let targets = if all_targets.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, (Uuid, Uuid)>(
            "SELECT nodes.id, maps.world_id FROM learning_nodes AS nodes INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE nodes.id = ANY($1)",
        ).bind(&all_targets).fetch_all(&mut **transaction).await?
    };
    // Deleted targets are ignored as in source. A still-existing foreign-World
    // target violates the same boundary enforced by native NPC authoring.
    if targets.iter().any(|(_, world)| *world != context.world_id) {
        return Ok(None);
    }
    let existing: std::collections::HashSet<_> = targets.into_iter().map(|(id, _)| id).collect();
    sqlx::query("INSERT INTO learner_npc_dialogue_answers (principal_id, play_run_id, activity_id, question_node_id, answer_node_id, answer_label, is_correct, feedback) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)")
        .bind(context.principal_id).bind(context.play_run_id).bind(context.activity_id)
        .bind(context.question_node_id).bind(context.answer_node_id).bind(label).bind(is_correct)
        .execute(&mut **transaction).await?;
    for (kind, targets) in [("hidden", hidden), ("unlocked", unlocked)] {
        let targets: Vec<_> = targets
            .into_iter()
            .filter(|id| existing.contains(id))
            .collect();
        if targets.is_empty() {
            continue;
        }
        sqlx::query("INSERT INTO learner_node_answer_events (principal_id, node_id, event_kind, source_activity_id, source_answer_node_id) SELECT $1, target, $3, $4, $5 FROM unnest($2::uuid[]) AS target ON CONFLICT (principal_id, node_id, event_kind) DO UPDATE SET source_activity_id = EXCLUDED.source_activity_id, source_answer_node_id = EXCLUDED.source_answer_node_id")
            .bind(context.principal_id).bind(&targets).bind(kind).bind(context.activity_id).bind(context.answer_node_id)
            .execute(&mut **transaction).await?;
        sqlx::query("INSERT INTO learner_node_discoveries (principal_id, node_id) SELECT $1, target FROM unnest($2::uuid[]) AS target ON CONFLICT (principal_id, node_id) DO NOTHING")
            .bind(context.principal_id).bind(&targets).execute(&mut **transaction).await?;
    }
    Ok(Some(LearnerNpcDialogueAnswerProgress {
        answer_key: context.answer_node_id.to_string(),
        answer_node_id: context.answer_node_id.to_string(),
        feedback: None,
        is_correct,
    }))
}

fn event_targets(config: &Value, key: &str) -> Option<Vec<Uuid>> {
    let Some(events) = config.get("events") else {
        return Some(Vec::new());
    };
    let events = events.as_object()?;
    let Some(targets) = events.get(key) else {
        return Some(Vec::new());
    };
    let targets = targets.as_array()?;
    if targets.len() > 100 {
        return None;
    }
    let mut ids = targets
        .iter()
        .map(|value| value.as_str().and_then(|id| Uuid::parse_str(id).ok()))
        .collect::<Option<Vec<_>>>()?;
    ids.sort_unstable();
    ids.dedup();
    Some(ids)
}
