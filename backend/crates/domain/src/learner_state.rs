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
