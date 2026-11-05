use serde::Serialize;

use crate::world_content::PublicWorld;

/// A bounded, authenticated projection for the World screen. It deliberately
/// excludes activity configuration, answer history, play-run identifiers and
/// all mutation affordances.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerWorldSnapshot {
    pub world: PublicWorld,
    pub bookmarked_node_slugs: Vec<String>,
    pub activity_progress: Vec<LearnerActivityProgress>,
    pub route_progress: Vec<LearnerRouteProgress>,
    pub available_routes: Vec<LearnerWorldRoute>,
    pub start_routes: Vec<LearnerActivityStart>,
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
    pub activity: LearnerPlaybackActivity,
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
