use std::collections::{HashMap, HashSet};

use serde_json::{Value, json};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_availability::{LearnerNodeAvailabilityConfig, LearnerNodeState, UnlockRule},
    learner_availability_presentation::{
        AvailabilityLabels, visual_config as evaluated_visual_config,
    },
    learner_state::{LearnerPlaybackGraph, LearnerPlaybackNode, LearnerPlaybackPortalLink},
    world_content::PublicMapTopic,
};

use crate::{
    learner_node_availability::{PostgresLearnerNodeAvailability, authored_node_state},
    learner_world::{collect_catalog_references, load_catalog_labels},
    public_world::{interaction_sound_ids, learner_node_visual_config},
};

#[derive(FromRow)]
pub(crate) struct NodeRow {
    pub id: Uuid,
    pub map_id: Uuid,
    pub map_slug: String,
    pub map_title: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub q: i32,
    pub r: i32,
    pub topic_slug: Option<String>,
    pub topic_title: Option<String>,
    pub is_bookmarked: bool,
    pub map_asset_id: Uuid,
    pub start_activity_id: Option<Uuid>,
    pub state: String,
    pub visual_config: Value,
}
#[derive(FromRow)]
struct PortalRow {
    source_activity_id: Uuid,
    target_activity_id: Uuid,
    label: Option<String>,
    description: Option<String>,
    target_map_id: Uuid,
    target_map_slug: String,
    target_map_title: String,
    target_node_id: Uuid,
    target_node_slug: String,
    target_node_title: String,
    target_node_state: String,
    target_node_visual_config: Value,
}
#[derive(FromRow)]
struct NodeLabelRow {
    id: Uuid,
    map_slug: String,
    slug: String,
    title: String,
}

fn unavailable() -> sqlx::Error {
    sqlx::Error::Protocol("incomplete playback node presentation".into())
}

/// The graph loader has authorized this exact node and its published activities.
/// Resolve only its dependencies, never the unrelated first explorer World.
pub(crate) async fn project(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    availability: &PostgresLearnerNodeAvailability,
    node: NodeRow,
    graph: &LearnerPlaybackGraph,
) -> Result<LearnerPlaybackNode, sqlx::Error> {
    let mut labels = AvailabilityLabels::default();
    let mut tools = HashSet::new();
    let mut items = HashSet::new();
    let mut roles = HashSet::new();
    collect_catalog_references(
        &node.state,
        &node.visual_config,
        &mut tools,
        &mut items,
        &mut roles,
    );
    load_catalog_labels(&mut *transaction, &mut labels, tools, items, roles).await?;
    let config = LearnerNodeAvailabilityConfig::from_visual_config(&node.visual_config);
    let mut references = config
        .unlock
        .legacy_node_references
        .iter()
        .filter_map(|id| Uuid::parse_str(id).ok())
        .collect::<HashSet<_>>();
    if let Some(Some(rule)) = &config.unlock.authored_rule {
        collect_node_references(rule, &mut references);
    }
    if references.len() > 1000 {
        return Err(unavailable());
    }
    if !references.is_empty() {
        let rows=sqlx::query_as::<_,NodeLabelRow>(
            "SELECT nodes.id,maps.slug AS map_slug,nodes.slug,nodes.title FROM learning_nodes nodes INNER JOIN learning_maps maps ON maps.id=nodes.map_id WHERE nodes.id=ANY($1) AND nodes.published_at IS NOT NULL AND maps.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) role(value) WHERE role.value=ANY($2)))")
            .bind(references.into_iter().collect::<Vec<_>>()).bind(&principal.roles).fetch_all(&mut **transaction).await?;
        labels.nodes = rows
            .into_iter()
            .map(|n| {
                (
                    n.id.to_string(),
                    json!({"mapSlug":n.map_slug,"nodeSlug":n.slug,"nodeTitle":n.title}),
                )
            })
            .collect();
    }
    let sound_ids = interaction_sound_ids(&node.visual_config)
        .into_iter()
        .collect::<HashSet<_>>();
    if sound_ids.len() > 1000 {
        return Err(unavailable());
    }
    let sounds: HashMap<Uuid, String> = if sound_ids.is_empty() {
        HashMap::new()
    } else {
        sqlx::query_as::<_, (Uuid, String)>(
            "SELECT id,url FROM learning_sounds WHERE id=ANY($1) AND published_at IS NOT NULL",
        )
        .bind(sound_ids.into_iter().collect::<Vec<_>>())
        .fetch_all(&mut **transaction)
        .await?
        .into_iter()
        .collect()
    };
    let state = availability.state_for_node(node.id, &node.state, &node.visual_config);
    let visual = evaluated_visual_config(
        authored_node_state(&node.state),
        state,
        &node.visual_config,
        &availability.facts_for_node(node.id, &node.visual_config),
        &labels,
    );
    let portals = graph
        .activities
        .iter()
        .filter(|a| {
            a.activity_type == "portal"
                && a.config
                    .get("portalMode")
                    .and_then(Value::as_str)
                    .unwrap_or("output")
                    == "output"
        })
        .map(|a| a.id)
        .collect::<Vec<_>>();
    let links = if portals.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_,PortalRow>(
            "SELECT links.source_activity_id,links.target_activity_id,links.label,links.description,maps.id AS target_map_id,maps.slug AS target_map_slug,maps.title AS target_map_title,nodes.id AS target_node_id,nodes.slug AS target_node_slug,nodes.title AS target_node_title,nodes.state AS target_node_state,nodes.visual_config AS target_node_visual_config FROM learning_portal_links links INNER JOIN learning_activities target ON target.id=links.target_activity_id INNER JOIN learning_routes routes ON routes.id=target.route_id INNER JOIN learning_map_assets assets ON assets.id=routes.map_asset_id INNER JOIN learning_nodes nodes ON nodes.id=links.target_node_id AND nodes.map_asset_id=assets.id INNER JOIN learning_maps maps ON maps.id=nodes.map_id AND maps.id=assets.map_id WHERE links.source_node_id=$1 AND links.source_activity_id=ANY($2) AND target.activity_type='portal' AND COALESCE(target.activity_config->>'portalMode','output')='input' AND target.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND maps.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) role(value) WHERE role.value=ANY($3))) ORDER BY links.created_at,links.source_activity_id LIMIT 1001")
            .bind(node.id).bind(&portals).bind(&principal.roles).fetch_all(&mut **transaction).await?
    };
    if links.len() > 1000 {
        return Err(unavailable());
    }
    let outgoing_portal_links = links
        .into_iter()
        .map(|link| {
            let state = availability.state_for_node(
                link.target_node_id,
                &link.target_node_state,
                &link.target_node_visual_config,
            );
            LearnerPlaybackPortalLink {
                id: link.source_activity_id,
                source_activity_id: link.source_activity_id,
                target_activity_id: link.target_activity_id,
                label: link.label,
                description: link.description,
                target_map_id: link.target_map_id,
                target_map_slug: link.target_map_slug,
                target_map_title: link.target_map_title,
                target_node_id: link.target_node_id,
                target_node_slug: link.target_node_slug,
                target_node_title: link.target_node_title,
                target_node_state: presented_state(&link.target_node_state, state),
            }
        })
        .collect();
    Ok(LearnerPlaybackNode {
        id: node.id,
        map_id: node.map_id,
        map_slug: node.map_slug,
        map_title: node.map_title,
        slug: node.slug,
        title: node.title,
        description: node.description,
        q: node.q,
        r: node.r,
        state: presented_state(&node.state, state),
        visual_config: learner_node_visual_config(visual, &sounds),
        topic: node
            .topic_slug
            .zip(node.topic_title)
            .map(|(slug, title)| PublicMapTopic { slug, title }),
        is_bookmarked: node.is_bookmarked,
        outgoing_portal_links,
    })
}

fn collect_node_references(rule: &UnlockRule, references: &mut HashSet<Uuid>) {
    match rule {
        UnlockRule::Group { rules, .. } => {
            for rule in rules {
                collect_node_references(rule, references)
            }
        }
        UnlockRule::NodeCompleted { node_reference } => {
            if let Ok(id) = Uuid::parse_str(node_reference) {
                references.insert(id);
            }
        }
        _ => {}
    }
}
fn presented_state(authored: &str, evaluated: LearnerNodeState) -> String {
    match evaluated {
        LearnerNodeState::Available
            if authored_node_state(authored) == LearnerNodeState::Available =>
        {
            authored.into()
        }
        LearnerNodeState::Available => "available".into(),
        LearnerNodeState::Locked => "locked".into(),
        LearnerNodeState::Hidden => "hidden".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_source_display_states_until_availability_overrides_them() {
        for state in ["active", "completed", "hinted", "recommended", "available"] {
            assert_eq!(presented_state(state, LearnerNodeState::Available), state);
            assert_eq!(presented_state(state, LearnerNodeState::Locked), "locked");
        }
        assert_eq!(
            presented_state("locked", LearnerNodeState::Available),
            "available"
        );
        assert_eq!(
            presented_state("hidden", LearnerNodeState::Hidden),
            "hidden"
        );
    }
}
