use std::collections::{HashMap, HashSet};

use serde_json::{Map, Value};
use sqlx::{FromRow, PgPool};
use time::{OffsetDateTime, PrimitiveDateTime, UtcOffset, format_description::well_known::Rfc3339};
use uuid::Uuid;
use wicked_learning_domain::world_content::AdminUnlockDiagnostic;

/// The source World Builder reports prerequisite paths that cannot be opened
/// independently. This stays in the authoring projection: it is not a learner
/// availability decision and does not expose draft content to learner reads.
#[derive(Clone)]
pub(crate) struct DiagnosticNode {
    pub id: Uuid,
    pub title: String,
    pub state: String,
    pub visual_config: Value,
}

#[derive(FromRow)]
struct NodeRow {
    id: Uuid,
    title: String,
    state: String,
    visual_config: Value,
}

/// Calculates the source-compatible diagnostics for the requested authoring
/// nodes. Dependencies are deliberately loaded across maps, matching Laravel's
/// global node lookup and avoiding browser-side reachability inference.
pub(crate) async fn load_unlock_diagnostics(
    pool: &PgPool,
    target_node_ids: &[Uuid],
) -> Result<HashMap<Uuid, Vec<AdminUnlockDiagnostic>>, sqlx::Error> {
    if target_node_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let nodes =
        sqlx::query_as::<_, NodeRow>("SELECT id, title, state, visual_config FROM learning_nodes")
            .fetch_all(pool)
            .await?
            .into_iter()
            .map(|node| {
                (
                    node.id,
                    DiagnosticNode {
                        id: node.id,
                        title: node.title,
                        state: node.state,
                        visual_config: node.visual_config,
                    },
                )
            })
            .collect();
    let tools = sqlx::query_scalar::<_, String>("SELECT slug FROM learning_tools")
        .fetch_all(pool)
        .await?
        .into_iter()
        .collect();
    let items = sqlx::query_scalar::<_, String>("SELECT slug FROM learning_items")
        .fetch_all(pool)
        .await?
        .into_iter()
        .collect();
    let roles = sqlx::query_scalar::<_, String>("SELECT role_key FROM application_roles")
        .fetch_all(pool)
        .await?
        .into_iter()
        .collect();
    let answer_event_targets = sqlx::query_scalar::<_, Value>(
        "SELECT node_config FROM learning_npc_dialogue_nodes WHERE node_type = 'answer'",
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .flat_map(answer_unlock_targets)
    .collect();

    let mut evaluator = ReachabilityEvaluator {
        answer_event_targets,
        items,
        nodes,
        path_cache: HashMap::new(),
        roles,
        tools,
    };
    Ok(target_node_ids
        .iter()
        .filter_map(|node_id| {
            evaluator.nodes.get(node_id).cloned().map(|node| {
                let diagnostics = evaluator.unreachable_prerequisites(&node);
                (*node_id, diagnostics)
            })
        })
        .collect())
}

struct ReachabilityEvaluator {
    answer_event_targets: HashSet<Uuid>,
    items: HashSet<String>,
    nodes: HashMap<Uuid, DiagnosticNode>,
    path_cache: HashMap<Uuid, bool>,
    roles: HashSet<String>,
    tools: HashSet<String>,
}

impl ReachabilityEvaluator {
    fn unreachable_prerequisites(&mut self, node: &DiagnosticNode) -> Vec<AdminUnlockDiagnostic> {
        if node.state != "locked" {
            return vec![];
        }
        let unlock = unlock(&node.visual_config);
        let unreachable_ids = if has_authored_rules(unlock) {
            self.unreachable_ids_in_rule(
                unlock.get("rules").expect("authored rules are present"),
                &HashSet::new(),
                unlock,
                schedule_unlock_at(&node.visual_config),
            )
        } else {
            node_ids_in_rule(unlock.get("requiredNodeIds"))
                .into_iter()
                .filter(|id| !self.has_independent_opening_path(*id, &mut HashSet::new()))
                .collect()
        };
        unreachable_ids
            .into_iter()
            .filter_map(|id| self.nodes.get(&id))
            .map(|node| AdminUnlockDiagnostic {
                id: node.id,
                title: node.title.clone(),
            })
            .collect()
    }

    fn unreachable_ids_in_rule(
        &mut self,
        rule: &Value,
        visiting: &HashSet<Uuid>,
        unlock: &Map<String, Value>,
        has_schedule_unlock: bool,
    ) -> Vec<Uuid> {
        let Some(rule) = rule.as_object() else {
            return vec![];
        };
        if rule.get("type").and_then(Value::as_str) == Some("node_completed") {
            return reference_uuid(rule.get("nodeId"))
                .filter(|id| !self.has_independent_opening_path(*id, &mut visiting.clone()))
                .into_iter()
                .collect();
        }
        if rule.get("type").and_then(Value::as_str) != Some("group") {
            return vec![];
        }
        let children = rule
            .get("rules")
            .and_then(Value::as_array)
            .filter(|children| !children.is_empty())
            .map(Vec::as_slice);
        let Some(children) = children else {
            return vec![];
        };
        if rule.get("operator").and_then(Value::as_str) == Some("or") {
            let mut unreachable = Vec::new();
            for child in children {
                if self.rule_can_open(child, &mut visiting.clone(), unlock, has_schedule_unlock) {
                    return vec![];
                }
                extend_unique(
                    &mut unreachable,
                    self.unreachable_ids_in_rule(child, visiting, unlock, has_schedule_unlock),
                );
            }
            return unreachable;
        }
        let mut unreachable = Vec::new();
        for child in children {
            extend_unique(
                &mut unreachable,
                self.unreachable_ids_in_rule(child, visiting, unlock, has_schedule_unlock),
            );
        }
        unreachable
    }

    fn has_independent_opening_path(
        &mut self,
        node_id: Uuid,
        visiting: &mut HashSet<Uuid>,
    ) -> bool {
        let Some(node) = self.nodes.get(&node_id).cloned() else {
            return false;
        };
        if node.state == "hidden" {
            return reveal_is_discoverable(&node.visual_config, &self.tools);
        }
        if node.state != "locked" {
            return true;
        }
        if let Some(result) = self.path_cache.get(&node_id) {
            return *result;
        }
        if !visiting.insert(node_id) {
            return false;
        }
        let result = if self.answer_event_targets.contains(&node_id) {
            true
        } else {
            let unlock = unlock(&node.visual_config);
            if !enabled(unlock.get("enabled")) {
                has_configured_tool(unlock, &self.tools)
            } else if has_authored_rules(unlock) {
                self.rule_can_open(
                    unlock.get("rules").expect("authored rules are present"),
                    visiting,
                    unlock,
                    schedule_unlock_at(&node.visual_config),
                )
            } else {
                self.legacy_rule_can_open(unlock, visiting, schedule_unlock_at(&node.visual_config))
            }
        };
        visiting.remove(&node_id);
        self.path_cache.insert(node_id, result);
        result
    }

    fn rule_can_open(
        &mut self,
        rule: &Value,
        visiting: &mut HashSet<Uuid>,
        unlock: &Map<String, Value>,
        has_schedule_unlock: bool,
    ) -> bool {
        let Some(rule) = rule.as_object() else {
            return false;
        };
        match rule.get("type").and_then(Value::as_str) {
            Some("node_completed") => reference_uuid(rule.get("nodeId"))
                .is_some_and(|id| self.has_independent_opening_path(id, visiting)),
            Some("tool_used") => has_configured_tool(unlock, &self.tools),
            Some("item_owned") => has_configured_item(unlock, &self.items),
            Some("role_has") => {
                reference(rule.get("roleSlug")).is_some_and(|role| self.roles.contains(role))
            }
            Some("time_after") => has_schedule_unlock,
            Some("group") => {
                let Some(children) = rule
                    .get("rules")
                    .and_then(Value::as_array)
                    .filter(|children| !children.is_empty())
                else {
                    return false;
                };
                if rule.get("operator").and_then(Value::as_str) == Some("or") {
                    children.iter().any(|child| {
                        self.rule_can_open(
                            child,
                            &mut visiting.clone(),
                            unlock,
                            has_schedule_unlock,
                        )
                    })
                } else {
                    children.iter().all(|child| {
                        self.rule_can_open(
                            child,
                            &mut visiting.clone(),
                            unlock,
                            has_schedule_unlock,
                        )
                    })
                }
            }
            _ => false,
        }
    }

    fn legacy_rule_can_open(
        &mut self,
        unlock: &Map<String, Value>,
        visiting: &mut HashSet<Uuid>,
        has_schedule_unlock: bool,
    ) -> bool {
        let mut results = node_ids_in_rule(unlock.get("requiredNodeIds"))
            .into_iter()
            .map(|id| self.has_independent_opening_path(id, &mut visiting.clone()))
            .collect::<Vec<_>>();
        if has_configured_tool(unlock, &self.tools) {
            results.push(true);
        }
        if has_configured_item(unlock, &self.items) {
            results.push(true);
        }
        if reference(unlock.get("roleSlug")).is_some_and(|role| self.roles.contains(role)) {
            results.push(true);
        }
        if has_schedule_unlock {
            results.push(true);
        }
        if results.is_empty() {
            return false;
        }
        if unlock.get("topOperator").and_then(Value::as_str) == Some("or") {
            results.into_iter().any(|result| result)
        } else {
            results.into_iter().all(|result| result)
        }
    }
}

fn answer_unlock_targets(config: Value) -> Vec<Uuid> {
    config
        .get("events")
        .and_then(Value::as_object)
        .and_then(|events| events.get("unlockNodeIds"))
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|value| reference_uuid(Some(value)))
        .collect()
}

fn unlock(config: &Value) -> &Map<String, Value> {
    match config.get("unlock").and_then(Value::as_object) {
        Some(unlock) => unlock,
        None => empty_object(),
    }
}

fn empty_object() -> &'static Map<String, Value> {
    static EMPTY: std::sync::OnceLock<Map<String, Value>> = std::sync::OnceLock::new();
    EMPTY.get_or_init(Map::new)
}

fn has_authored_rules(unlock: &Map<String, Value>) -> bool {
    unlock.get("rules").is_some_and(|rules| match rules {
        Value::Array(rules) => !rules.is_empty(),
        Value::Object(rules) => !rules.is_empty(),
        _ => false,
    })
}

fn node_ids_in_rule(value: Option<&Value>) -> Vec<Uuid> {
    value
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|value| reference_uuid(Some(value)))
        .fold(Vec::new(), |mut ids, id| {
            if !ids.contains(&id) {
                ids.push(id);
            }
            ids
        })
}

fn has_configured_tool(unlock: &Map<String, Value>, tools: &HashSet<String>) -> bool {
    unlock
        .get("tool")
        .and_then(Value::as_object)
        .filter(|tool| enabled(tool.get("enabled")))
        .and_then(|tool| reference(tool.get("toolId")))
        .is_some_and(|tool| tools.contains(tool))
}

fn has_configured_item(unlock: &Map<String, Value>, items: &HashSet<String>) -> bool {
    enabled(unlock.get("enabled"))
        && unlock
            .get("item")
            .and_then(Value::as_object)
            .filter(|item| enabled(item.get("enabled")))
            .and_then(|item| reference(item.get("itemId")))
            .is_some_and(|item| items.contains(item))
}

fn reveal_is_discoverable(config: &Value, tools: &HashSet<String>) -> bool {
    config
        .get("reveal")
        .and_then(Value::as_object)
        .filter(|reveal| enabled(reveal.get("enabled")))
        .and_then(|reveal| reference(reveal.get("toolId")))
        .is_some_and(|tool| tools.contains(tool))
}

fn schedule_unlock_at(config: &Value) -> bool {
    let Some(value) = config
        .get("schedule")
        .and_then(Value::as_object)
        .and_then(|schedule| schedule.get("unlockAt"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return false;
    };
    OffsetDateTime::parse(value, &Rfc3339).is_ok()
        || time::format_description::parse_borrowed::<2>("[year]-[month]-[day]T[hour]:[minute]")
            .ok()
            .and_then(|format| PrimitiveDateTime::parse(value, &format).ok())
            .map(|value| value.assume_offset(UtcOffset::UTC))
            .is_some()
}

fn reference(value: Option<&Value>) -> Option<&str> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn reference_uuid(value: Option<&Value>) -> Option<Uuid> {
    reference(value).and_then(|value| Uuid::parse_str(value).ok())
}

fn enabled(value: Option<&Value>) -> bool {
    matches!(value, Some(Value::Bool(true)))
        || matches!(value, Some(Value::String(value)) if value.eq_ignore_ascii_case("true"))
}

fn extend_unique(target: &mut Vec<Uuid>, values: Vec<Uuid>) {
    for value in values {
        if !target.contains(&value) {
            target.push(value);
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{DiagnosticNode, HashMap, HashSet, ReachabilityEvaluator};
    use uuid::Uuid;

    fn node(
        id: Uuid,
        title: &str,
        state: &str,
        visual_config: serde_json::Value,
    ) -> DiagnosticNode {
        DiagnosticNode {
            id,
            title: title.to_owned(),
            state: state.to_owned(),
            visual_config,
        }
    }

    fn evaluator(nodes: Vec<DiagnosticNode>) -> ReachabilityEvaluator {
        ReachabilityEvaluator {
            answer_event_targets: HashSet::new(),
            items: HashSet::new(),
            nodes: nodes.into_iter().map(|node| (node.id, node)).collect(),
            path_cache: HashMap::new(),
            roles: HashSet::new(),
            tools: HashSet::new(),
        }
    }

    #[test]
    fn reports_locked_prerequisite_without_an_opening_path() {
        let prerequisite_id = Uuid::new_v4();
        let target_id = Uuid::new_v4();
        let prerequisite = node(prerequisite_id, "Blocked gate", "locked", json!({}));
        let target = node(
            target_id,
            "Arrival",
            "locked",
            json!({
                "unlock": {
                    "enabled": true,
                    "rules": { "type": "node_completed", "nodeId": prerequisite_id }
                }
            }),
        );
        let mut evaluator = evaluator(vec![prerequisite, target.clone()]);

        assert_eq!(
            evaluator.unreachable_prerequisites(&target)[0].title,
            "Blocked gate"
        );
    }

    #[test]
    fn ignores_unreachable_branch_when_an_or_schedule_can_open() {
        let prerequisite_id = Uuid::new_v4();
        let target_id = Uuid::new_v4();
        let prerequisite = node(prerequisite_id, "Blocked gate", "locked", json!({}));
        let target = node(
            target_id,
            "Arrival",
            "locked",
            json!({
                "schedule": { "unlockAt": "2030-01-01T00:00:00Z" },
                "unlock": {
                    "enabled": true,
                    "rules": {
                        "type": "group",
                        "operator": "or",
                        "rules": [
                            { "type": "node_completed", "nodeId": prerequisite_id },
                            { "type": "time_after" }
                        ]
                    }
                }
            }),
        );
        let mut evaluator = evaluator(vec![prerequisite, target.clone()]);

        assert!(evaluator.unreachable_prerequisites(&target).is_empty());
    }

    #[test]
    fn answer_event_is_an_independent_opening_path() {
        let prerequisite_id = Uuid::new_v4();
        let target_id = Uuid::new_v4();
        let prerequisite = node(prerequisite_id, "Answer gate", "locked", json!({}));
        let target = node(
            target_id,
            "Arrival",
            "locked",
            json!({
                "unlock": {
                    "enabled": true,
                    "rules": { "type": "node_completed", "nodeId": prerequisite_id }
                }
            }),
        );
        let mut evaluator = evaluator(vec![prerequisite, target.clone()]);
        evaluator.answer_event_targets.insert(prerequisite_id);

        assert!(evaluator.unreachable_prerequisites(&target).is_empty());
    }
}
