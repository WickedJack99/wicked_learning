use serde::Serialize;

use crate::world_content::{PublicMapAsset, PublicWorld};

/// A bounded, authenticated projection for the World screen. It deliberately
/// excludes activity configuration, answer history, play-run identifiers and
/// all mutation affordances.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerWorldSnapshot {
    pub world: PublicWorld,
    pub items: Vec<LearnerItem>,
    pub tools: Vec<LearnerTool>,
    pub bookmarked_nodes: Vec<LearnerBookmark>,
    pub activity_progress: Vec<LearnerActivityProgress>,
    pub route_progress: Vec<LearnerRouteProgress>,
    pub available_routes: Vec<LearnerWorldRoute>,
    pub start_routes: Vec<LearnerActivityStart>,
}

/// One learner-owned inventory item, bounded to presentation fields the
/// source action bar renders. Quantity remains server-owned.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerItem {
    pub config: serde_json::Value,
    pub description: Option<String>,
    pub image_dark: Option<String>,
    pub image_light: Option<String>,
    pub quantity: i32,
    pub slug: String,
    pub title: String,
}

/// One learner-owned tool. The slug is the public, authored reference; the
/// database UUID stays internal and is never accepted from the browser.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerTool {
    pub animation_dark: Option<String>,
    pub animation_light: Option<String>,
    pub config: serde_json::Value,
    pub description: Option<String>,
    pub image_dark: Option<String>,
    pub image_light: Option<String>,
    pub slug: String,
    pub title: String,
}

/// Result of claiming the single authored tool from an active tool-grant
/// activity. `already_owned` lets the source-derived player advance an
/// interrupted grant without creating a second ownership record.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerToolGrantResult {
    pub already_owned: bool,
    pub tool: LearnerTool,
}

/// The bounded result of using an owned tool on an accessible map node. The
/// browser can refresh its snapshot but cannot infer or alter policy itself.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerNodeToolResult {
    pub discovered: bool,
    pub is_unlocked: bool,
    pub is_useful: bool,
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
    pub href: String,
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

/// The shared source-defined orientation shown above every topic detail
/// section. It deliberately contains no learner evidence or route state.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerTopicDetailHeader {
    pub area_slug: String,
    pub area_title: String,
    pub content: Option<String>,
    pub description: Option<String>,
    pub parent: Option<LearnerTopicParent>,
    pub slug: String,
    pub title: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerTopicParent {
    pub href: String,
    pub slug: String,
    pub title: String,
}

/// The lazy Overview section from the source topic page.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerTopicOverview {
    pub subtopics: Vec<LearnerTopicSummary>,
    pub subtopics_pagination: LearnerTopicPagination,
    pub topic: LearnerTopicDetailHeader,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerTopicMapSummary {
    pub description: String,
    pub href: String,
    pub node_count: i64,
    pub slug: String,
    pub title: String,
}

/// The source-defined Paths read model. A path is offered from an authored
/// activity start, rather than from a generic route, so its learner progress
/// remains scoped to the location where it was offered.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerPaths {
    pub pagination: LearnerPathPagination,
    pub paths: Vec<LearnerPathSummary>,
    pub selected_purpose: Option<String>,
    pub selected_time_budget: Option<i16>,
    /// Present only when the paths reader is scoped to one published topic.
    /// The source topic-detail page retains this header while Routes is active.
    pub topic_context: Option<LearnerTopicDetailHeader>,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerPathPagination {
    pub current_page: i64,
    pub last_page: i64,
    pub per_page: i64,
    pub total: i64,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerPathSummary {
    pub activity_title: String,
    pub activity_type: String,
    pub description: String,
    pub image_url: Option<String>,
    pub label: String,
    pub learning_areas: Vec<LearnerPathLearningArea>,
    pub learning_intent: String,
    pub map_href: String,
    pub map_title: String,
    pub node_href: String,
    pub node_slug: String,
    pub node_title: String,
    pub progress: Option<LearnerPathProgress>,
    pub route_description: Option<String>,
    pub start_id: String,
    pub time_guide_minutes: Option<i16>,
    pub topic: Option<LearnerPathTopic>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct LearnerPathLearningArea {
    pub name: String,
    pub slug: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerPathProgress {
    pub current_activity_title: Option<String>,
    pub last_entered_at: Option<String>,
    pub status: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerPathTopic {
    pub href: String,
    pub slug: String,
    pub title: String,
}

/// The lazy Maps section from the source topic page.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerTopicMaps {
    pub maps: Vec<LearnerTopicMapSummary>,
    pub maps_pagination: LearnerTopicPagination,
    pub topic: LearnerTopicDetailHeader,
}

/// The private Trail section of the source topic detail. It is deliberately a
/// single server-side read model: React must not join evidence, check-ins,
/// reflections and current map visibility itself.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerTopicTrail {
    pub competence: Option<LearnerTopicTrailCompetence>,
    pub learning_areas: Vec<LearnerTopicLearningArea>,
    pub learning_pulse: Vec<LearnerTopicLearningPulse>,
    pub reflection_narrative: Option<LearnerTopicReflectionNarrative>,
    pub subtopic_competence: Vec<LearnerTopicTrailCompetence>,
    pub topic: LearnerTopicDetailHeader,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerTopicTrailCompetence {
    pub name: String,
    pub slug: String,
    pub visual: LearnerCompetenceVisual,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerTopicLearningArea {
    pub learning_intents: Vec<String>,
    pub name: String,
    pub slug: String,
}

/// A bounded current-learner check-in projected only when the corresponding
/// published map remains visible. It deliberately does not authorize replay.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerTopicLearningPulse {
    pub activity_title: String,
    pub feeling: Option<String>,
    pub node_title: String,
    pub note: Option<String>,
    pub recorded_at: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerTopicReflectionNarrative {
    pub earlier: LearnerTopicReflectionSnapshot,
    pub entries: Vec<LearnerTopicReflectionSnapshot>,
    pub later: LearnerTopicReflectionSnapshot,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerTopicReflectionSnapshot {
    pub activity_title: Option<String>,
    pub created_at: String,
    pub id: String,
    pub question: String,
    pub reflection: String,
}

/// A private, qualitative reading of evidence the current learner accumulated
/// through authorized activity runs. Ratios support the source star-map
/// presentation; they are not a score, rank or progression total.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerCompetenceMap {
    pub month_key: String,
    pub recent_window_days: i16,
    pub topics: Vec<LearnerCompetenceTopic>,
    pub transitions: Vec<LearnerCompetenceTransition>,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerCompetenceTopic {
    pub name: String,
    pub slug: String,
    pub visual: LearnerCompetenceVisual,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerCompetenceVisual {
    pub aura_ratio: f64,
    pub brightness_ratio: f64,
    pub description: String,
    pub evidence_ledger: Vec<LearnerCompetenceEvidence>,
    pub evidence_types: Vec<String>,
    pub learning_periods: Vec<String>,
    pub recent_description: String,
    pub size_ratio: f64,
    pub size_tier: String,
}

/// A bounded, inspectable evidence description. It intentionally omits
/// private reflection text and any hidden server-side metadata.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerCompetenceEvidence {
    pub activity_title: String,
    pub assistance_level: Option<String>,
    pub attempt_number: i32,
    pub concepts: Vec<String>,
    pub confidence: Option<String>,
    pub confidence_after_feedback: Option<String>,
    pub evidence_claim: String,
    pub evidence_criterion: Option<String>,
    pub evidence_rubric: Vec<String>,
    pub evidence_type: String,
    pub id: String,
    pub independent_check: bool,
    pub learning_purpose: Option<String>,
    pub node_title: Option<String>,
    pub objective: Option<String>,
    pub observed_cues: Vec<String>,
    pub outcome: String,
    pub recorded_at: String,
    pub sources: Vec<LearnerCompetenceSource>,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerCompetenceSource {
    pub anchor: Option<String>,
    pub concepts: Vec<String>,
    pub excerpt: Option<String>,
    pub published_at: Option<String>,
    pub publisher: Option<String>,
    pub rights: Option<String>,
    pub title: String,
    pub url: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerCompetenceTransition {
    pub count: i32,
    pub from_topic_name: String,
    pub from_topic_slug: String,
    pub to_topic_name: String,
    pub to_topic_slug: String,
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
    /// An authored route start owns ordinary route runs. A private revisit has
    /// no start because it must not be mistaken for a route reset.
    pub start_id: Option<String>,
    pub play_run_id: String,
    pub run_kind: LearnerPlaybackRunKind,
    pub context: LearnerPlaybackContext,
    pub activity: LearnerPlaybackActivity,
}

/// Playback ownership determines which transaction is allowed to complete the
/// activity. It is server-resolved; a browser never chooses this value.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum LearnerPlaybackRunKind {
    Route,
    Revisit,
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
    /// The source player shows a route only when the current run was started
    /// from an authored route start.
    pub route_label: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerPlaybackActivity {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub activity_type: String,
    pub config: serde_json::Value,
    pub completion: LearnerPlaybackCompletion,
    /// Source-defined, bounded context for the optional conclusion check-in.
    /// Recording a check-in remains bound to the completed server-owned run.
    pub check_in: LearnerPlaybackCheckIn,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerPlaybackCompletion {
    pub label: Option<String>,
    pub next_activity_slug: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerPlaybackCheckIn {
    pub choice_prompt: Option<String>,
    pub concepts: Vec<String>,
    pub learning_areas: Vec<LearnerPlaybackLearningArea>,
    pub objective: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct LearnerPlaybackLearningArea {
    pub name: String,
    pub slug: String,
}

/// Result of completing the activity that is currently active in a play run.
/// `in_progress` means the server advanced to another authored activity; the
/// browser must fetch the same run again rather than choosing that activity.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerPlaybackCompletionResult {
    pub play_run_id: String,
    pub status: String,
}

/// A private, source-defined observation a learner chooses after completing an
/// activity. The browser cannot choose the activity or its ownership; those
/// come from the authorized play run.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerActivityCheckInResult {
    pub activity_slug: String,
    pub feeling: Option<String>,
    pub id: String,
    pub next_direction: Option<String>,
    pub note: Option<String>,
    pub recorded_at: String,
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
    /// The question command resolves progression before responding, so React
    /// uses this server-owned result after the optional conclusion check-in.
    pub status: String,
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
    pub check_ins: Vec<LearnerJournalCheckIn>,
    pub pages: Vec<LearnerJournalPage>,
    pub pagination: LearnerJournalPagination,
    pub revisit_invitations: Vec<LearnerRevisitInvitation>,
}

/// A bounded, private observation shown in the source journal's learning
/// trail. It contains orientation only; re-entering an activity remains a
/// separate server-authorized command.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerJournalCheckIn {
    pub activity_slug: String,
    pub activity_title: String,
    pub feeling: Option<String>,
    pub id: String,
    pub map_slug: String,
    pub map_title: String,
    pub next_direction: Option<String>,
    pub node_slug: String,
    pub node_title: String,
    pub note: Option<String>,
    pub recorded_at: String,
}

/// A learner-selected return that is ready to act on. The read model does not
/// itself authorize re-entry; a later command must create a server-owned run.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerRevisitInvitation {
    pub activity_slug: String,
    pub activity_title: String,
    pub available_after_days: i16,
    pub available_at: String,
    pub available_since: String,
    pub check_in_id: String,
    pub map_slug: String,
    pub map_title: String,
    pub node_slug: String,
    pub node_title: String,
    pub revisit_reason: String,
}

/// The private invitation state after a learner chooses to defer or hide a
/// due return. Re-entry is intentionally a separate, server-owned operation.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerRevisitInvitationActionResult {
    pub check_in_id: String,
    pub revisit_status: String,
    pub available_at: Option<String>,
}

/// The minimal server-authorized result for reopening a due private revisit.
/// It is deliberately separate from an authored route run: the invited
/// activity may not be an activity start and must not overwrite route progress.
#[derive(Clone, Debug, Serialize)]
pub struct LearnerRevisitRun {
    pub activity_slug: String,
    pub node_slug: String,
    pub play_run_id: String,
    pub status: String,
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
