use serde_json::{Map, Value, json};

pub const ACTIVITY_REVIEW_CONTRACT_VERSION: &str = "1.2";

/// Validates the only model result that an activity review may persist. This
/// deliberately treats structured-output compliance as a helpful transport
/// property, not a trust boundary: provider output remains untrusted input.
pub fn validate_activity_review(value: Value) -> Result<Value, ActivityReviewValidationError> {
    let review = object(&value, "review")?;
    exact_keys(
        review,
        &[
            "summary",
            "strengths",
            "suggestions",
            "sdt",
            "learningDesign",
            "feedbackGuidance",
        ],
        "review",
    )?;
    text(required(review, "summary", "review")?, 1200, "summary")?;
    texts(
        required(review, "strengths", "review")?,
        4,
        400,
        "strengths",
    )?;
    texts(
        required(review, "suggestions", "review")?,
        5,
        500,
        "suggestions",
    )?;

    let sdt = object(required(review, "sdt", "review")?, "sdt")?;
    exact_keys(sdt, &["autonomy", "competence", "relatedness"], "sdt")?;
    for name in ["autonomy", "competence", "relatedness"] {
        dimension(required(sdt, name, "sdt")?, "supported", name)?;
    }

    let learning_design = object(
        required(review, "learningDesign", "review")?,
        "learningDesign",
    )?;
    exact_keys(
        learning_design,
        &[
            "purpose",
            "topics",
            "suggestedLearningIntent",
            "suggestedCompetenceTopics",
        ],
        "learningDesign",
    )?;
    dimension(
        required(learning_design, "purpose", "learningDesign")?,
        "aligned",
        "learningDesign.purpose",
    )?;
    dimension(
        required(learning_design, "topics", "learningDesign")?,
        "aligned",
        "learningDesign.topics",
    )?;
    match required(learning_design, "suggestedLearningIntent", "learningDesign")? {
        Value::Null => {}
        Value::String(intent)
            if matches!(
                intent.as_str(),
                "apply"
                    | "explain"
                    | "participate"
                    | "reflect"
                    | "retrieve"
                    | "review"
                    | "transfer"
            ) => {}
        _ => return Err(ActivityReviewValidationError),
    }
    texts(
        required(
            learning_design,
            "suggestedCompetenceTopics",
            "learningDesign",
        )?,
        3,
        120,
        "learningDesign.suggestedCompetenceTopics",
    )?;

    let feedback = object(
        required(review, "feedbackGuidance", "review")?,
        "feedbackGuidance",
    )?;
    exact_keys(
        feedback,
        &["purpose", "evidence", "nextAction"],
        "feedbackGuidance",
    )?;
    for name in ["purpose", "evidence", "nextAction"] {
        dimension(
            required(feedback, name, "feedbackGuidance")?,
            "supported",
            name,
        )?;
    }

    Ok(value)
}

/// The schema is sent to the provider and is also retained here as the named
/// versioned contract for auditability. The validator above is authoritative.
pub fn activity_review_schema() -> Value {
    let supported = json!({"type":"object","additionalProperties":false,"required":["signal","note"],"properties":{"signal":{"type":"string","enum":["supported","unclear","risk"]},"note":{"type":"string","maxLength":600}}});
    let aligned = json!({"type":"object","additionalProperties":false,"required":["signal","note"],"properties":{"signal":{"type":"string","enum":["aligned","unclear","mismatch"]},"note":{"type":"string","maxLength":600}}});
    json!({"type":"object","additionalProperties":false,"required":["summary","strengths","suggestions","sdt","learningDesign","feedbackGuidance"],"properties":{"summary":{"type":"string","maxLength":1200},"strengths":{"type":"array","maxItems":4,"items":{"type":"string","maxLength":400}},"suggestions":{"type":"array","maxItems":5,"items":{"type":"string","maxLength":500}},"sdt":{"type":"object","additionalProperties":false,"required":["autonomy","competence","relatedness"],"properties":{"autonomy":supported,"competence":supported,"relatedness":supported}},"learningDesign":{"type":"object","additionalProperties":false,"required":["purpose","topics","suggestedLearningIntent","suggestedCompetenceTopics"],"properties":{"purpose":aligned,"topics":aligned,"suggestedLearningIntent":{"type":["string","null"],"enum":["apply","explain","participate","reflect","retrieve","review","transfer",null]},"suggestedCompetenceTopics":{"type":"array","maxItems":3,"items":{"type":"string","maxLength":120}}}},"feedbackGuidance":{"type":"object","additionalProperties":false,"required":["purpose","evidence","nextAction"],"properties":{"purpose":supported,"evidence":supported,"nextAction":supported}}}})
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ActivityReviewValidationError;

fn object<'a>(
    value: &'a Value,
    label: &str,
) -> Result<&'a Map<String, Value>, ActivityReviewValidationError> {
    value
        .as_object()
        .ok_or(ActivityReviewValidationError)
        .and_then(|object| {
            (!object.is_empty() || label == "review")
                .then_some(object)
                .ok_or(ActivityReviewValidationError)
        })
}

fn required<'a>(
    object: &'a Map<String, Value>,
    key: &str,
    _label: &str,
) -> Result<&'a Value, ActivityReviewValidationError> {
    object.get(key).ok_or(ActivityReviewValidationError)
}

fn exact_keys(
    object: &Map<String, Value>,
    expected: &[&str],
    _label: &str,
) -> Result<(), ActivityReviewValidationError> {
    (object.len() == expected.len() && expected.iter().all(|key| object.contains_key(*key)))
        .then_some(())
        .ok_or(ActivityReviewValidationError)
}

fn text(value: &Value, maximum: usize, _label: &str) -> Result<(), ActivityReviewValidationError> {
    value
        .as_str()
        .filter(|value| value.chars().count() <= maximum)
        .map(|_| ())
        .ok_or(ActivityReviewValidationError)
}

fn texts(
    value: &Value,
    maximum_items: usize,
    maximum_length: usize,
    label: &str,
) -> Result<(), ActivityReviewValidationError> {
    let items = value
        .as_array()
        .filter(|items| items.len() <= maximum_items)
        .ok_or(ActivityReviewValidationError)?;
    for item in items {
        text(item, maximum_length, label)?;
    }
    Ok(())
}

fn dimension(
    value: &Value,
    expected_signal: &str,
    _label: &str,
) -> Result<(), ActivityReviewValidationError> {
    let value = object(value, "dimension")?;
    exact_keys(value, &["signal", "note"], "dimension")?;
    let allowed = if expected_signal == "aligned" {
        ["aligned", "unclear", "mismatch"]
    } else {
        ["supported", "unclear", "risk"]
    };
    allowed
        .contains(
            &required(value, "signal", "dimension")?
                .as_str()
                .unwrap_or_default(),
        )
        .then_some(())
        .ok_or(ActivityReviewValidationError)?;
    text(required(value, "note", "dimension")?, 600, "dimension.note")
}

#[cfg(test)]
mod tests {
    use super::validate_activity_review;
    use serde_json::json;

    fn review() -> serde_json::Value {
        json!({"summary":"Useful review.","strengths":["A strength."],"suggestions":["An optional adjustment."],"sdt":{"autonomy":{"signal":"supported","note":"Choice is clear."},"competence":{"signal":"unclear","note":"Practice is implicit."},"relatedness":{"signal":"risk","note":"No social connection."}},"learningDesign":{"purpose":{"signal":"aligned","note":"Purpose matches."},"topics":{"signal":"unclear","note":"Topic needs clarity."},"suggestedLearningIntent":null,"suggestedCompetenceTopics":["Systems Thinking"]},"feedbackGuidance":{"purpose":{"signal":"supported","note":"Concrete."},"evidence":{"signal":"unclear","note":"Needs evidence."},"nextAction":{"signal":"supported","note":"One next step."}}})
    }

    #[test]
    fn accepts_the_source_review_contract_and_rejects_unexpected_model_fields() {
        assert!(validate_activity_review(review()).is_ok());
        let mut invalid = review();
        invalid["unexpected"] = json!(true);
        assert!(validate_activity_review(invalid).is_err());
    }

    #[test]
    fn rejects_a_model_suggestion_outside_source_bounds() {
        let mut invalid = review();
        invalid["suggestions"] = json!(["one", "two", "three", "four", "five", "six"]);
        assert!(validate_activity_review(invalid).is_err());
    }
}
