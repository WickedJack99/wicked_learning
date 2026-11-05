use serde::Serialize;

use crate::world_content::{PublicMapAsset, PublicWorld};

/// A bounded, authenticated projection for the World screen. It deliberately
/// excludes activity configuration, answer history, play-run identifiers and
/// all mutation affordances.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerWorldSnapshot {
    pub world: PublicWorld,
    pub bookmarked_nodes: Vec<LearnerBookmark>,
    pub activity_progress: Vec<LearnerActivityProgress>,
    pub route_progress: Vec<LearnerRouteProgress>,
    pub available_routes: Vec<LearnerWorldRoute>,
    pub start_routes: Vec<LearnerActivityStart>,
}

/// A visible bookmarked node. A node slug is unique only within its map, so
/// both slugs are required for a stable browser presentation.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerBookmark {
    pub map_slug: String,
    pub node_slug: String,
}

/// The caller's visible bookmark set after one idempotent bookmark command.
/// This is a bounded presentation projection; the database continues to use
/// the principal/node relation as the ownership boundary.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerBookmarkResult {
    pub bookmarked: bool,
    pub bookmarked_nodes: Vec<LearnerBookmark>,
}

/// The source-defined personal map of places a learner chose to save. It uses
/// the first currently visible map only for presentation, while every place
/// keeps its own map context for the return link.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerBookmarkMap {
    pub background_config: serde_json::Value,
    pub grid_config: serde_json::Value,
    pub places: Vec<LearnerBookmarkPlace>,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerBookmarkPlace {
    pub asset: Option<PublicMapAsset>,
    pub description: String,
    pub map_slug: String,
    pub map_title: String,
    pub node_slug: String,
    pub state: String,
    pub title: String,
    pub visual_config: serde_json::Value,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerTopicDirectory {
    pub areas: Vec<LearnerTopicAreaOption>,
    pub pagination: LearnerTopicPagination,
    pub search: String,
    pub selected_area: Option<LearnerTopicArea>,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerTopicAreaOption {
    pub slug: String,
    pub title: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerTopicArea {
    pub description: Option<String>,
    pub slug: String,
    pub title: String,
    pub topics: Vec<LearnerTopicSummary>,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerTopicSummary {
    pub description: Option<String>,
    pub map_count: i64,
    pub slug: String,
    pub title: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerTopicPagination {
    pub current_page: i64,
    pub last_page: i64,
    pub per_page: i64,
    pub total: i64,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerActivityProgress {
    pub node_slug: String,
    pub activity_slug: String,
    pub status: String,
    pub completed_at: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerRouteProgress {
    pub start_id: String,
    pub node_slug: String,
    pub route_slug: String,
    pub current_activity_slug: Option<String>,
    pub status: String,
    pub completion_count: i32,
    pub last_completed_at: Option<String>,
    pub last_entered_at: Option<String>,
}

/// A route that is published within the learner's currently visible World.
/// It has no start command or play-run identifier; those remain a later,
/// stateful playback boundary.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerWorldRoute {
    pub node_slug: String,
    pub route_slug: String,
    pub title: String,
    pub description: String,
    pub activity_count: i64,
}

/// A server-authorized presentation of an activity start for the World drawer.
/// This is deliberately read-only: it does not grant a play run or authorize a
/// transition.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerActivityStart {
    pub start_id: String,
    pub node_slug: String,
    pub route_slug: String,
    pub activity_slug: String,
    pub label: String,
    pub description: Option<String>,
    pub image_dark: Option<String>,
    pub image_light: Option<String>,
    pub button_color_dark: Option<String>,
    pub button_border_color_dark: Option<String>,
    pub button_color_light: Option<String>,
    pub button_border_color_light: Option<String>,
    pub sort_order: i16,
    pub progress: Option<LearnerActivityStartProgress>,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerActivityStartProgress {
    pub current_activity_slug: Option<String>,
    pub status: String,
    pub completion_count: i32,
    pub last_completed_at: Option<String>,
    pub last_entered_at: Option<String>,
}

/// The only data a route-start command returns to the browser. The play-run ID
/// is generated and authorized by the server; the browser may only present it
/// back to a later playback endpoint.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerRouteRun {
    pub start_id: String,
    pub node_slug: String,
    pub route_slug: String,
    pub activity_slug: String,
    pub play_run_id: String,
    pub status: String,
    pub completion_count: i32,
    pub reset_count: i32,
}

/// A server-authorized snapshot of the current activity in an active play run.
/// The browser may render this document but cannot choose its activity or
/// authored completion transition.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerPlaybackDocument {
    pub start_id: String,
    pub play_run_id: String,
    pub context: LearnerPlaybackContext,
    pub activity: LearnerPlaybackActivity,
}

/// Read-only orientation data for an already-authorized play run. It is not
/// sufficient to start, resume, or navigate a run: those choices remain
/// server-owned commands.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerPlaybackContext {
    pub node_slug: String,
    pub node_title: String,
    pub map_slug: String,
    pub map_title: String,
    pub route_label: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerPlaybackActivity {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub activity_type: String,
    pub config: serde_json::Value,
    pub completion: LearnerPlaybackCompletion,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerPlaybackCompletion {
    pub label: Option<String>,
    pub next_activity_slug: Option<String>,
}

/// Result of completing the activity that is currently active in a play run.
/// `in_progress` means the server advanced to another authored activity; the
/// browser must fetch the same run again rather than choosing that activity.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerPlaybackCompletionResult {
    pub play_run_id: String,
    pub status: String,
}

/// A learner's evaluated attempt at the question currently authorized by a
/// play run. Choice keys are opaque authored identifiers; correctness and the
/// next transition are resolved by the server, never the browser.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerQuestionAnswerResult {
    pub play_run_id: String,
    pub activity_slug: String,
    pub selected_option_keys: Vec<String>,
    pub is_correct: bool,
    pub feedback: Option<String>,
    pub explanation: Option<String>,
    pub confidence: Option<String>,
    pub calibration: Option<String>,
    pub attempt_number: i32,
    pub next_transition_label: Option<String>,
}

/// A private reflection saved for the currently authorized activity. The
/// response intentionally contains no learner writing or journal metadata:
/// subsequent journal/review readers must be separately authorized.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerReflectionResult {
    pub play_run_id: String,
    pub activity_slug: String,
    pub status: String,
}

/// A bounded, learner-owned journal page. This deliberately has no editing,
/// feedback-request, export, or staff-review fields: those are separate
/// private capabilities with their own writer contracts.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerJournalDocument {
    pub pages: Vec<LearnerJournalPage>,
    pub pagination: LearnerJournalPagination,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerJournalPage {
    pub id: String,
    pub title: String,
    pub topic: String,
    pub subtopic: Option<String>,
    pub markdown: String,
    pub preferred_mode: String,
    pub reflection_count: i64,
    pub learning_context: Option<LearnerJournalLearningContext>,
    pub updated_at: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerJournalLearningContext {
    pub activity_title: Option<String>,
    pub map_slug: String,
    pub map_title: String,
    pub node_slug: String,
    pub node_title: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerJournalPagination {
    pub current_page: i64,
    pub last_page: i64,
    pub per_page: i64,
    pub total: i64,
}
