//! Source-shaped, behavior-preserving activity translation catalogue helpers.
//!
//! Translation input deliberately contains only learner-facing copy.  It is
//! never a second activity writer: IDs, graph edges, correctness, media and
//! all other behavioral configuration remain in their original records.

use serde_json::{Map, Value, json};

/// Produces the only activity fields a translation catalog may carry.
///
/// The caller supplies target-runtime identifiers for dialogue nodes and
/// transitions.  This is intentionally a projection, not a serialisation of
/// an activity row or its behavior-bearing configuration.
pub fn source_payload(
    title: &str,
    introduction: Option<&str>,
    config: &Value,
    dialogue_nodes: impl IntoIterator<Item = (String, String, Option<String>)>,
    transition_labels: impl IntoIterator<Item = (String, Option<String>)>,
) -> Value {
    let dialogue_nodes = dialogue_nodes
        .into_iter()
        .map(|(id, title, body)| {
            (
                id,
                json!({
                    "title": title,
                    "body": body,
                }),
            )
        })
        .collect::<Map<_, _>>();
    let transitions = transition_labels
        .into_iter()
        .map(|(id, label)| (id, json!({ "label": label })))
        .collect::<Map<_, _>>();

    json!({
        "title": title,
        "introduction": introduction,
        "config": configuration_copy(config),
        "npcDialogueNodes": dialogue_nodes,
        "question": question_copy(config),
        "transitions": transitions,
    })
}

/// Filters one imported candidate against the current source shape.
///
/// A translator may replace strings only. Missing or malformed strings fall
/// back to current source copy, and keys absent from the source projection are
/// discarded. This makes a stale or malicious catalog unable to write graph
/// structure, answer correctness, IDs, media references, or behavior.
pub fn merge_strings_within_source_shape(source: &Value, candidate: &Value) -> Value {
    match (source, candidate) {
        (Value::String(_), Value::String(candidate)) => Value::String(candidate.clone()),
        (Value::String(source), _) => Value::String(source.clone()),
        (Value::Null, Value::String(candidate)) => Value::String(candidate.clone()),
        (Value::Null, _) => Value::Null,
        (Value::Object(source), Value::Object(candidate)) => Value::Object(
            source
                .iter()
                .map(|(key, value)| {
                    (
                        key.clone(),
                        merge_strings_within_source_shape(
                            value,
                            candidate.get(key).unwrap_or(&Value::Null),
                        ),
                    )
                })
                .collect(),
        ),
        (Value::Object(source), _) => Value::Object(
            source
                .iter()
                .map(|(key, value)| (key.clone(), value.clone()))
                .collect(),
        ),
        (Value::Array(source), Value::Array(candidate)) => Value::Array(
            source
                .iter()
                .enumerate()
                .map(|(index, value)| {
                    merge_strings_within_source_shape(
                        value,
                        candidate.get(index).unwrap_or(&Value::Null),
                    )
                })
                .collect(),
        ),
        (Value::Array(source), _) => Value::Array(source.clone()),
        (_, _) => source.clone(),
    }
}

fn configuration_copy(config: &Value) -> Value {
    let Some(config) = config.as_object() else {
        return json!({ "markdownPages": {} });
    };
    let mut copy = Map::new();
    for key in ["promptText", "successText", "revisitText", "text"] {
        if let Some(Value::String(value)) = config.get(key) {
            copy.insert(key.to_owned(), Value::String(value.clone()));
        }
    }
    let markdown_pages = config
        .get("markdownPages")
        .and_then(Value::as_array)
        .map(|pages| {
            pages
                .iter()
                .filter_map(|page| {
                    let page = page.as_object()?;
                    let id = page.get("id")?.as_str()?;
                    Some((
                        id.to_owned(),
                        json!({
                            "title": page.get("title").and_then(Value::as_str).unwrap_or_default(),
                            "body": page.get("body").and_then(Value::as_str).unwrap_or_default(),
                        }),
                    ))
                })
                .collect::<Map<_, _>>()
        })
        .unwrap_or_default();
    copy.insert("markdownPages".to_owned(), Value::Object(markdown_pages));
    Value::Object(copy)
}

fn question_copy(config: &Value) -> Value {
    let Some(config) = config.as_object() else {
        return Value::Null;
    };
    let Some(prompt) = config.get("prompt").and_then(Value::as_str) else {
        return Value::Null;
    };
    let options = config
        .get("options")
        .and_then(Value::as_array)
        .map(|options| {
            options
                .iter()
                .filter_map(|option| {
                    let option = option.as_object()?;
                    let key = option.get("key")?.as_str()?;
                    Some((
                        key.to_owned(),
                        json!({
                            "label": option.get("label").and_then(Value::as_str).unwrap_or_default(),
                            "body": option.get("body").and_then(Value::as_str).unwrap_or_default(),
                        }),
                    ))
                })
                .collect::<Map<_, _>>()
        })
        .unwrap_or_default();
    json!({ "prompt": prompt, "options": options })
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{merge_strings_within_source_shape, source_payload};

    #[test]
    fn projects_only_source_approved_learner_copy() {
        let payload = source_payload(
            "Question title",
            Some("Orientation"),
            &json!({
                "prompt": "Which route?",
                "options": [{"key": "first", "label": "First", "body": "First route", "correct": true}],
                "promptText": "Notice this",
                "toolId": "must-not-export",
                "markdownPages": [{"id": "intro", "title": "Read", "body": "Body", "image": "must-not-export"}],
            }),
            [(
                "node-a".to_owned(),
                "Guide".to_owned(),
                Some("Hello".to_owned()),
            )],
            [("edge-a".to_owned(), Some("Continue".to_owned()))],
        );

        assert_eq!(payload["config"]["promptText"], "Notice this");
        assert!(payload["config"].get("toolId").is_none());
        assert!(
            payload["config"]["markdownPages"]["intro"]
                .get("image")
                .is_none()
        );
        assert_eq!(payload["question"]["options"]["first"]["label"], "First");
        assert!(
            payload["question"]["options"]["first"]
                .get("correct")
                .is_none()
        );
    }

    #[test]
    fn imported_copy_cannot_add_or_mutate_behavioral_structure() {
        let source = json!({
            "title": "Source title",
            "config": {"promptText": "Source prompt", "markdownPages": {"one": {"title": "Page", "body": "Body"}}},
            "question": {"prompt": "Question", "options": {"yes": {"label": "Yes", "body": "Yes body"}}},
        });
        let filtered = merge_strings_within_source_shape(
            &source,
            &json!({
                "title": "Translated title",
                "config": {"promptText": "Translated prompt", "toolId": "forged", "markdownPages": {"one": {"title": "Page translated", "body": 4, "target": "forged"}, "two": {"title": "forged"}}},
                "question": {"prompt": "Translated question", "options": {"yes": {"label": "Yes translated", "body": "Yes body translated", "correct": false}, "no": {"label": "forged"}}},
                "graphTarget": "forged",
            }),
        );

        assert_eq!(filtered["title"], "Translated title");
        assert_eq!(filtered["config"]["promptText"], "Translated prompt");
        assert_eq!(
            filtered["config"]["markdownPages"]["one"]["title"],
            "Page translated"
        );
        assert_eq!(filtered["config"]["markdownPages"]["one"]["body"], "Body");
        assert!(filtered["config"].get("toolId").is_none());
        assert!(filtered["question"]["options"].get("no").is_none());
        assert!(filtered.get("graphTarget").is_none());
    }
}
