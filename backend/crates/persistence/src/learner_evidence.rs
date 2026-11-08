use serde_json::{Value, json};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// A private evidence snapshot written together with an authorized activity
/// action. It is deliberately not an application service or HTTP command:
/// callers must already hold the route-progress row lock for the active run.
pub(crate) struct CompletionEvidence<'config> {
    pub activity_config: &'config Value,
    pub activity_id: Uuid,
    pub activity_type: &'config str,
    pub assistance_level: &'config str,
    pub attempt_number: i32,
    pub calibration: Option<&'config str>,
    pub confidence: Option<&'config str>,
    pub confidence_after_feedback: Option<&'config str>,
    pub learner_reflection_id: Option<Uuid>,
    pub reflection_is_independent_check: bool,
    pub reflection_observed_cues: Option<Value>,
    pub outcome: &'config str,
    pub play_run_id: Uuid,
    pub principal_id: Uuid,
    pub reflection_response_type: Option<&'config str>,
}

pub(crate) async fn record_completion_evidence(
    transaction: &mut Transaction<'_, Postgres>,
    evidence: CompletionEvidence<'_>,
) -> Result<(), sqlx::Error> {
    let policy = EvidencePolicy::from_activity(
        evidence.activity_config,
        evidence.activity_type,
        evidence.reflection_response_type,
    );

    for topic in policy.topics {
        sqlx::query(
            "INSERT INTO learner_evidence_events (principal_id, activity_id, play_run_id, learner_reflection_id, is_independent_check, objective, concepts, topic_slug, topic_name, evidence_type, learning_purpose, evidence_criterion, evidence_rubric, observed_cues, source_references, contribution, outcome, confidence, confidence_after_feedback, calibration, attempt_number, assistance_level) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::numeric, $17, $18, $19, $20, $21, $22) ON CONFLICT (principal_id, activity_id, play_run_id, topic_slug, evidence_type, attempt_number) DO NOTHING",
        )
        .bind(evidence.principal_id)
        .bind(evidence.activity_id)
        .bind(evidence.play_run_id)
        .bind(evidence.learner_reflection_id)
        .bind(evidence.reflection_is_independent_check)
        .bind(&policy.objective)
        .bind(&policy.concepts)
        .bind(&topic.slug)
        .bind(&topic.name)
        .bind(&policy.evidence_type)
        .bind(&policy.learning_purpose)
        .bind(&policy.evidence_criterion)
        .bind(&policy.evidence_rubric)
        .bind(evidence.reflection_observed_cues.clone())
        .bind(&policy.source_references)
        .bind(topic.contribution)
        .bind(evidence.outcome)
        .bind(evidence.confidence)
        .bind(evidence.confidence_after_feedback)
        .bind(evidence.calibration)
        .bind(evidence.attempt_number.max(1))
        .bind(evidence.assistance_level)
        .execute(&mut **transaction)
        .await?;
    }

    Ok(())
}

/// Resolve the strongest recorded companion support for this owned play run.
/// The caller holds the active route-progress lock, so the result remains
/// coupled to the completion evidence written in the same transaction.
pub(crate) async fn companion_assistance_level(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
    play_run_id: Uuid,
    question_was_independent: bool,
) -> Result<String, sqlx::Error> {
    let recorded = sqlx::query_scalar::<_, Option<String>>(
        "SELECT metadata #>> ARRAY['companionAssistance', $3::text, 'level'] FROM learner_activity_progress WHERE principal_id = $1 AND activity_id = $2 FOR UPDATE",
    )
    .bind(principal_id)
    .bind(activity_id)
    .bind(play_run_id.to_string())
    .fetch_optional(&mut **transaction)
    .await?
    .flatten();
    Ok(match recorded.as_deref() {
        Some("hint") => "hint".to_owned(),
        Some("questions_only") => "questions_only".to_owned(),
        _ if question_was_independent => "independent".to_owned(),
        _ => "untracked".to_owned(),
    })
}

/// Remove the transient per-run companion support after completion has taken
/// its durable evidence snapshot.
pub(crate) async fn clear_companion_assistance(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
    play_run_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE learner_activity_progress SET metadata = CASE WHEN (COALESCE(metadata->'companionAssistance', '{}'::jsonb) - $3::text) = '{}'::jsonb THEN metadata - 'companionAssistance' ELSE jsonb_set(metadata, '{companionAssistance}', COALESCE(metadata->'companionAssistance', '{}'::jsonb) - $3::text) END, updated_at = NOW() WHERE principal_id = $1 AND activity_id = $2",
    )
    .bind(principal_id)
    .bind(activity_id)
    .bind(play_run_id.to_string())
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

/// Preserve the source's private topic-to-topic history when an authorized
/// learner enters a supported activity. Visiting a topic is not completion
/// evidence, so this is deliberately separate from `record_completion_evidence`.
pub(crate) async fn record_topic_visit(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_config: &Value,
    activity_type: &str,
) -> Result<(), sqlx::Error> {
    let current_topics = EvidencePolicy::from_activity(activity_config, activity_type, None).topics;
    if current_topics.is_empty() {
        return Ok(());
    }

    let previous_topics = sqlx::query_scalar::<_, Value>(
        "SELECT last_competence_topics FROM application_principals WHERE id = $1 FOR UPDATE",
    )
    .bind(principal_id)
    .fetch_optional(&mut **transaction)
    .await?
    .map_or_else(Vec::new, |topics| stored_topics(&topics));

    if !previous_topics.is_empty() && !same_topic_set(&previous_topics, &current_topics) {
        for from_topic in &previous_topics {
            for to_topic in &current_topics {
                if from_topic.slug == to_topic.slug {
                    continue;
                }
                sqlx::query(
                    "INSERT INTO learner_competence_topic_transitions (principal_id, from_topic_slug, from_topic_name, to_topic_slug, to_topic_name, transition_count) VALUES ($1, $2, $3, $4, $5, 1) ON CONFLICT (principal_id, from_topic_slug, to_topic_slug) DO UPDATE SET from_topic_name = EXCLUDED.from_topic_name, to_topic_name = EXCLUDED.to_topic_name, transition_count = learner_competence_topic_transitions.transition_count + 1, updated_at = NOW()",
                )
                .bind(principal_id)
                .bind(&from_topic.slug)
                .bind(&from_topic.name)
                .bind(&to_topic.slug)
                .bind(&to_topic.name)
                .execute(&mut **transaction)
                .await?;
            }
        }
    }

    sqlx::query(
        "UPDATE application_principals SET last_competence_topics = $2, updated_at = NOW() WHERE id = $1",
    )
    .bind(principal_id)
    .bind(Value::Array(
        current_topics
            .iter()
            .map(|topic| json!({ "slug": topic.slug, "topic": topic.name }))
            .collect(),
    ))
    .execute(&mut **transaction)
    .await?;

    Ok(())
}

struct EvidencePolicy {
    concepts: Option<Value>,
    evidence_criterion: Option<String>,
    evidence_rubric: Option<Value>,
    evidence_type: String,
    learning_purpose: Option<String>,
    objective: Option<String>,
    source_references: Option<Value>,
    topics: Vec<EvidenceTopic>,
}

#[derive(Clone)]
struct EvidenceTopic {
    contribution: String,
    name: String,
    slug: String,
}

impl EvidencePolicy {
    fn from_activity(
        config: &Value,
        activity_type: &str,
        reflection_response_type: Option<&str>,
    ) -> Self {
        let object = config.as_object();
        let guidance = object
            .and_then(|config| config.get("feedbackGuidance"))
            .and_then(Value::as_object);
        let observable_criterion = guidance
            .and_then(|guidance| guidance.get("evidence"))
            .and_then(Value::as_str)
            .and_then(|value| bounded_text(value, 600));
        let configured_intent = object
            .and_then(|config| config.get("learningIntent"))
            .and_then(Value::as_str)
            .filter(|intent| evidence_types().contains(intent));
        let mut evidence_type = configured_intent
            .unwrap_or_else(|| default_evidence_type(activity_type))
            .to_owned();

        // Laravel only treats explanation/transfer as observable evidence when
        // the matching response was recorded for this same activity run.
        if matches!(evidence_type.as_str(), "explain" | "transfer")
            && (observable_criterion.is_none()
                || reflection_response_type != Some(evidence_type.as_str()))
        {
            evidence_type = "participate".to_owned();
        }

        let has_observable_guidance =
            matches!(evidence_type.as_str(), "explain" | "review" | "transfer");
        let concepts = object
            .and_then(|config| config.get("evidenceConcepts"))
            .and_then(normalized_text_array)
            .map(Value::Array);
        let evidence_rubric = has_observable_guidance
            .then(|| {
                guidance
                    .and_then(|guidance| guidance.get("rubric"))
                    .and_then(normalized_text_array)
            })
            .flatten()
            .map(Value::Array);
        let source_references = object
            .and_then(|config| config.get("sourceReferences"))
            .and_then(normalized_source_references)
            .map(Value::Array);

        Self {
            concepts,
            evidence_criterion: has_observable_guidance
                .then_some(observable_criterion)
                .flatten(),
            evidence_rubric,
            evidence_type,
            learning_purpose: guidance
                .and_then(|guidance| guidance.get("purpose"))
                .and_then(Value::as_str)
                .and_then(|value| bounded_text(value, 600)),
            objective: object
                .and_then(|config| config.get("evidenceObjective"))
                .and_then(Value::as_str)
                .and_then(|value| bounded_text(value, 600)),
            source_references,
            topics: object
                .and_then(|config| config.get("competenceTopics"))
                .and_then(Value::as_array)
                .map_or_else(Vec::new, |topics| normalized_topics(topics)),
        }
    }
}

fn evidence_types() -> [&'static str; 7] {
    [
        "apply",
        "explain",
        "participate",
        "reflect",
        "retrieve",
        "review",
        "transfer",
    ]
}

fn default_evidence_type(activity_type: &str) -> &'static str {
    match activity_type {
        "question" => "retrieve",
        "reflection" => "reflect",
        "review" => "review",
        "shared_task" | "message_prompt" | "message_wall" => "explain",
        "obstacle" | "item_obstacle" | "tool_obstacle" => "apply",
        _ => "participate",
    }
}

fn normalized_topics(values: &[Value]) -> Vec<EvidenceTopic> {
    let mut topics = Vec::new();

    for value in values {
        let Some(topic) = value.as_object() else {
            continue;
        };
        let Some(name) = topic
            .get("topic")
            .and_then(Value::as_str)
            .and_then(|value| bounded_text(value, 120))
        else {
            continue;
        };
        let Some(slug) = topic
            .get("slug")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| valid_topic_slug(value))
        else {
            continue;
        };
        let Some(weight) = topic.get("weight").and_then(Value::as_f64) else {
            continue;
        };
        let contribution = (weight * 100.0).round() / 100.0;
        if !contribution.is_finite() || contribution <= 0.0 || contribution > 9_999_999_999.99 {
            continue;
        }

        if let Some(existing) = topics
            .iter_mut()
            .find(|existing: &&mut EvidenceTopic| existing.slug == slug)
        {
            *existing = EvidenceTopic {
                contribution: format!("{contribution:.2}"),
                name,
                slug: slug.to_owned(),
            };
        } else {
            topics.push(EvidenceTopic {
                contribution: format!("{contribution:.2}"),
                name,
                slug: slug.to_owned(),
            });
        }
    }

    topics
}

fn stored_topics(value: &Value) -> Vec<EvidenceTopic> {
    value.as_array().map_or_else(Vec::new, |topics| {
        topics
            .iter()
            .filter_map(|topic| {
                let topic = topic.as_object()?;
                let name = topic
                    .get("topic")
                    .and_then(Value::as_str)
                    .and_then(|value| bounded_text(value, 120))?;
                let slug = topic
                    .get("slug")
                    .and_then(Value::as_str)
                    .map(str::trim)
                    .filter(|value| valid_topic_slug(value))?;
                Some(EvidenceTopic {
                    contribution: "1.00".to_owned(),
                    name,
                    slug: slug.to_owned(),
                })
            })
            .fold(Vec::new(), |mut collected, topic| {
                if !collected
                    .iter()
                    .any(|existing: &EvidenceTopic| existing.slug == topic.slug)
                {
                    collected.push(topic);
                }
                collected
            })
    })
}

fn same_topic_set(first: &[EvidenceTopic], second: &[EvidenceTopic]) -> bool {
    first.len() == second.len()
        && first
            .iter()
            .all(|topic| second.iter().any(|candidate| candidate.slug == topic.slug))
}

fn normalized_text_array(value: &Value) -> Option<Vec<Value>> {
    let values = value.as_array()?;
    let mut normalized = Vec::new();
    for value in values.iter().take(8) {
        let Some(text) = value.as_str().and_then(|value| bounded_text(value, 120)) else {
            continue;
        };
        if !normalized.iter().any(|existing: &Value| {
            existing
                .as_str()
                .is_some_and(|existing| existing.eq_ignore_ascii_case(&text))
        }) {
            normalized.push(Value::String(text));
        }
    }

    (!normalized.is_empty()).then_some(normalized)
}

fn normalized_source_references(value: &Value) -> Option<Vec<Value>> {
    let references = value.as_array()?;
    let normalized = references
        .iter()
        .take(5)
        .filter_map(|reference| {
            let reference = reference.as_object()?;
            let title = reference
                .get("title")
                .and_then(Value::as_str)
                .and_then(|value| bounded_text(value, 600))?;
            let url = reference
                .get("url")
                .and_then(Value::as_str)
                .and_then(|value| bounded_text(value, 2_000))?;
            Some(json!({
                "title": title,
                "url": url,
                "publisher": reference.get("publisher").and_then(Value::as_str).and_then(|value| bounded_text(value, 600)),
                "publishedAt": reference.get("publishedAt").and_then(Value::as_str).and_then(|value| bounded_text(value, 600)),
                "rights": reference.get("rights").and_then(Value::as_str).and_then(|value| bounded_text(value, 600)),
                "anchor": reference.get("anchor").and_then(Value::as_str).and_then(|value| bounded_text(value, 600)),
                "excerpt": reference.get("excerpt").and_then(Value::as_str).and_then(|value| bounded_text(value, 800)),
                "concepts": reference.get("concepts").and_then(normalized_text_array),
            }))
        })
        .collect::<Vec<_>>();

    (!normalized.is_empty()).then_some(normalized)
}

fn bounded_text(value: &str, maximum_characters: usize) -> Option<String> {
    let trimmed = value.trim();
    (!trimmed.is_empty()).then(|| trimmed.chars().take(maximum_characters).collect())
}

fn valid_topic_slug(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 140
        && value.bytes().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == b'-'
        })
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{EvidencePolicy, same_topic_set, stored_topics};

    #[test]
    fn uses_source_defaults_and_ignores_invalid_authored_topics() {
        let policy = EvidencePolicy::from_activity(
            &json!({
                "competenceTopics": [
                    { "topic": "Orientation", "slug": "orientation", "weight": 1.236 },
                    { "topic": "Ignored", "slug": "Not a slug", "weight": 1 }
                ]
            }),
            "question",
            None,
        );

        assert_eq!(policy.evidence_type, "retrieve");
        assert_eq!(policy.topics.len(), 1);
        assert_eq!(policy.topics[0].contribution, "1.24");
    }

    #[test]
    fn requires_matching_reflection_for_observable_explanation_evidence() {
        let config = json!({
            "learningIntent": "explain",
            "feedbackGuidance": { "evidence": "Explains the connection." }
        });

        assert_eq!(
            EvidencePolicy::from_activity(&config, "reflection", Some("reflection")).evidence_type,
            "participate"
        );
        assert_eq!(
            EvidencePolicy::from_activity(&config, "reflection", Some("explain")).evidence_type,
            "explain"
        );
    }

    #[test]
    fn changes_in_a_topic_set_are_distinguished_from_a_repeat_visit() {
        let previous = stored_topics(&json!([
            { "slug": "orientation", "topic": "Orientation" }
        ]));
        let repeated = EvidencePolicy::from_activity(
            &json!({
                "competenceTopics": [
                    { "topic": "Orientation", "slug": "orientation", "weight": 1 }
                ]
            }),
            "open_practice",
            None,
        )
        .topics;
        let changed = EvidencePolicy::from_activity(
            &json!({
                "competenceTopics": [
                    { "topic": "Direction", "slug": "direction", "weight": 1 }
                ]
            }),
            "open_practice",
            None,
        )
        .topics;

        assert!(same_topic_set(&previous, &repeated));
        assert!(!same_topic_set(&previous, &changed));
    }
}
