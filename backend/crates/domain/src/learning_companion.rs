use serde::Serialize;
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
