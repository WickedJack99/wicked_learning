use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct LearningCompanionAiTemplateOption {
    pub enabled: bool,
    pub id: Uuid,
    pub name: String,
}

/// Safe administrative configuration for the platform-level companion. The
/// learner-facing resolver and dialogue runtime remain separate boundaries.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct LearningCompanionSettings {
    pub ai_capabilities: Vec<String>,
    pub ai_enabled: bool,
    pub ai_template_id: Option<Uuid>,
    pub ai_template_options: Vec<LearningCompanionAiTemplateOption>,
    pub avatar_color: String,
    pub avatar_position_x: i16,
    pub avatar_position_y: i16,
    pub avatar_scale: i16,
    pub avatar_url: Option<String>,
    pub display_name: String,
    pub enabled: bool,
    pub mode: String,
    pub welcome_message: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct LearningCompanionDialogueSummary {
    pub assignments_count: i64,
    pub id: Uuid,
    pub name: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct LearningCompanionDialogue {
    pub assignments_count: i64,
    pub dialogue_graph: Value,
    pub id: Uuid,
    pub name: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct LearningCompanionAssignment {
    pub scope_id: Uuid,
    pub scope_type: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct LearningCompanionAssignmentTarget {
    pub context: String,
    pub label: String,
    pub scope_id: Uuid,
    pub scope_type: String,
    pub selected: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct LearningCompanionPagination {
    pub current_page: i64,
    pub last_page: i64,
    pub per_page: i64,
    pub total: i64,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct LearningCompanionDialoguePage {
    pub items: Vec<LearningCompanionDialogueSummary>,
    pub pagination: LearningCompanionPagination,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct LearningCompanionAssignmentPage {
    pub items: Vec<LearningCompanionAssignmentTarget>,
    pub pagination: LearningCompanionPagination,
    pub selected: Vec<LearningCompanionAssignment>,
}

/// A bounded learner-facing reference. UUIDs remain opaque identifiers and are
/// emitted only after the enclosing map/activity visibility check succeeds.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct LearnerCompanionReference {
    pub id: Uuid,
    pub title: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct LearnerCompanionAction {
    pub href: String,
    pub key: String,
    pub label: String,
    pub reason: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct LearnerCompanionConfiguration {
    pub ai_enabled: bool,
    pub mode: String,
    pub source_scope: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct LearnerCompanionContext {
    pub actions: Vec<LearnerCompanionAction>,
    pub activity: Option<LearnerCompanionReference>,
    pub map: Option<LearnerCompanionReference>,
    pub node: Option<LearnerCompanionReference>,
    pub play_run_id: Option<String>,
    pub post_attempt_available: bool,
    pub route: Option<LearnerCompanionReference>,
    pub surface: String,
    pub topic: Option<LearnerCompanionReference>,
    pub world: Option<LearnerCompanionReference>,
}

/// The source-shaped deterministic companion projection. It deliberately
/// excludes AI-template identity, credentials, learner answers and any write
/// action; a provider turn is a separate guarded command.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct LearnerCompanion {
    pub avatar_color: String,
    pub avatar_position_x: i16,
    pub avatar_position_y: i16,
    pub avatar_scale: i16,
    pub avatar_url: Option<String>,
    pub configuration: LearnerCompanionConfiguration,
    pub context: LearnerCompanionContext,
    pub dialogue: Option<Value>,
    pub display_name: String,
    pub message: String,
}
