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
