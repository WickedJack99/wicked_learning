use serde_json::{Map, Value, json};
use uuid::Uuid;

pub const CONTENT_PLAN_CONTRACT_VERSION: &str = "1.5";
pub const CONTENT_PLAN_ACTIVITY_TYPES: [&str; 5] = [
    "markdown",
    "reflection",
    "message_prompt",
    "shared_task",
    "open_practice",
];
pub const CONTENT_PLAN_LEARNING_INTENTS: [&str; 7] = [
    "apply",
    "explain",
    "participate",
    "reflect",
    "retrieve",
    "review",
    "transfer",
];

#[derive(Clone, Debug, PartialEq)]
pub struct ContentPlanBrief {
    pub template_id: Uuid,
    pub goal: String,
    pub target_audience: Option<String>,
    pub prior_knowledge: Option<String>,
    pub route_length: usize,
    pub activity_types: Vec<String>,
    pub source_record_ids: Vec<Uuid>,
}

impl ContentPlanBrief {
    #[allow(clippy::too_many_arguments)]
    pub fn parse(
        template_id: Uuid,
        goal: &str,
        target_audience: Option<&str>,
        prior_knowledge: Option<&str>,
        route_length: usize,
        activity_types: Vec<String>,
        source_record_ids: Vec<Uuid>,
    ) -> Option<Self> {
        let goal = bounded_required(goal, 4_000)?;
        let target_audience = bounded_optional(target_audience, 1_000)?;
        let prior_knowledge = bounded_optional(prior_knowledge, 1_000)?;
        if !(1..=3).contains(&route_length)
            || activity_types.is_empty()
            || activity_types.len() > 3
            || source_record_ids.len() > 5
        {
            return None;
        }
        let activity_types = activity_types
            .into_iter()
            .map(|activity_type| activity_type.trim().to_owned())
            .collect::<Vec<_>>();
        if activity_types
            .iter()
            .any(|activity_type| !CONTENT_PLAN_ACTIVITY_TYPES.contains(&activity_type.as_str()))
            || has_duplicates(&activity_types)
            || has_uuid_duplicates(&source_record_ids)
        {
            return None;
        }

        Some(Self {
            template_id,
            goal,
            target_audience,
            prior_knowledge,
            route_length,
            activity_types,
            source_record_ids,
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ContentPlanValidationError;

/// Validates a provider or editor supplied ContentPlan as untrusted input. The
/// exported JSON schema improves provider compliance; this validator remains
/// the persistence trust boundary.
pub fn validate_content_plan(
    plan: Value,
    allowed_activity_types: &[String],
    available_source_record_ids: Option<&[Uuid]>,
) -> Result<Value, ContentPlanValidationError> {
    let plan_object = object(&plan)?;
    exact_keys(plan_object, &["summary", "mapAsset", "activities"])?;
    required_text(plan_object, "summary", 1_200)?;

    let map_asset = object(required(plan_object, "mapAsset")?)?;
    exact_keys(map_asset, &["title", "description", "label"])?;
    required_text(map_asset, "title", 120)?;
    optional_text(map_asset, "description", 1_000)?;
    optional_text(map_asset, "label", 80)?;

    let activities = required(plan_object, "activities")?
        .as_array()
        .filter(|activities| (1..=3).contains(&activities.len()))
        .ok_or(ContentPlanValidationError)?;
    for activity in activities {
        validate_activity(
            activity,
            allowed_activity_types,
            available_source_record_ids,
        )?;
    }
    Ok(plan)
}

fn validate_activity(
    activity: &Value,
    allowed_activity_types: &[String],
    available_source_record_ids: Option<&[Uuid]>,
) -> Result<(), ContentPlanValidationError> {
    let activity = object(activity)?;
    exact_keys(
        activity,
        &[
            "type",
            "title",
            "introduction",
            "body",
            "prompt",
            "note",
            "topic",
            "inputLabel",
            "competenceTopics",
            "learningIntent",
            "sourceRecordIds",
        ],
    )?;
    let activity_type = required_text(activity, "type", 40)?;
    if !allowed_activity_types
        .iter()
        .any(|allowed_activity_type| allowed_activity_type == activity_type)
        || !CONTENT_PLAN_ACTIVITY_TYPES.contains(&activity_type)
    {
        return Err(ContentPlanValidationError);
    }
    required_text(activity, "title", 120)?;
    optional_text(activity, "introduction", 1_000)?;
    optional_text(activity, "body", 12_000)?;
    optional_text(activity, "prompt", 4_000)?;
    optional_text(activity, "note", 2_000)?;
    optional_text(activity, "topic", 120)?;
    optional_text(activity, "inputLabel", 120)?;
    let topics = required(activity, "competenceTopics")?
        .as_array()
        .filter(|topics| (1..=3).contains(&topics.len()))
        .ok_or(ContentPlanValidationError)?;
    for topic in topics {
        let topic = topic.as_str().ok_or(ContentPlanValidationError)?;
        if topic.trim().is_empty() || topic.chars().count() > 120 {
            return Err(ContentPlanValidationError);
        }
    }
    let learning_intent = required_text(activity, "learningIntent", 20)?;
    if !CONTENT_PLAN_LEARNING_INTENTS.contains(&learning_intent) {
        return Err(ContentPlanValidationError);
    }
    let source_record_ids = required(activity, "sourceRecordIds")?
        .as_array()
        .filter(|records| records.len() <= 5)
        .ok_or(ContentPlanValidationError)?;
    let mut source_ids = Vec::with_capacity(source_record_ids.len());
    for source_record_id in source_record_ids {
        let source_record_id = source_record_id
            .as_str()
            .and_then(|source_record_id| Uuid::parse_str(source_record_id).ok())
            .ok_or(ContentPlanValidationError)?;
        if source_ids.contains(&source_record_id)
            || available_source_record_ids
                .is_some_and(|available| !available.contains(&source_record_id))
        {
            return Err(ContentPlanValidationError);
        }
        source_ids.push(source_record_id);
    }
    match activity_type {
        "markdown" if !nonblank_optional(activity, "body") => Err(ContentPlanValidationError),
        "reflection" if !nonblank_optional(activity, "prompt") => Err(ContentPlanValidationError),
        "message_prompt"
            if !nonblank_optional(activity, "prompt") || !nonblank_optional(activity, "topic") =>
        {
            Err(ContentPlanValidationError)
        }
        "shared_task" | "open_practice" if !nonblank_optional(activity, "prompt") => {
            Err(ContentPlanValidationError)
        }
        _ => Ok(()),
    }
}

fn object(value: &Value) -> Result<&Map<String, Value>, ContentPlanValidationError> {
    value.as_object().ok_or(ContentPlanValidationError)
}

fn required<'a>(
    value: &'a Map<String, Value>,
    key: &str,
) -> Result<&'a Value, ContentPlanValidationError> {
    value.get(key).ok_or(ContentPlanValidationError)
}

fn exact_keys(
    value: &Map<String, Value>,
    expected: &[&str],
) -> Result<(), ContentPlanValidationError> {
    (value.len() == expected.len() && expected.iter().all(|key| value.contains_key(*key)))
        .then_some(())
        .ok_or(ContentPlanValidationError)
}

fn required_text<'a>(
    value: &'a Map<String, Value>,
    key: &str,
    maximum: usize,
) -> Result<&'a str, ContentPlanValidationError> {
    let text = required(value, key)?
        .as_str()
        .filter(|text| !text.trim().is_empty() && text.chars().count() <= maximum)
        .ok_or(ContentPlanValidationError)?;
    Ok(text)
}

fn optional_text(
    value: &Map<String, Value>,
    key: &str,
    maximum: usize,
) -> Result<(), ContentPlanValidationError> {
    let value = required(value, key)?;
    (value.is_null()
        || value
            .as_str()
            .is_some_and(|text| text.chars().count() <= maximum))
    .then_some(())
    .ok_or(ContentPlanValidationError)
}

fn nonblank_optional(value: &Map<String, Value>, key: &str) -> bool {
    value
        .get(key)
        .and_then(Value::as_str)
        .is_some_and(|text| !text.trim().is_empty())
}

fn bounded_required(value: &str, maximum: usize) -> Option<String> {
    let value = value.trim();
    (!value.is_empty() && value.chars().count() <= maximum).then(|| value.to_owned())
}

fn bounded_optional(value: Option<&str>, maximum: usize) -> Option<Option<String>> {
    let value = value.map(str::trim).filter(|value| !value.is_empty());
    match value {
        Some(value) if value.chars().count() <= maximum => Some(Some(value.to_owned())),
        None => Some(None),
        Some(_) => None,
    }
}

fn has_duplicates(values: &[String]) -> bool {
    values.iter().enumerate().any(|(index, value)| {
        values
            .iter()
            .skip(index + 1)
            .any(|candidate| candidate == value)
    })
}

fn has_uuid_duplicates(values: &[Uuid]) -> bool {
    values.iter().enumerate().any(|(index, value)| {
        values
            .iter()
            .skip(index + 1)
            .any(|candidate| candidate == value)
    })
}

pub fn content_plan_document() -> Value {
    json!({
        "version": CONTENT_PLAN_CONTRACT_VERSION,
        "purpose": "A reviewable draft for one MapAsset and a short linear learning route.",
        "humanApprovalRequired": true,
        "supportedActivityTypes": CONTENT_PLAN_ACTIVITY_TYPES,
        "placementDefaults": { "positionX": 50, "positionY": 50, "width": 14 },
        "schema": {
            "type": "object", "additionalProperties": false,
            "required": ["summary", "mapAsset", "activities"],
            "properties": {
                "summary": { "type": "string", "description": "A short rationale for the proposed learning route.", "maxLength": 1200 },
                "mapAsset": { "type": "object", "additionalProperties": false, "required": ["title", "description", "label"], "properties": {
                    "title": { "type": "string", "maxLength": 120 },
                    "description": { "type": ["string", "null"], "maxLength": 1000 },
                    "label": { "type": ["string", "null"], "maxLength": 80 }
                } },
                "activities": { "type": "array", "minItems": 1, "maxItems": 3, "items": {
                    "type": "object", "additionalProperties": false,
                    "required": ["type", "title", "introduction", "body", "prompt", "note", "topic", "inputLabel", "competenceTopics", "learningIntent", "sourceRecordIds"],
                    "properties": {
                        "type": { "type": "string", "enum": CONTENT_PLAN_ACTIVITY_TYPES },
                        "title": { "type": "string", "maxLength": 120 },
                        "introduction": { "type": ["string", "null"], "maxLength": 1000 },
                        "body": { "type": ["string", "null"], "description": "Markdown body for markdown activities; null for interactive activities.", "maxLength": 12000 },
                        "prompt": { "type": ["string", "null"], "description": "Learner prompt for reflections, message prompts, shared tasks and open practice; null for markdown activities.", "maxLength": 4000 },
                        "note": { "type": ["string", "null"], "description": "Optional reflection guidance or shared-task instructions; null for markdown activities.", "maxLength": 2000 },
                        "topic": { "type": ["string", "null"], "description": "Shared message topic for message prompts; null for other activity types, including shared tasks.", "maxLength": 120 },
                        "inputLabel": { "type": ["string", "null"], "description": "Optional learner message or shared-task input label; null for other activity types.", "maxLength": 120 },
                        "competenceTopics": { "type": "array", "description": "One to three short competence topic labels this activity intentionally nourishes.", "minItems": 1, "maxItems": 3, "items": { "type": "string", "maxLength": 120 } },
                        "learningIntent": { "type": "string", "description": "The primary learning purpose of this activity, not a grade or performance judgment.", "enum": CONTENT_PLAN_LEARNING_INTENTS },
                        "sourceRecordIds": { "type": "array", "description": "Opaque UUIDs of selected source records that directly support this activity; use an empty array when none are directly attributed.", "maxItems": 5, "items": { "type": "string", "format": "uuid" } }
                    }
                } }
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use uuid::Uuid;

    use super::{ContentPlanBrief, content_plan_document, validate_content_plan};

    fn plan(source_record_id: Uuid) -> serde_json::Value {
        json!({"summary":"A short route.","mapAsset":{"title":"Energy converter","description":null,"label":null},"activities":[{"type":"markdown","title":"Notice energy","introduction":null,"body":"# Energy","prompt":null,"note":null,"topic":null,"inputLabel":null,"competenceTopics":["Energy systems"],"learningIntent":"explain","sourceRecordIds":[source_record_id]}]})
    }

    #[test]
    fn preserves_bounded_brief_and_strict_plan_contract() {
        let source_record_id = Uuid::new_v4();
        let brief = ContentPlanBrief::parse(
            Uuid::new_v4(),
            " Explain energy transfer ",
            None,
            None,
            1,
            vec!["markdown".into()],
            vec![source_record_id],
        )
        .expect("valid brief");
        assert_eq!(brief.goal, "Explain energy transfer");
        assert!(
            validate_content_plan(
                plan(source_record_id),
                &brief.activity_types,
                Some(&brief.source_record_ids)
            )
            .is_ok()
        );
        assert_eq!(content_plan_document()["version"], json!("1.5"));
    }

    #[test]
    fn rejects_unselected_sources_and_semantically_empty_activity_content() {
        let source_record_id = Uuid::new_v4();
        let unselected = Uuid::new_v4();
        let allowed = vec!["markdown".to_owned()];
        let mut invalid = plan(unselected);
        assert!(
            validate_content_plan(invalid.clone(), &allowed, Some(&[source_record_id])).is_err()
        );
        invalid["activities"][0]["sourceRecordIds"] = json!([]);
        invalid["activities"][0]["body"] = json!("  ");
        assert!(validate_content_plan(invalid, &allowed, Some(&[source_record_id])).is_err());
    }
}
