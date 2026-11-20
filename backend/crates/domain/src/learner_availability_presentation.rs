use std::collections::HashMap;

use serde_json::{Value, json};

use crate::learner_availability::{
    LearnerNodeAvailabilityConfig, LearnerNodeAvailabilityFacts, LearnerNodeState,
    LearnerNodeToolAction, RuleOperator, UnlockRule, evaluate_rule, learner_node_state,
    legacy_rules,
};

/// Labels are resolved in batches by persistence. No author configuration or
/// another learner's progress is used as a substitute for these facts.
#[derive(Default)]
pub struct AvailabilityLabels {
    pub nodes: HashMap<String, Value>,
    pub tools: HashMap<String, String>,
    pub items: HashMap<String, String>,
    pub roles: HashMap<String, String>,
}

/// LearningNodeSerializer::baseNode / concealedNode and NodeUnlockService's
/// evaluated source presentation, using the same facts as the access policy.
pub fn visual_config(
    authored: LearnerNodeState,
    state: LearnerNodeState,
    config: &Value,
    facts: &LearnerNodeAvailabilityFacts,
    labels: &AvailabilityLabels,
) -> Value {
    if state == LearnerNodeState::Hidden {
        return json!({"hideEmptySpace": true, "reveal": {
            "isDiscoverable": true, "isDiscovered": false,
        }});
    }
    let parsed = LearnerNodeAvailabilityConfig::from_visual_config(config);
    let mut visual = config.as_object().cloned().unwrap_or_default();
    let mut reveal = visual
        .get("reveal")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    reveal.insert("isDiscoverable".into(), json!(matches!(
        parsed.tool_action(authored), Some(LearnerNodeToolAction::Reveal { ref tool_reference }) if labels.tools.contains_key(tool_reference)
    )));
    reveal.insert("isDiscovered".into(), json!(true));
    visual.insert("reveal".into(), Value::Object(reveal));

    let tool_reference = match parsed.tool_action(authored) {
        Some(LearnerNodeToolAction::Unlock { tool_reference }) => Some(tool_reference),
        _ => None,
    };
    let tool_unlockable = tool_reference
        .as_ref()
        .is_some_and(|reference| labels.tools.contains_key(reference));
    let item_unlockable =
        authored == LearnerNodeState::Locked && parsed.unlock.legacy_item_reference.is_some();
    let mut legacy_config = parsed.unlock.clone();
    if authored != LearnerNodeState::Locked {
        legacy_config.legacy_tool_configured = false;
        legacy_config.legacy_item_reference = None;
    }
    let legacy = legacy_rules(&legacy_config, facts.has_unlock_schedule);
    let has_rules =
        parsed.unlock.enabled && (parsed.unlock.authored_rule.is_some() || !legacy.is_empty());
    if !has_rules && !tool_unlockable && !item_unlockable {
        visual.remove("unlock");
        return Value::Object(visual);
    }
    let rule = match &parsed.unlock.authored_rule {
        Some(Some(rule)) => rule.clone(),
        // Malformed authored rules retain a visibly unsatisfied group.
        Some(None) => UnlockRule::Group {
            operator: RuleOperator::And,
            rules: vec![],
        },
        None => UnlockRule::Group {
            operator: parsed.unlock.legacy_top_operator,
            rules: legacy,
        },
    };
    let mut unlock_facts = facts.clone();
    // Source isUnlocked is the rule result; timed locking is represented by
    // node.state separately. Non-locked authored nodes are already unlocked.
    unlock_facts.is_locked_by_schedule = false;
    unlock_facts.is_hidden_by_answer = false;
    let unlocked = authored != LearnerNodeState::Locked
        || learner_node_state(authored, &parsed, &unlock_facts).can_play();
    let item_owned = item_unlockable
        && parsed
            .unlock
            .legacy_item_reference
            .as_ref()
            .is_some_and(|reference| facts.owned_item_references.contains(reference));
    let titles = RequirementTitles {
        tool: tool_reference
            .as_ref()
            .and_then(|reference| labels.tools.get(reference)),
        item: parsed
            .unlock
            .legacy_item_reference
            .as_ref()
            .and_then(|reference| labels.items.get(reference)),
        role: parsed
            .unlock
            .legacy_role_slug
            .as_ref()
            .and_then(|reference| labels.roles.get(reference)),
        unlock_at: config.pointer("/schedule/unlockAt").and_then(Value::as_str),
    };
    visual.insert(
        "unlock".into(),
        json!({
            "isUnlockable": true,
            "isUnlocked": unlocked,
            "isManuallyUnlocked": facts.has_manual_unlock,
            "isItemUnlockable": item_unlockable,
            "isToolUnlockable": tool_unlockable,
            "itemOwned": item_owned,
            "toolUsed": facts.has_tool_unlock,
            "requirements": requirement(&rule, facts, labels, &titles),
        }),
    );
    Value::Object(visual)
}

struct RequirementTitles<'a> {
    tool: Option<&'a String>,
    item: Option<&'a String>,
    role: Option<&'a String>,
    unlock_at: Option<&'a str>,
}

fn requirement(
    rule: &UnlockRule,
    facts: &LearnerNodeAvailabilityFacts,
    labels: &AvailabilityLabels,
    titles: &RequirementTitles<'_>,
) -> Value {
    let satisfied = evaluate_rule(rule, facts);
    match rule {
        UnlockRule::NodeCompleted { node_reference } => {
            let node = labels.nodes.get(node_reference);
            json!({"type": "node_completed", "satisfied": satisfied,
                "mapSlug": node.and_then(|node| node.get("mapSlug")),
                "nodeSlug": node.and_then(|node| node.get("nodeSlug")),
                "nodeTitle": node.and_then(|node| node.get("nodeTitle")),
            })
        }
        UnlockRule::ToolUsed => {
            json!({"type": "tool_used", "toolTitle": titles.tool, "satisfied": satisfied})
        }
        UnlockRule::ItemOwned { .. } => {
            json!({"type": "item_owned", "itemTitle": titles.item, "satisfied": satisfied})
        }
        UnlockRule::RoleHas { role_slug } => {
            json!({"type": "role_has", "roleSlug": role_slug, "roleTitle": titles.role.unwrap_or(role_slug), "satisfied": satisfied})
        }
        UnlockRule::TimeAfter => {
            json!({"type": "time_after", "availableAt": titles.unlock_at, "satisfied": satisfied})
        }
        UnlockRule::Group { operator, rules } => {
            json!({"type": "group", "operator": if *operator == RuleOperator::Or { "or" } else { "and" }, "satisfied": satisfied,
                "requirements": rules.iter().map(|rule| requirement(rule, facts, labels, titles)).collect::<Vec<_>>(),
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn available_nodes_do_not_invent_tool_requirements_and_manual_unlocks_keep_timed_locks() {
        let config = json!({"tileColor":"#123456","unlock":{"enabled":true,"tool":{"enabled":true,"toolId":"lens"}}});
        let labels = AvailabilityLabels {
            tools: HashMap::from([("lens".into(), "Lens".into())]),
            ..Default::default()
        };
        let facts = LearnerNodeAvailabilityFacts {
            has_manual_unlock: true,
            is_locked_by_schedule: true,
            ..Default::default()
        };
        let available = visual_config(
            LearnerNodeState::Available,
            LearnerNodeState::Available,
            &config,
            &facts,
            &labels,
        );
        assert!(available.get("unlock").is_none());
        assert_eq!(available["tileColor"], "#123456");
        let locked = visual_config(
            LearnerNodeState::Locked,
            LearnerNodeState::Locked,
            &config,
            &facts,
            &labels,
        );
        assert_eq!(locked["unlock"]["isManuallyUnlocked"], true);
        assert_eq!(locked["unlock"]["isUnlocked"], true);
        assert_eq!(
            learner_node_state(
                LearnerNodeState::Locked,
                &LearnerNodeAvailabilityConfig::from_visual_config(&config),
                &facts
            ),
            LearnerNodeState::Locked
        );
    }

    #[test]
    fn conceals_source_titles_configuration_and_tool_requirements_before_discovery() {
        assert_eq!(
            visual_config(
                LearnerNodeState::Hidden,
                LearnerNodeState::Hidden,
                &json!({"label":"Secret", "imageUrl":"secret.png", "reveal":{"enabled":true,"toolId":"lens"}}),
                &Default::default(),
                &Default::default()
            ),
            json!({"hideEmptySpace":true,"reveal":{"isDiscoverable":true,"isDiscovered":false}})
        );
    }

    #[test]
    fn projects_nested_source_requirements_and_keeps_future_schedule_locked_after_tool_use() {
        let config = json!({"unlock":{"enabled":true,"tool":{"enabled":true,"toolId":"lens"},"roleSlug":"learner","item":{"enabled":true,"itemId":"key"},
            "rules":{"type":"group","operator":"and","rules":[{"type":"tool_used"},{"type":"time_after"},{"type":"group","operator":"or","rules":[{"type":"node_completed","nodeId":"first"},{"type":"role_has","roleSlug":"learner"}]},{"type":"item_owned","itemId":"key"}]}},"schedule":{"unlockAt":"2099-01-01T00:00:00Z"}});
        let mut facts = LearnerNodeAvailabilityFacts {
            has_tool_unlock: true,
            has_unlock_schedule: true,
            ..Default::default()
        };
        facts.role_slugs.insert("learner".into());
        facts.owned_item_references.insert("key".into());
        let labels = AvailabilityLabels {
            nodes: HashMap::from([(
                "first".into(),
                json!({"mapSlug":"map","nodeSlug":"first","nodeTitle":"First place"}),
            )]),
            tools: HashMap::from([("lens".into(), "Lens".into())]),
            roles: HashMap::from([("learner".into(), "Learner".into())]),
            items: HashMap::from([("key".into(), "Key".into())]),
        };
        let result = visual_config(
            LearnerNodeState::Locked,
            LearnerNodeState::Locked,
            &config,
            &facts,
            &labels,
        );
        assert_eq!(result["unlock"]["isUnlocked"], false);
        assert_eq!(result["unlock"]["isToolUnlockable"], true);
        assert!(result["unlock"].get("rules").is_none());
        let requirements = &result["unlock"]["requirements"]["requirements"];
        assert_eq!(
            requirements[0],
            json!({"type":"tool_used","toolTitle":"Lens","satisfied":true})
        );
        assert_eq!(
            requirements[1],
            json!({"type":"time_after","availableAt":"2099-01-01T00:00:00Z","satisfied":false})
        );
        assert_eq!(requirements[2]["satisfied"], true);
        assert_eq!(
            requirements[2]["requirements"][0]["nodeTitle"],
            "First place"
        );
        assert_eq!(requirements[3]["itemTitle"], "Key");
        facts.is_unlocked_by_schedule = true;
        assert_eq!(
            visual_config(
                LearnerNodeState::Locked,
                LearnerNodeState::Available,
                &config,
                &facts,
                &labels
            )["unlock"]["isUnlocked"],
            true
        );
        let legacy = json!({"unlock":{"enabled":true,"tool":{"enabled":true,"toolId":"lens"}}, "schedule":{"unlockAt":"2099-01-01T00:00:00Z"}});
        facts.is_unlocked_by_schedule = false;
        assert_eq!(
            learner_node_state(
                LearnerNodeState::Locked,
                &LearnerNodeAvailabilityConfig::from_visual_config(&legacy),
                &facts
            ),
            LearnerNodeState::Locked
        );
    }
}
