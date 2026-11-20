use std::collections::{HashMap, HashSet};

use serde_json::Value;
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearnerPlaybackGraph, LearnerPlaybackGraphActivity, LearnerPlaybackGraphStart,
        LearnerPlaybackGraphStartProgress, LearnerPlaybackGraphTransition,
    },
};

use crate::{
    learner_media::{learner_media_config, learner_media_url},
    learner_node_availability::PostgresLearnerNodeAvailability,
    learner_paths::time_guide_minutes,
    learner_playback::{check_in_context, learner_safe_config, with_safe_ambient_sound},
    learner_route_run::ROUTE_START_ACTIVITY_TYPES,
};

const MAX_ACTIVITIES: usize = 1000;
const MAX_TRANSITIONS: usize = 4000;
const MAX_STARTS: usize = 1000;

use crate::learner_playback_node::NodeRow;

#[derive(FromRow)]
struct ActivityRow {
    id: Uuid,
    slug: String,
    title: String,
    introduction: Option<String>,
    activity_type: String,
    activity_config: Value,
}

#[derive(FromRow)]
struct TransitionRow {
    id: Uuid,
    from_activity_id: Uuid,
    to_activity_id: Option<Uuid>,
    from_connector: String,
    to_connector: Option<String>,
    trigger: String,
    trigger_value: Option<String>,
    label: Option<String>,
}

#[derive(FromRow)]
struct StartRow {
    id: Uuid,
    activity_id: Uuid,
    label: String,
    description: Option<String>,
    image_dark: Option<String>,
    image_light: Option<String>,
    button_color_dark: Option<String>,
    button_border_color_dark: Option<String>,
    button_color_light: Option<String>,
    button_border_color_light: Option<String>,
    sort_order: i16,
    current_activity_id: Option<Uuid>,
    play_run_id: Option<Uuid>,
    status: Option<String>,
    completion_count: Option<i32>,
    last_completed_at: Option<String>,
    last_entered_at: Option<String>,
}

/// Four bounded reads for the whole node, not one query per activity or edge.
/// The caller already authorized the run; this boundary rechecks the source's
/// current node visibility/playability before exposing the published graph.
pub(crate) async fn load(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    availability: &PostgresLearnerNodeAvailability,
    node_id: Uuid,
    map_id: Uuid,
    active_activity_id: Uuid,
) -> Result<
    Option<(
        LearnerPlaybackGraph,
        wicked_learning_domain::learner_state::LearnerPlaybackNode,
    )>,
    sqlx::Error,
> {
    let node = sqlx::query_as::<_, NodeRow>(
        "SELECT nodes.id, nodes.map_id, maps.slug AS map_slug, maps.title AS map_title, nodes.slug, nodes.title, nodes.description, nodes.position_q AS q, nodes.position_r AS r, topics.slug AS topic_slug, topics.title AS topic_title, EXISTS(SELECT 1 FROM learner_node_bookmarks b WHERE b.principal_id=$4 AND b.node_id=nodes.id) AS is_bookmarked, nodes.map_asset_id, nodes.start_activity_id, nodes.state, nodes.visual_config \
         FROM learning_nodes AS nodes \
         INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id \
         INNER JOIN learning_map_assets AS assets ON assets.id = nodes.map_asset_id AND assets.map_id = maps.id \
         LEFT JOIN learning_topics AS topics ON topics.id=maps.topic_id AND topics.published_at IS NOT NULL \
         WHERE nodes.id = $1 AND maps.id = $2 AND nodes.published_at IS NOT NULL \
         AND maps.published_at IS NOT NULL AND assets.published_at IS NOT NULL \
         AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS \
           (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($3)))",
    )
    .bind(node_id)
    .bind(map_id)
    .bind(&principal.roles)
    .bind(availability.principal_id())
    .fetch_optional(&mut **transaction)
    .await?;
    let Some(node) = node else { return Ok(None) };
    if !availability
        .state_for_node(node_id, &node.state, &node.visual_config)
        .can_play()
    {
        return Ok(None);
    }
    let rows = sqlx::query_as::<_, ActivityRow>(
        "SELECT activities.id, activities.slug, activities.title, activities.introduction, activities.activity_type, activities.activity_config \
         FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id \
         WHERE routes.map_asset_id = $1 AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL \
         ORDER BY routes.position, activities.position, activities.slug, activities.id LIMIT $2",
    )
    .bind(node.map_asset_id)
    .bind((MAX_ACTIVITIES + 1) as i64)
    .fetch_all(&mut **transaction)
    .await?;
    if rows.len() > MAX_ACTIVITIES {
        return Err(incomplete_graph());
    }
    let ids: Vec<_> = rows.iter().map(|row| row.id).collect();
    if !ids.contains(&active_activity_id) {
        return Ok(None);
    }
    let transitions = sqlx::query_as::<_, TransitionRow>(
        "SELECT id, from_activity_id, to_activity_id, from_connector, to_connector, trigger, trigger_value, label \
         FROM learning_activity_transitions WHERE from_activity_id = ANY($1) \
         ORDER BY created_at, id LIMIT $2",
    )
    .bind(&ids)
    .bind((MAX_TRANSITIONS + 1) as i64)
    .fetch_all(&mut **transaction)
    .await?;
    let starts = sqlx::query_as::<_, StartRow>(
        "SELECT starts.id, starts.activity_id, COALESCE(starts.label, activities.title) AS label, starts.description, \
         starts.image_dark, starts.image_light, starts.button_color_dark, starts.button_border_color_dark, \
         starts.button_color_light, starts.button_border_color_light, starts.sort_order, \
         progress.current_activity_id, progress.current_play_run_id AS play_run_id, progress.status, progress.completion_count, \
         to_char(progress.last_completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS last_completed_at, \
         to_char(progress.last_entered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS last_entered_at \
         FROM learning_activity_starts AS starts INNER JOIN learning_activities AS activities ON activities.id = starts.activity_id \
         LEFT JOIN learner_route_progress AS progress ON progress.activity_start_id = starts.id AND progress.principal_id = $3 \
         WHERE starts.node_id = $1 AND starts.activity_id = ANY($2) ORDER BY starts.sort_order, starts.id LIMIT $4",
    )
    .bind(node_id)
    .bind(&ids)
    .bind(availability.principal_id())
    .bind((MAX_STARTS + 1) as i64)
    .fetch_all(&mut **transaction)
    .await?;
    let configs = rows
        .iter()
        .map(|row| (row.id, row.activity_config.clone()))
        .collect();
    let mut graph = assemble(node_id, node.start_activity_id, rows, transitions, starts)?;
    crate::learner_playback_presentation::enrich(transaction, &mut graph, &configs).await?;
    let node =
        crate::learner_playback_node::project(transaction, principal, availability, node, &graph)
            .await?;
    Ok(Some((graph, node)))
}

fn assemble(
    node_id: Uuid,
    preferred: Option<Uuid>,
    rows: Vec<ActivityRow>,
    transitions: Vec<TransitionRow>,
    starts: Vec<StartRow>,
) -> Result<LearnerPlaybackGraph, sqlx::Error> {
    if rows.len() > MAX_ACTIVITIES
        || transitions.len() > MAX_TRANSITIONS
        || starts.len() > MAX_STARTS
    {
        return Err(incomplete_graph());
    }
    let ids: HashSet<_> = rows.iter().map(|row| row.id).collect();
    let eligible: HashSet<_> = rows
        .iter()
        .filter(|row| {
            ROUTE_START_ACTIVITY_TYPES.contains(&row.activity_type.as_str())
                && !(row.activity_type == "portal"
                    && row
                        .activity_config
                        .get("portalMode")
                        .and_then(Value::as_str)
                        == Some("input"))
        })
        .map(|row| row.id)
        .collect();
    let mut edges: HashMap<Uuid, Vec<LearnerPlaybackGraphTransition>> = HashMap::new();
    for edge in transitions {
        // Never drop a published activity's broken edge and thereby invent an
        // end-of-route. The author must repair an unavailable destination.
        if !ids.contains(&edge.from_activity_id)
            || edge.to_activity_id.is_some_and(|id| !ids.contains(&id))
        {
            return Err(incomplete_graph());
        }
        edges
            .entry(edge.from_activity_id)
            .or_default()
            .push(LearnerPlaybackGraphTransition {
                id: edge.id,
                to_activity_id: edge.to_activity_id,
                from_connector: edge.from_connector,
                to_connector: edge.to_connector.unwrap_or_else(|| "in".into()),
                trigger: edge.trigger,
                trigger_value: edge.trigger_value,
                label: edge.label,
            });
    }
    let activities = rows
        .into_iter()
        .map(|row| {
            let check_in = check_in_context(&row.activity_config);
            let time_guide_minutes = time_guide_minutes(&row.activity_config);
            let config = learner_safe_config(&row.activity_type, row.activity_config.clone())
                .ok_or_else(incomplete_graph)?;
            let config =
                learner_media_config(with_safe_ambient_sound(config, &row.activity_config));
            let presentation = crate::learner_playback_presentation::metadata(
                row.id,
                &row.activity_type,
                &row.activity_config,
            )?;
            Ok(LearnerPlaybackGraphActivity {
                presentation,
                id: row.id,
                slug: row.slug,
                title: row.title,
                introduction: row.introduction,
                activity_type: row.activity_type,
                config,
                time_guide_minutes,
                check_in,
                transitions: edges.remove(&row.id).unwrap_or_default(),
            })
        })
        .collect::<Result<Vec<_>, sqlx::Error>>()?;
    let starts = starts
        .into_iter()
        .filter(|start| eligible.contains(&start.activity_id))
        .map(|start| {
            let progress = start
                .status
                .map(|status| LearnerPlaybackGraphStartProgress {
                    current_activity_id: start.current_activity_id.filter(|id| ids.contains(id)),
                    play_run_id: start.play_run_id,
                    status,
                    completion_count: start.completion_count.unwrap_or_default(),
                    last_completed_at: start.last_completed_at,
                    last_entered_at: start.last_entered_at,
                });
            LearnerPlaybackGraphStart {
                id: start.id,
                activity_id: start.activity_id,
                label: start.label,
                description: start.description,
                image_dark: start.image_dark.map(|url| learner_media_url(&url)),
                image_light: start.image_light.map(|url| learner_media_url(&url)),
                button_color_dark: start.button_color_dark,
                button_border_color_dark: start.button_border_color_dark,
                button_color_light: start.button_color_light,
                button_border_color_light: start.button_border_color_light,
                sort_order: start.sort_order,
                progress,
            }
        })
        .collect();
    Ok(LearnerPlaybackGraph {
        node_id,
        start_activity_id: preferred.filter(|id| eligible.contains(id)),
        activities,
        starts,
    })
}

fn incomplete_graph() -> sqlx::Error {
    sqlx::Error::Protocol("The published playback graph is incomplete or exceeds its bound".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn activity(id: Uuid, kind: &str, config: Value) -> ActivityRow {
        ActivityRow {
            id,
            slug: "same-slug".into(),
            title: "Source activity".into(),
            introduction: Some("Source introduction".into()),
            activity_type: kind.into(),
            activity_config: config,
        }
    }
    fn edge(from: Uuid, to: Option<Uuid>, connector: &str) -> TransitionRow {
        TransitionRow {
            id: Uuid::new_v4(),
            from_activity_id: from,
            to_activity_id: to,
            from_connector: connector.into(),
            to_connector: None,
            trigger: "completed".into(),
            trigger_value: None,
            label: Some("Source label".into()),
        }
    }
    fn start(id: Uuid) -> StartRow {
        StartRow {
            id: Uuid::new_v4(),
            activity_id: id,
            label: "Source start".into(),
            description: None,
            image_dark: None,
            image_light: None,
            button_color_dark: None,
            button_border_color_dark: None,
            button_color_light: None,
            button_border_color_light: None,
            sort_order: 0,
            current_activity_id: None,
            play_run_id: None,
            status: None,
            completion_count: None,
            last_completed_at: None,
            last_entered_at: None,
        }
    }

    #[test]
    fn preserves_same_slug_identities_parallel_cycles_and_authored_terminal_edges() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let edges = vec![
            edge(a, Some(a), "retry"),
            edge(a, Some(b), "completed"),
            edge(a, Some(b), "choice"),
            edge(b, None, "completed"),
        ];
        let edge_ids: Vec<_> = edges.iter().map(|edge| edge.id).collect();
        let graph = assemble(
            Uuid::new_v4(),
            Some(b),
            vec![
                activity(a, "open_practice", json!({})),
                activity(b, "open_practice", json!({})),
            ],
            edges,
            vec![start(a), start(b)],
        )
        .unwrap();
        assert_eq!(graph.start_activity_id, Some(b));
        assert_eq!(graph.activities.len(), 2);
        assert_eq!(
            graph.activities[0].introduction.as_deref(),
            Some("Source introduction")
        );
        assert_eq!(
            graph.activities[0]
                .transitions
                .iter()
                .map(|edge| edge.id)
                .collect::<Vec<_>>(),
            edge_ids[..3]
        );
        assert_eq!(graph.activities[0].transitions[0].to_activity_id, Some(a));
        assert_eq!(graph.activities[0].transitions[1].to_connector, "in");
        assert_eq!(graph.activities[1].transitions[0].to_activity_id, None);
        assert_eq!(graph.starts.len(), 2);
    }

    #[test]
    fn refuses_missing_targets_and_unsupported_configuration_without_inventing_a_terminal() {
        let a = Uuid::new_v4();
        assert!(
            assemble(
                Uuid::new_v4(),
                None,
                vec![activity(a, "open_practice", json!({}))],
                vec![edge(a, Some(Uuid::new_v4()), "completed")],
                vec![]
            )
            .is_err()
        );
        for (kind, config) in [
            ("unknown", json!({})),
            ("question", json!({"prompt":"Missing options"})),
        ] {
            assert!(
                assemble(
                    Uuid::new_v4(),
                    None,
                    vec![activity(a, kind, config)],
                    vec![],
                    vec![]
                )
                .is_err()
            );
        }
    }

    #[test]
    fn removes_question_correctness_and_keeps_input_portals_out_of_starts() {
        let a = Uuid::new_v4();
        let portal = Uuid::new_v4();
        let graph = assemble(Uuid::new_v4(), Some(portal), vec![
            activity(a,"question",json!({"prompt":"Choose","allowMultiple":false,"timeGuideMinutes":7,"evidenceObjective":"Notice","options":[{"key":"a","label":"A","body":"Choice","isCorrect":true}],"feedbackCorrect":"Private until answered"})),
            activity(portal,"portal",json!({"portalMode":"input"})),
        ],vec![],vec![start(a),start(portal)]).unwrap();
        assert_eq!(graph.start_activity_id, None);
        assert_eq!(graph.starts.len(), 1);
        assert_eq!(graph.starts[0].activity_id, a);
        assert_eq!(graph.activities[0].time_guide_minutes, Some(7));
        assert_eq!(
            graph.activities[0].check_in.objective.as_deref(),
            Some("Notice")
        );
        let serialized = serde_json::to_string(&graph).unwrap();
        assert!(!serialized.contains("isCorrect"));
        assert!(!serialized.contains("Private until answered"));
    }

    #[test]
    fn bounds_each_collection_without_silently_truncating_it() {
        let a = Uuid::new_v4();
        assert!(
            assemble(
                a,
                None,
                (0..=MAX_ACTIVITIES)
                    .map(|_| activity(Uuid::new_v4(), "open_practice", json!({})))
                    .collect(),
                vec![],
                vec![]
            )
            .is_err()
        );
        assert!(
            assemble(
                a,
                None,
                vec![activity(a, "open_practice", json!({}))],
                (0..=MAX_TRANSITIONS)
                    .map(|_| edge(a, None, "completed"))
                    .collect(),
                vec![]
            )
            .is_err()
        );
        assert!(
            assemble(
                a,
                None,
                vec![activity(a, "open_practice", json!({}))],
                vec![],
                (0..=MAX_STARTS).map(|_| start(a)).collect()
            )
            .is_err()
        );
    }
}
