use std::collections::HashMap;

use serde_json::Value;
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_domain::learner_state::{LearnerPlaybackGraph, LearnerPlaybackReviewContext};

#[derive(FromRow)]
struct ReviewRow {
    category_id: i64,
    id: Uuid,
    question: String,
    reflection: String,
    created_at: String,
}

fn category(kind: &str, config: &Value, node_title: &str) -> Option<(String, String)> {
    if kind != "review"
        && !(kind == "reflection"
            && config.get("learningIntent").and_then(Value::as_str) == Some("review"))
    {
        return None;
    }
    let text = |key: &str| config.get(key).and_then(Value::as_str).unwrap_or("").trim();
    let topic = text("topic");
    Some((
        if topic.is_empty() { node_title } else { topic }.to_owned(),
        text("subtopic").to_owned(),
    ))
}

/// The caller supplies only the authorized published node graph. Resolve the
/// source's distinct categories once, returning at most three owner reflections
/// per category in one query, including for activities not yet reached.
pub(super) async fn enrich(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    node_title: &str,
    graph: &mut LearnerPlaybackGraph,
    configs: &HashMap<Uuid, Value>,
) -> Result<(), sqlx::Error> {
    let mut category_ids = HashMap::new();
    let mut topics = Vec::new();
    let mut subtopics = Vec::new();
    let mut activity_categories = HashMap::new();
    for activity in &graph.activities {
        if let Some(key) = category(&activity.activity_type, &configs[&activity.id], node_title) {
            let id = *category_ids.entry(key.clone()).or_insert_with(|| {
                topics.push(key.0);
                subtopics.push(key.1);
                topics.len() as i64
            });
            activity_categories.insert(activity.id, id);
        }
    }
    if topics.is_empty() {
        return Ok(());
    }
    let rows = sqlx::query_as::<_, ReviewRow>(
        "SELECT category.category_id, recent.id, recent.question, recent.reflection, \
         to_char(recent.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at \
         FROM unnest($2::text[], $3::text[]) WITH ORDINALITY AS category(topic,subtopic,category_id) \
         CROSS JOIN LATERAL (SELECT r.id,r.question,r.reflection,r.created_at \
           FROM learner_reflections r INNER JOIN learner_journal_pages p ON p.id=r.learner_journal_page_id \
           WHERE r.principal_id=$1 AND p.principal_id=$1 AND p.topic=category.topic \
             AND (category.subtopic='' OR p.subtopic=category.subtopic) \
           ORDER BY r.created_at DESC,r.id DESC LIMIT 3) recent \
         ORDER BY category.category_id,recent.created_at DESC,recent.id DESC",
    )
    .bind(principal_id)
    .bind(topics)
    .bind(subtopics)
    .fetch_all(&mut **transaction)
    .await?;
    let mut by_category: HashMap<i64, Vec<LearnerPlaybackReviewContext>> = HashMap::new();
    for row in rows {
        by_category
            .entry(row.category_id)
            .or_default()
            .push(LearnerPlaybackReviewContext {
                id: row.id.to_string(),
                question: row.question,
                reflection: row.reflection,
                created_at: row.created_at,
            });
    }
    for activity in &mut graph.activities {
        activity.review_context = activity_categories
            .get(&activity.id)
            .map(|id| by_category.get(id).cloned().unwrap_or_default());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::category;
    use serde_json::json;

    #[test]
    fn review_categories_preserve_source_scope_and_fallbacks() {
        assert_eq!(
            category(
                "review",
                &json!({"topic":"  Topic  ","subtopic":" Subtopic "}),
                "Node"
            ),
            Some(("Topic".into(), "Subtopic".into()))
        );
        assert_eq!(
            category(
                "reflection",
                &json!({"learningIntent":"review","topic":"  "}),
                "Node title"
            ),
            Some(("Node title".into(), "".into()))
        );
        assert_eq!(
            category("review", &json!({}), "Node"),
            Some(("Node".into(), "".into()))
        );
        assert_eq!(category("reflection", &json!({}), "Node"), None);
        assert_eq!(
            category("open_practice", &json!({"learningIntent":"review"}), "Node"),
            None
        );
    }
}
