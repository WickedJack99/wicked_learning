use crate::learner_state::{LearnerItem, LearnerJournalTheme, LearnerTool};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

#[derive(Clone, Debug, Serialize)]
pub struct LearnerMenuTheme {
    pub map_id: Uuid,
    pub map_slug: String,
    pub background_config: Value,
}

/// Shell-specific reads contain no private Journal pages or playback payloads.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerShell {
    pub items: Vec<LearnerItem>,
    pub tools: Vec<LearnerTool>,
    pub journal_theme: LearnerJournalTheme,
    pub menu_theme: Option<LearnerMenuTheme>,
}
