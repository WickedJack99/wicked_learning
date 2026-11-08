use std::{collections::HashSet, future::Future};

use serde_json::{Map, Value, json};
use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learning_companion::{
        LearningCompanionAssignment, LearningCompanionAssignmentPage, LearningCompanionDialogue,
        LearningCompanionDialoguePage,
    },
};

const MAX_DIALOGUES_PER_PAGE: i64 = 12;
const MAX_ASSIGNMENTS: usize = 100;
const AI_CAPABILITIES: [&str; 6] = [
    "current-context",
    "topic-context",
    "route-context",
    "nearby-places",
    "navigation-alternatives",
    "revisit-options",
];
const NAVIGATION_ACTIONS: [&str; 4] = [
    "current-map",
    "learning-desk",
    "topics",
    "continue-exploring",
];

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompanionDialoguePageRequest {
    pub page: i64,
    pub per_page: i64,
    pub search: String,
}

impl CompanionDialoguePageRequest {
    pub fn parse(page: Option<i64>, per_page: Option<i64>, search: Option<&str>) -> Self {
        Self {
            page: page.unwrap_or(1).max(1),
            per_page: per_page.unwrap_or(6).clamp(1, MAX_DIALOGUES_PER_PAGE),
            search: search
                .unwrap_or_default()
                .trim()
                .chars()
                .take(120)
                .collect(),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompanionDialogueAssignmentForm {
    pub assignments: Vec<LearningCompanionAssignment>,
}

impl CompanionDialogueAssignmentForm {
    pub fn parse(assignments: Vec<LearningCompanionAssignment>) -> Option<Self> {
        if assignments.len() > MAX_ASSIGNMENTS
            || assignments.iter().any(|assignment| {
                !matches!(
                    assignment.scope_type.as_str(),
                    "world" | "map" | "node" | "activity"
                )
            })
        {
            return None;
        }
        let mut seen = HashSet::new();
        let assignments = assignments
            .into_iter()
            .filter(|assignment| seen.insert((assignment.scope_type.clone(), assignment.scope_id)))
            .collect();
        Some(Self { assignments })
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct CompanionDialogueForm {
    pub dialogue_graph: Value,
    pub name: String,
}

impl CompanionDialogueForm {
    pub fn parse(name: &str, dialogue_graph: Option<Value>) -> Option<Self> {
        let name = required_string(name, 120)?;
        let dialogue_graph = match dialogue_graph {
            Some(Value::Null) | None => default_graph(),
            Some(value) => parse_graph(&value)?,
        };
        Some(Self {
            dialogue_graph,
            name,
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminLearningCompanionDialogueError {
    Invalid,
    Unavailable,
}

pub trait AdminLearningCompanionDialogueRepository {
    fn list(
        &self,
        page: &CompanionDialoguePageRequest,
    ) -> impl Future<
        Output = Result<LearningCompanionDialoguePage, AdminLearningCompanionDialogueError>,
    > + Send;
    fn show(
        &self,
        dialogue_id: Uuid,
    ) -> impl Future<
        Output = Result<Option<LearningCompanionDialogue>, AdminLearningCompanionDialogueError>,
    > + Send;
    fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &CompanionDialogueForm,
    ) -> impl Future<Output = Result<LearningCompanionDialogue, AdminLearningCompanionDialogueError>>
    + Send;
    fn update(
        &self,
        principal: &AuthorizedPrincipal,
        dialogue_id: Uuid,
        form: &CompanionDialogueForm,
    ) -> impl Future<
        Output = Result<Option<LearningCompanionDialogue>, AdminLearningCompanionDialogueError>,
    > + Send;
    fn delete(
        &self,
        dialogue_id: Uuid,
    ) -> impl Future<Output = Result<bool, AdminLearningCompanionDialogueError>> + Send;
    fn assignments(
        &self,
        principal: &AuthorizedPrincipal,
        dialogue_id: Uuid,
        page: &CompanionDialoguePageRequest,
    ) -> impl Future<
        Output = Result<
            Option<LearningCompanionAssignmentPage>,
            AdminLearningCompanionDialogueError,
        >,
    > + Send;
    fn sync_assignments(
        &self,
        principal: &AuthorizedPrincipal,
        dialogue_id: Uuid,
        form: &CompanionDialogueAssignmentForm,
    ) -> impl Future<Output = Result<Option<i64>, AdminLearningCompanionDialogueError>> + Send;
}

pub struct AdminLearningCompanionDialogueQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminLearningCompanionDialogueQuery<'repository, Repository>
where
    Repository: AdminLearningCompanionDialogueRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn list(
        &self,
        principal: &AuthorizedPrincipal,
        page: &CompanionDialoguePageRequest,
    ) -> Result<Option<LearningCompanionDialoguePage>, AdminLearningCompanionDialogueError> {
        if !principal.has_permission("companion", "ro") {
            return Ok(None);
        }
        self.repository.list(page).await.map(Some)
    }

    pub async fn show(
        &self,
        principal: &AuthorizedPrincipal,
        dialogue_id: Uuid,
    ) -> Result<Option<LearningCompanionDialogue>, AdminLearningCompanionDialogueError> {
        if !principal.has_permission("companion", "ro") {
            return Ok(None);
        }
        self.repository.show(dialogue_id).await
    }
}

pub struct AdminLearningCompanionDialogueCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminLearningCompanionDialogueCommand<'repository, Repository>
where
    Repository: AdminLearningCompanionDialogueRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &CompanionDialogueForm,
    ) -> Result<Option<LearningCompanionDialogue>, AdminLearningCompanionDialogueError> {
        if !principal.has_permission("companion", "ru") {
            return Ok(None);
        }
        self.repository.create(principal, form).await.map(Some)
    }

    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        dialogue_id: Uuid,
        form: &CompanionDialogueForm,
    ) -> Result<Option<LearningCompanionDialogue>, AdminLearningCompanionDialogueError> {
        if !principal.has_permission("companion", "ru") {
            return Ok(None);
        }
        self.repository.update(principal, dialogue_id, form).await
    }

    pub async fn delete(
        &self,
        principal: &AuthorizedPrincipal,
        dialogue_id: Uuid,
    ) -> Result<bool, AdminLearningCompanionDialogueError> {
        if !principal.has_permission("companion", "ru") {
            return Ok(false);
        }
        self.repository.delete(dialogue_id).await
    }

    pub async fn assignments(
        &self,
        principal: &AuthorizedPrincipal,
        dialogue_id: Uuid,
        page: &CompanionDialoguePageRequest,
    ) -> Result<Option<LearningCompanionAssignmentPage>, AdminLearningCompanionDialogueError> {
        if !principal.has_permission("companion", "ru") {
            return Ok(None);
        }
        self.repository
            .assignments(principal, dialogue_id, page)
            .await
    }

    pub async fn sync_assignments(
        &self,
        principal: &AuthorizedPrincipal,
        dialogue_id: Uuid,
        form: &CompanionDialogueAssignmentForm,
    ) -> Result<Option<i64>, AdminLearningCompanionDialogueError> {
        if !principal.has_permission("companion", "ru") {
            return Ok(None);
        }
        self.repository
            .sync_assignments(principal, dialogue_id, form)
            .await
    }
}

fn default_graph() -> Value {
    json!({
        "version": 1,
        "start": "welcome",
        "nodes": [
            {"id": "welcome", "type": "message", "message": "Choose a direction when you are ready.", "next": "choice"},
            {"id": "choice", "type": "choice", "prompt": "What would help next?", "choices": [
                {"key": "map", "label": "Return to the map", "action": "current-map"},
                {"key": "desk", "label": "Open the learning desk", "action": "learning-desk"}
            ]}
        ]
    })
}

fn parse_graph(value: &Value) -> Option<Value> {
    let graph = value.as_object()?;
    if graph.get("version")?.as_i64()? != 1 {
        return None;
    }
    let start = required_json_string(graph, "start", 80)?;
    let nodes = graph.get("nodes")?.as_array()?;
    if nodes.is_empty() || nodes.len() > 24 {
        return None;
    }
    let mut known_ids = HashSet::new();
    let nodes = nodes
        .iter()
        .map(|node| parse_node(node, &mut known_ids))
        .collect::<Option<Vec<_>>>()?;
    if !known_ids.contains(&start) || !graph_targets_exist(&nodes, &known_ids) {
        return None;
    }
    Some(json!({"version": 1, "start": start, "nodes": nodes}))
}

fn parse_node(value: &Value, known_ids: &mut HashSet<String>) -> Option<Value> {
    let node = value.as_object()?;
    let id = required_json_string(node, "id", 80)?;
    if !known_ids.insert(id.clone()) {
        return None;
    }
    let node_type = required_json_string(node, "type", 20)?;
    let mut parsed = Map::new();
    parsed.insert("id".to_owned(), Value::String(id));
    parsed.insert("type".to_owned(), Value::String(node_type.clone()));
    optional_json_string(node, "title", 120, &mut parsed)?;
    optional_position(node, &mut parsed)?;
    optional_target(node, "next", &mut parsed)?;

    match node_type.as_str() {
        "message" | "end" => {
            parsed.insert(
                "message".to_owned(),
                Value::String(required_json_string(node, "message", 2_000)?),
            );
        }
        "choice" => {
            parsed.insert(
                "prompt".to_owned(),
                Value::String(required_json_string(node, "prompt", 1_000)?),
            );
            let choices = node.get("choices")?.as_array()?;
            if choices.is_empty() || choices.len() > 4 {
                return None;
            }
            let mut keys = HashSet::new();
            let choices = choices
                .iter()
                .map(|choice| parse_choice(choice, &mut keys))
                .collect::<Option<Vec<_>>>()?;
            parsed.insert("choices".to_owned(), Value::Array(choices));
        }
        "ai" => {
            parsed.insert(
                "instruction".to_owned(),
                Value::String(required_json_string(node, "instruction", 1_000)?),
            );
            if let Some(response_mode) = optional_string(node, "response_mode", 20)? {
                if !matches!(response_mode.as_str(), "message" | "choice") {
                    return None;
                }
                parsed.insert("response_mode".to_owned(), Value::String(response_mode));
            }
            let capabilities = match node.get("capabilities") {
                Some(value) => value.as_array()?.as_slice(),
                None => &[],
            }
            .iter()
            .map(|value| value.as_str().map(str::to_owned))
            .collect::<Option<Vec<_>>>()?;
            if capabilities.len() > 3
                || capabilities
                    .iter()
                    .any(|capability| !AI_CAPABILITIES.contains(&capability.as_str()))
                || has_duplicates(&capabilities)
            {
                return None;
            }
            if !capabilities.is_empty() {
                parsed.insert(
                    "capabilities".to_owned(),
                    Value::Array(capabilities.into_iter().map(Value::String).collect()),
                );
            }
        }
        _ => return None,
    }
    Some(Value::Object(parsed))
}

fn parse_choice(value: &Value, known_keys: &mut HashSet<String>) -> Option<Value> {
    let choice = value.as_object()?;
    let key = required_json_string(choice, "key", 80)?;
    if !known_keys.insert(key.clone()) {
        return None;
    }
    let mut parsed = Map::new();
    parsed.insert("key".to_owned(), Value::String(key));
    parsed.insert(
        "label".to_owned(),
        Value::String(required_json_string(choice, "label", 240)?),
    );
    optional_target(choice, "next", &mut parsed)?;
    if let Some(action) = optional_string(choice, "action", 80)? {
        if !NAVIGATION_ACTIONS.contains(&action.as_str()) {
            return None;
        }
        parsed.insert("action".to_owned(), Value::String(action));
    }
    (parsed.contains_key("next") || parsed.contains_key("action")).then_some(Value::Object(parsed))
}

fn graph_targets_exist(nodes: &[Value], ids: &HashSet<String>) -> bool {
    nodes.iter().all(|node| {
        let Some(node) = node.as_object() else {
            return false;
        };
        node.get("next")
            .and_then(Value::as_str)
            .is_none_or(|target| ids.contains(target))
            && node
                .get("choices")
                .and_then(Value::as_array)
                .is_none_or(|choices| {
                    choices.iter().all(|choice| {
                        choice
                            .as_object()
                            .and_then(|choice| choice.get("next"))
                            .and_then(Value::as_str)
                            .is_none_or(|target| ids.contains(target))
                    })
                })
    })
}

fn required_string(value: &str, maximum: usize) -> Option<String> {
    let value = value.trim();
    (!value.is_empty() && value.chars().count() <= maximum).then(|| value.to_owned())
}

fn required_json_string(map: &Map<String, Value>, key: &str, maximum: usize) -> Option<String> {
    required_string(map.get(key)?.as_str()?, maximum)
}

fn optional_string(map: &Map<String, Value>, key: &str, maximum: usize) -> Option<Option<String>> {
    match map.get(key) {
        None | Some(Value::Null) => Some(None),
        Some(value) => required_string(value.as_str()?, maximum).map(Some),
    }
}

fn optional_json_string(
    source: &Map<String, Value>,
    key: &str,
    maximum: usize,
    destination: &mut Map<String, Value>,
) -> Option<()> {
    if let Some(value) = optional_string(source, key, maximum)? {
        destination.insert(key.to_owned(), Value::String(value));
    }
    Some(())
}

fn optional_target(
    source: &Map<String, Value>,
    key: &str,
    destination: &mut Map<String, Value>,
) -> Option<()> {
    optional_json_string(source, key, 80, destination)
}

fn optional_position(
    source: &Map<String, Value>,
    destination: &mut Map<String, Value>,
) -> Option<()> {
    let Some(position) = source.get("position") else {
        return Some(());
    };
    let position = position.as_object()?;
    let x = position.get("x")?.as_i64()?;
    let y = position.get("y")?.as_i64()?;
    if !(-10_000..=10_000).contains(&x) || !(-10_000..=10_000).contains(&y) {
        return None;
    }
    destination.insert("position".to_owned(), json!({"x": x, "y": y}));
    Some(())
}

fn has_duplicates(values: &[String]) -> bool {
    values
        .iter()
        .enumerate()
        .any(|(index, value)| values[..index].contains(value))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::CompanionDialogueForm;

    #[test]
    fn dialogue_graph_requires_known_targets_and_allowlisted_actions() {
        assert!(CompanionDialogueForm::parse(
            "Guide",
            Some(json!({"version": 1, "start": "first", "nodes": [
                {"id": "first", "type": "choice", "prompt": "Choose", "choices": [{"key": "next", "label": "Next", "next": "missing"}]}
            ]})),
        )
        .is_none());
        assert!(CompanionDialogueForm::parse(
            "Guide",
            Some(json!({"version": 1, "start": "first", "nodes": [
                {"id": "first", "type": "choice", "prompt": "Choose", "choices": [{"key": "next", "label": "Next", "action": "delete-content"}]}
            ]})),
        )
        .is_none());
    }
}
