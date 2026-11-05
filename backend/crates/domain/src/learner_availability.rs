use std::collections::BTreeSet;

use serde_json::Value;
use time::{OffsetDateTime, format_description::well_known::Rfc3339};

/// The source-defined learner-visible state of a map node. This is kept
/// separate from the authored base state because timed and private conditions
/// can change what one learner may enter without mutating content.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LearnerNodeState {
    Available,
    Hidden,
    Locked,
}

impl LearnerNodeState {
    pub fn can_play(self) -> bool {
        self == Self::Available
    }
}

/// The per-learner facts required to evaluate one published node. Persistence
/// resolves ownership and timestamps before constructing this framework-free
/// value; the browser never evaluates unlock policy itself.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct LearnerNodeAvailabilityFacts {
    pub completed_node_references: BTreeSet<String>,
    pub has_answer_unlock: bool,
    pub has_discovery: bool,
    pub has_manual_unlock: bool,
    pub has_tool_unlock: bool,
    pub is_hidden_by_answer: bool,
    pub is_locked_by_schedule: bool,
    pub has_unlock_schedule: bool,
    pub is_unlocked_by_schedule: bool,
    pub owned_item_references: BTreeSet<String>,
    pub role_slugs: BTreeSet<String>,
}

/// Computes schedule facts from the authored source-compatible visual config
/// at one supplied instant. Authoring must persist RFC 3339 instants; invalid
/// legacy-shaped values are ignored rather than becoming an availability
/// bypass or a request failure.
pub fn schedule_facts(visual_config: &Value, now: OffsetDateTime) -> LearnerNodeAvailabilityFacts {
    let schedule = object(visual_config)
        .and_then(|config| config.get("schedule"))
        .and_then(object);
    let lock_at = schedule
        .and_then(|schedule| schedule.get("lockAt"))
        .and_then(parse_timestamp);
    let unlock_at = schedule
        .and_then(|schedule| schedule.get("unlockAt"))
        .and_then(parse_timestamp);

    LearnerNodeAvailabilityFacts {
        has_unlock_schedule: unlock_at.is_some(),
        is_locked_by_schedule: lock_at.is_some_and(|lock_at| now >= lock_at),
        is_unlocked_by_schedule: unlock_at.is_some_and(|unlock_at| now >= unlock_at),
        ..LearnerNodeAvailabilityFacts::default()
    }
}

/// Parsed source-compatible authored availability configuration. The
/// persistence layer supplies whether referenced tool/item records exist and
/// whether a matching learner event was recorded; this policy deliberately
/// does not trust browser-supplied identifiers or state.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct LearnerNodeAvailabilityConfig {
    pub has_reveal_tool: bool,
    reveal_tool_reference: Option<String>,
    pub unlock: UnlockConfiguration,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct UnlockConfiguration {
    pub enabled: bool,
    pub legacy_item_reference: Option<String>,
    pub legacy_node_references: Vec<String>,
    pub legacy_role_slug: Option<String>,
    pub legacy_tool_configured: bool,
    legacy_tool_reference: Option<String>,
    pub legacy_top_operator: RuleOperator,
    /// `Some` means an authored nested rule tree was supplied. A malformed
    /// tree remains `Some(None)`, which safely stays locked rather than
    /// falling back to permissive legacy conditions.
    pub authored_rule: Option<Option<UnlockRule>>,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum RuleOperator {
    #[default]
    And,
    Or,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum UnlockRule {
    Group {
        operator: RuleOperator,
        rules: Vec<UnlockRule>,
    },
    ItemOwned {
        item_reference: String,
    },
    NodeCompleted {
        node_reference: String,
    },
    RoleHas {
        role_slug: String,
    },
    TimeAfter,
    ToolUsed,
}

/// The only source-defined map actions a learner may perform with an equipped
/// tool. The stable tool reference comes from authored configuration; callers
/// must still prove that the current learner owns that exact tool.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum LearnerNodeToolAction {
    Reveal { tool_reference: String },
    Unlock { tool_reference: String },
}

impl LearnerNodeAvailabilityConfig {
    /// Reads only the subset of `visual_config` that affects learner
    /// availability. Unknown and malformed values are deliberately ignored;
    /// a malformed authored rule tree remains locked when unlock is enabled.
    pub fn from_visual_config(visual_config: &Value) -> Self {
        let visual_config = object(visual_config);
        let reveal = visual_config
            .and_then(|config| config.get("reveal"))
            .and_then(object);
        let unlock = visual_config
            .and_then(|config| config.get("unlock"))
            .and_then(object);
        let reveal_tool_reference = reveal
            .filter(|reveal| enabled(reveal.get("enabled")))
            .and_then(|reveal| reference(reveal.get("toolId")));
        let has_reveal_tool = reveal_tool_reference.is_some();

        let Some(unlock) = unlock else {
            return Self {
                has_reveal_tool,
                reveal_tool_reference,
                unlock: UnlockConfiguration::default(),
            };
        };
        let legacy_tool = unlock.get("tool").and_then(object);
        let legacy_item = unlock.get("item").and_then(object);
        let legacy_tool_reference = legacy_tool
            .filter(|tool| enabled(tool.get("enabled")))
            .and_then(|tool| reference(tool.get("toolId")));
        let authored_rule = unlock
            .get("rules")
            .and_then(|rules| (!empty_rule_tree(rules)).then(|| parse_rule(rules)));

        Self {
            has_reveal_tool,
            reveal_tool_reference,
            unlock: UnlockConfiguration {
                enabled: enabled(unlock.get("enabled")),
                legacy_item_reference: legacy_item
                    .filter(|item| enabled(item.get("enabled")))
                    .and_then(|item| reference(item.get("itemId"))),
                legacy_node_references: unlock
                    .get("requiredNodeIds")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                    .filter_map(|value| reference(Some(value)))
                    .collect(),
                legacy_role_slug: reference(unlock.get("roleSlug")),
                legacy_tool_configured: legacy_tool_reference.is_some(),
                legacy_tool_reference,
                legacy_top_operator: operator(unlock.get("topOperator")),
                authored_rule,
            },
        }
    }

    /// Returns the source action that the authored node permits. New Rust
    /// content refers to tools by their unique slug in `toolId`; source-style
    /// numeric identifiers are deliberately not remapped in this greenfield
    /// platform.
    pub fn tool_action(&self, authored_state: LearnerNodeState) -> Option<LearnerNodeToolAction> {
        match authored_state {
            LearnerNodeState::Hidden => self
                .reveal_tool_reference
                .clone()
                .map(|tool_reference| LearnerNodeToolAction::Reveal { tool_reference }),
            LearnerNodeState::Locked => self
                .unlock
                .legacy_tool_reference
                .clone()
                .map(|tool_reference| LearnerNodeToolAction::Unlock { tool_reference }),
            LearnerNodeState::Available => None,
        }
    }
}

/// Resolves the state a particular learner sees. The order mirrors the source
/// resolver: hidden-answer and undiscovered concealment precede schedules;
/// a discovered hidden node opens only after a schedule permits it. Answer and
/// manual openings bypass ordinary locked-node requirements, not timed locks.
pub fn learner_node_state(
    authored_state: LearnerNodeState,
    config: &LearnerNodeAvailabilityConfig,
    facts: &LearnerNodeAvailabilityFacts,
) -> LearnerNodeState {
    if facts.is_hidden_by_answer {
        return LearnerNodeState::Hidden;
    }

    if authored_state == LearnerNodeState::Hidden && config.has_reveal_tool && !facts.has_discovery
    {
        return LearnerNodeState::Hidden;
    }

    if facts.is_locked_by_schedule {
        return LearnerNodeState::Locked;
    }

    if authored_state == LearnerNodeState::Hidden && config.has_reveal_tool {
        return LearnerNodeState::Available;
    }

    if authored_state != LearnerNodeState::Locked {
        return authored_state;
    }

    if facts.has_answer_unlock || facts.has_manual_unlock {
        return LearnerNodeState::Available;
    }

    if unlocks_node(config, facts) {
        LearnerNodeState::Available
    } else {
        LearnerNodeState::Locked
    }
}

fn unlocks_node(
    config: &LearnerNodeAvailabilityConfig,
    facts: &LearnerNodeAvailabilityFacts,
) -> bool {
    let unlock = &config.unlock;
    let has_unlock_rules = unlock.enabled
        && (unlock.authored_rule.is_some()
            || !legacy_rules(unlock, facts.has_unlock_schedule).is_empty());

    if !has_unlock_rules {
        return facts.has_tool_unlock;
    }

    match &unlock.authored_rule {
        Some(Some(rule)) => evaluate_rule(rule, facts),
        Some(None) => false,
        None => evaluate_group(
            unlock.legacy_top_operator,
            &legacy_rules(unlock, facts.is_unlocked_by_schedule),
            facts,
        ),
    }
}

fn legacy_rules(unlock: &UnlockConfiguration, has_unlock_schedule: bool) -> Vec<UnlockRule> {
    let mut rules = unlock
        .legacy_node_references
        .iter()
        .cloned()
        .map(|node_reference| UnlockRule::NodeCompleted { node_reference })
        .collect::<Vec<_>>();

    if unlock.legacy_tool_configured {
        rules.push(UnlockRule::ToolUsed);
    }
    if let Some(role_slug) = &unlock.legacy_role_slug {
        rules.push(UnlockRule::RoleHas {
            role_slug: role_slug.clone(),
        });
    }
    if let Some(item_reference) = &unlock.legacy_item_reference {
        rules.push(UnlockRule::ItemOwned {
            item_reference: item_reference.clone(),
        });
    }
    if has_unlock_schedule {
        rules.push(UnlockRule::TimeAfter);
    }

    rules
}

fn evaluate_rule(rule: &UnlockRule, facts: &LearnerNodeAvailabilityFacts) -> bool {
    match rule {
        UnlockRule::Group { operator, rules } => evaluate_group(*operator, rules, facts),
        UnlockRule::ItemOwned { item_reference } => {
            facts.owned_item_references.contains(item_reference)
        }
        UnlockRule::NodeCompleted { node_reference } => {
            facts.completed_node_references.contains(node_reference)
        }
        UnlockRule::RoleHas { role_slug } => facts.role_slugs.contains(role_slug),
        UnlockRule::TimeAfter => facts.is_unlocked_by_schedule,
        UnlockRule::ToolUsed => facts.has_tool_unlock,
    }
}

fn evaluate_group(
    operator: RuleOperator,
    rules: &[UnlockRule],
    facts: &LearnerNodeAvailabilityFacts,
) -> bool {
    if rules.is_empty() {
        return false;
    }

    match operator {
        RuleOperator::And => rules.iter().all(|rule| evaluate_rule(rule, facts)),
        RuleOperator::Or => rules.iter().any(|rule| evaluate_rule(rule, facts)),
    }
}

fn parse_rule(value: &Value) -> Option<UnlockRule> {
    let rule = object(value)?;
    match rule.get("type").and_then(Value::as_str)? {
        "group" => Some(UnlockRule::Group {
            operator: operator(rule.get("operator")),
            rules: rule
                .get("rules")
                .and_then(Value::as_array)?
                .iter()
                .filter_map(parse_rule)
                .collect(),
        }),
        "item_owned" => reference(rule.get("itemId"))
            .map(|item_reference| UnlockRule::ItemOwned { item_reference }),
        "node_completed" => reference(rule.get("nodeId"))
            .map(|node_reference| UnlockRule::NodeCompleted { node_reference }),
        "role_has" => {
            reference(rule.get("roleSlug")).map(|role_slug| UnlockRule::RoleHas { role_slug })
        }
        "time_after" => Some(UnlockRule::TimeAfter),
        "tool_used" => Some(UnlockRule::ToolUsed),
        _ => None,
    }
}

fn object(value: &Value) -> Option<&serde_json::Map<String, Value>> {
    value.as_object()
}

fn enabled(value: Option<&Value>) -> bool {
    matches!(value, Some(Value::Bool(true)))
        || matches!(value, Some(Value::String(value)) if value.eq_ignore_ascii_case("true"))
}

fn operator(value: Option<&Value>) -> RuleOperator {
    matches!(value, Some(Value::String(value)) if value == "or")
        .then_some(RuleOperator::Or)
        .unwrap_or(RuleOperator::And)
}

fn reference(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::Number(value) => Some(value.to_string()),
        Value::String(value) => {
            let value = value.trim();
            (!value.is_empty()).then(|| value.to_owned())
        }
        _ => None,
    }
}

fn empty_rule_tree(value: &Value) -> bool {
    value.is_null()
        || value.as_array().is_some_and(std::vec::Vec::is_empty)
        || value.as_object().is_some_and(serde_json::Map::is_empty)
}

fn parse_timestamp(value: &Value) -> Option<OffsetDateTime> {
    let value = value.as_str()?.trim();
    (!value.is_empty())
        .then_some(value)
        .and_then(|value| OffsetDateTime::parse(value, &Rfc3339).ok())
}

#[cfg(test)]
mod tests {
    use super::{
        LearnerNodeAvailabilityConfig, LearnerNodeAvailabilityFacts, LearnerNodeState,
        LearnerNodeToolAction, learner_node_state, schedule_facts,
    };
    use serde_json::json;
    use time::macros::datetime;

    fn facts() -> LearnerNodeAvailabilityFacts {
        LearnerNodeAvailabilityFacts::default()
    }

    #[test]
    fn a_timed_lock_has_precedence_over_every_other_opening_condition() {
        let config = LearnerNodeAvailabilityConfig::default();
        let state = learner_node_state(
            LearnerNodeState::Locked,
            &config,
            &LearnerNodeAvailabilityFacts {
                has_answer_unlock: true,
                has_manual_unlock: true,
                has_tool_unlock: true,
                is_locked_by_schedule: true,
                ..facts()
            },
        );

        assert_eq!(state, LearnerNodeState::Locked);
    }

    #[test]
    fn a_discoverable_hidden_node_opens_only_for_the_learner_who_discovered_it() {
        let config = LearnerNodeAvailabilityConfig::from_visual_config(&json!({
            "reveal": { "enabled": true, "toolId": "magnifier" }
        }));

        assert_eq!(
            learner_node_state(LearnerNodeState::Hidden, &config, &facts()),
            LearnerNodeState::Hidden
        );
        assert_eq!(
            learner_node_state(
                LearnerNodeState::Hidden,
                &config,
                &LearnerNodeAvailabilityFacts {
                    has_discovery: true,
                    ..facts()
                },
            ),
            LearnerNodeState::Available
        );

        assert_eq!(
            learner_node_state(
                LearnerNodeState::Hidden,
                &config,
                &LearnerNodeAvailabilityFacts {
                    has_discovery: true,
                    is_locked_by_schedule: true,
                    ..facts()
                },
            ),
            LearnerNodeState::Locked
        );
    }

    #[test]
    fn tool_actions_require_a_source_enabled_reference_for_the_authored_state() {
        let reveal = LearnerNodeAvailabilityConfig::from_visual_config(&json!({
            "reveal": { "enabled": true, "toolId": "magnifier" }
        }));
        let unlock = LearnerNodeAvailabilityConfig::from_visual_config(&json!({
            "unlock": { "tool": { "enabled": true, "toolId": "key" } }
        }));

        assert_eq!(
            reveal.tool_action(LearnerNodeState::Hidden),
            Some(LearnerNodeToolAction::Reveal {
                tool_reference: "magnifier".to_owned(),
            })
        );
        assert_eq!(
            unlock.tool_action(LearnerNodeState::Locked),
            Some(LearnerNodeToolAction::Unlock {
                tool_reference: "key".to_owned(),
            })
        );
        assert_eq!(reveal.tool_action(LearnerNodeState::Locked), None);
        assert_eq!(unlock.tool_action(LearnerNodeState::Available), None);
    }

    #[test]
    fn manual_and_answer_unlocks_bypass_ordinary_locked_node_requirements() {
        let config = LearnerNodeAvailabilityConfig::from_visual_config(&json!({
            "unlock": {
                "enabled": true,
                "rules": { "type": "node_completed", "nodeId": "first-step" }
            }
        }));

        assert_eq!(
            learner_node_state(
                LearnerNodeState::Locked,
                &config,
                &LearnerNodeAvailabilityFacts {
                    has_manual_unlock: true,
                    ..facts()
                },
            ),
            LearnerNodeState::Available
        );
        assert_eq!(
            learner_node_state(
                LearnerNodeState::Locked,
                &config,
                &LearnerNodeAvailabilityFacts {
                    has_answer_unlock: true,
                    ..facts()
                },
            ),
            LearnerNodeState::Available
        );
    }

    #[test]
    fn nested_rules_keep_their_source_and_or_meaning() {
        let config = LearnerNodeAvailabilityConfig::from_visual_config(&json!({
            "unlock": {
                "enabled": true,
                "rules": {
                    "type": "group",
                    "operator": "and",
                    "rules": [
                        { "type": "role_has", "roleSlug": "member" },
                        {
                            "type": "group",
                            "operator": "or",
                            "rules": [
                                { "type": "node_completed", "nodeId": "first-step" },
                                { "type": "item_owned", "itemId": "field-guide" }
                            ]
                        }
                    ]
                }
            }
        }));
        let mut opened = facts();
        opened.role_slugs.insert("member".to_owned());
        opened
            .completed_node_references
            .insert("first-step".to_owned());

        assert_eq!(
            learner_node_state(LearnerNodeState::Locked, &config, &opened),
            LearnerNodeState::Available
        );

        opened.completed_node_references.clear();
        assert_eq!(
            learner_node_state(LearnerNodeState::Locked, &config, &opened),
            LearnerNodeState::Locked
        );
    }

    #[test]
    fn legacy_rules_include_time_tool_role_item_and_completed_node_conditions() {
        let config = LearnerNodeAvailabilityConfig::from_visual_config(&json!({
            "unlock": {
                "enabled": true,
                "topOperator": "or",
                "requiredNodeIds": [12],
                "tool": { "enabled": true, "toolId": "magnifier" },
                "item": { "enabled": true, "itemId": "field-guide" },
                "roleSlug": "member"
            }
        }));
        let mut opened = facts();
        opened
            .owned_item_references
            .insert("field-guide".to_owned());

        assert_eq!(
            learner_node_state(LearnerNodeState::Locked, &config, &opened),
            LearnerNodeState::Available
        );

        assert_eq!(
            learner_node_state(LearnerNodeState::Locked, &config, &facts()),
            LearnerNodeState::Locked
        );
    }

    #[test]
    fn malformed_authored_rules_do_not_fall_back_to_permissive_legacy_state() {
        let config = LearnerNodeAvailabilityConfig::from_visual_config(&json!({
            "unlock": {
                "enabled": true,
                "rules": { "type": "not-a-source-rule" },
                "tool": { "enabled": true, "toolId": "magnifier" }
            }
        }));

        assert_eq!(
            learner_node_state(
                LearnerNodeState::Locked,
                &config,
                &LearnerNodeAvailabilityFacts {
                    has_tool_unlock: true,
                    ..facts()
                },
            ),
            LearnerNodeState::Locked
        );
    }

    #[test]
    fn a_future_unlock_schedule_is_still_a_requirement_not_a_tool_fallback() {
        let config = LearnerNodeAvailabilityConfig::from_visual_config(&json!({
            "unlock": { "enabled": true }
        }));

        assert_eq!(
            learner_node_state(
                LearnerNodeState::Locked,
                &config,
                &LearnerNodeAvailabilityFacts {
                    has_tool_unlock: true,
                    has_unlock_schedule: true,
                    is_unlocked_by_schedule: false,
                    ..facts()
                },
            ),
            LearnerNodeState::Locked
        );
    }

    #[test]
    fn an_empty_authored_rule_tree_uses_source_legacy_conditions() {
        let config = LearnerNodeAvailabilityConfig::from_visual_config(&json!({
            "unlock": {
                "enabled": true,
                "rules": [],
                "roleSlug": "member"
            }
        }));
        let mut opened = facts();
        opened.role_slugs.insert("member".to_owned());

        assert_eq!(
            learner_node_state(LearnerNodeState::Locked, &config, &opened),
            LearnerNodeState::Available
        );
    }

    #[test]
    fn schedule_facts_distinguish_configured_future_and_invalid_instants() {
        let now = datetime!(2026-11-05 12:00 UTC);
        let future = schedule_facts(
            &json!({
                "schedule": { "unlockAt": "2026-11-06T12:00:00Z" }
            }),
            now,
        );
        assert!(future.has_unlock_schedule);
        assert!(!future.is_unlocked_by_schedule);

        let active = schedule_facts(
            &json!({
                "schedule": {
                    "lockAt": "2026-11-05T11:59:59Z",
                    "unlockAt": "2026-11-05T11:59:59Z"
                }
            }),
            now,
        );
        assert!(active.is_locked_by_schedule);
        assert!(active.is_unlocked_by_schedule);

        assert_eq!(
            schedule_facts(
                &json!({ "schedule": { "unlockAt": "not-a-timestamp" } }),
                now,
            ),
            LearnerNodeAvailabilityFacts::default()
        );
    }
}
