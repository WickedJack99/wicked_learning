use std::collections::HashMap;

use serde_json::{Map, Value, json};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::{
    admin_world_map_create::{CreateWorldMapForm, generated_map_slug},
    admin_world_map_import::{AdminWorldMapImportError, AdminWorldMapImportRepository as Port},
};
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

pub struct PostgresAdminWorldMapImportRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldMapImportRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldMapImportRepository<'_> {
    fn import_map(
        &self,
        principal: &AuthorizedPrincipal,
        form: &CreateWorldMapForm,
        manifest: &Value,
    ) -> impl std::future::Future<Output = Result<Option<Uuid>, AdminWorldMapImportError>> + Send
    {
        async move {
            import_map(self.pool, principal, form, manifest)
                .await
                .map_err(|error| {
                    if matches!(error, sqlx::Error::Protocol(_)) {
                        AdminWorldMapImportError::Invalid
                    } else {
                        tracing::error!(%error, "could not import World Builder map manifest");
                        AdminWorldMapImportError::Unavailable
                    }
                })
        }
    }
}

async fn import_map(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    form: &CreateWorldMapForm,
    manifest: &Value,
) -> Result<Option<Uuid>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    let Some((world_id, world_slug)) = sqlx::query_as::<_, (Uuid, String)>(
        "SELECT id, slug FROM learning_worlds ORDER BY created_at, slug LIMIT 1 FOR UPDATE",
    )
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    let Some(map_id) = import_map_in_transaction(
        &mut transaction,
        principal_id,
        world_id,
        &world_slug,
        form,
        manifest,
        true,
    )
    .await?
    else {
        return Ok(None);
    };
    transaction.commit().await?;
    Ok(Some(map_id))
}

/// Writes one validated map manifest inside the caller's transaction. It does
/// not commit so a World import can create all maps before resolving portals.
pub(crate) async fn import_map_in_transaction(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    world_id: Uuid,
    world_slug: &str,
    form: &CreateWorldMapForm,
    manifest: &Value,
    write_portals: bool,
) -> Result<Option<Uuid>, sqlx::Error> {
    let payload = object(manifest);
    if string(object_value(payload, "world"), "slug") != world_slug {
        return Ok(None);
    }
    let map = object_value(payload, "map");
    let slug = unique_slug(
        transaction,
        world_id,
        form.slug
            .as_deref()
            .unwrap_or(&generated_map_slug(&form.title)),
        form.slug.is_some(),
    )
    .await?;
    if slug.is_empty() {
        return Ok(None);
    }
    let map_id = Uuid::new_v4();
    let position: i16 = sqlx::query_scalar("SELECT (COALESCE(MAX(position), -1)::integer + 1)::smallint FROM learning_maps WHERE world_id = $1").bind(world_id).fetch_one(&mut **transaction).await?;
    let topic_id: Option<Uuid> = match optional_string(map, "topicSlug") {
        Some(topic_slug) => {
            sqlx::query_scalar::<_, Uuid>("SELECT id FROM learning_topics WHERE slug = $1")
                .bind(topic_slug)
                .fetch_optional(&mut **transaction)
                .await?
        }
        None => None,
    };
    if optional_string(map, "topicSlug").is_some() && topic_id.is_none() {
        return Ok(None);
    }
    sqlx::query("INSERT INTO learning_maps (id, world_id, slug, title, description, position, background_config, grid_config, map_assets_locked, access_roles, topic_id, created_by_principal_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'[\"public\"]'::jsonb,$10,$11)")
        .bind(map_id).bind(world_id).bind(slug).bind(&form.title).bind(optional_string(map,"description").unwrap_or_default()).bind(position).bind(json_value(map,"backgroundConfig")).bind(json_value(map,"gridConfig")).bind(boolean(map,"mapAssetsLocked")).bind(topic_id).bind(principal_id).execute(&mut **transaction).await?;
    let assets = list(payload, "mapAssets");
    let nodes = list(payload, "nodes");
    let mut assets_by_node = HashMap::new();
    let mut message_topics_by_source = HashMap::new();
    let mut asset_media = Vec::new();
    for (index, asset) in assets.iter().enumerate() {
        let asset = object(asset);
        let id = Uuid::new_v4();
        if let Some(node_slug) = optional_string(asset, "nodeSlug") {
            assets_by_node.insert(node_slug.to_owned(), id);
        }
        let title = optional_string(asset, "text")
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| format!("MapAsset {}", index + 1));
        let image_url = optional_string(asset, "imageUrl").map(ToOwned::to_owned);
        let visual_config = json_value(asset, "visualConfig");
        let interaction_config = json_value(asset, "interactionConfig");
        let sound_config = json_value(asset, "soundConfig");
        sqlx::query("INSERT INTO learning_map_assets (id,map_id,slug,title,description,image_url,text,position_x,position_y,position_z,interaction_mode,width,opacity,locked,visual_config,interaction_config,sound_config) VALUES ($1,$2,$3,$4,'',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)")
            .bind(id).bind(map_id).bind(format!("asset-{}", index + 1)).bind(title).bind(&image_url).bind(optional_string(asset,"text")).bind(number(asset,"x",50.0)).bind(number(asset,"y",50.0)).bind(number(asset,"z",0.0) as i32).bind(optional_string(asset,"interactionMode").unwrap_or("focusable")).bind(number(asset,"width",14.0)).bind(number(asset,"opacity",1.0)).bind(boolean(asset,"locked")).bind(&visual_config).bind(&interaction_config).bind(&sound_config).execute(&mut **transaction).await?;
        asset_media.push((
            id,
            json!({
                "image_url": image_url,
                "visual_config": visual_config,
                "interaction_config": interaction_config,
                "sound_config": sound_config,
            }),
        ));
        for topic in list(asset, "messageTopics") {
            let topic = object(topic);
            let slug = optional_string(topic, "slug").unwrap_or("topic");
            let topic_id = Uuid::new_v4();
            sqlx::query("INSERT INTO learning_message_topics (id,map_asset_id,slug,title) VALUES ($1,$2,$3,$4)").bind(topic_id).bind(id).bind(slug).bind(optional_string(topic,"title").unwrap_or(slug)).execute(&mut **transaction).await?;
            if let Some(source_id) = optional_string(topic, "sourceId") {
                message_topics_by_source.insert(source_id.to_owned(), topic_id);
            }
        }
    }
    let mut nodes_by_slug = HashMap::new();
    let mut nodes_by_source = HashMap::new();
    for node in nodes {
        let node = object(node);
        let slug = string(node, "slug");
        let id = Uuid::new_v4();
        let position = object_value(node, "position");
        sqlx::query("INSERT INTO learning_nodes (id,map_id,map_asset_id,slug,title,description,position_q,position_r,state,visual_config,activity_graph_layout) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)")
            .bind(id).bind(map_id).bind(assets_by_node.get(slug).copied()).bind(slug).bind(optional_string(node,"title").unwrap_or(slug)).bind(optional_string(node,"description").unwrap_or_default()).bind(number(position,"q",0.0) as i32).bind(number(position,"r",0.0) as i32).bind(optional_string(node,"state").unwrap_or("available")).bind(json_value(node,"visualConfig")).bind(json_value(node,"activityGraphLayout")).execute(&mut **transaction).await?;
        nodes_by_slug.insert(slug.to_owned(), id);
        if let Some(source_id) = optional_string(node, "sourceId") {
            nodes_by_source.insert(source_id.to_owned(), id);
        }
    }
    let mut routes_by_node = HashMap::new();
    for (node_slug, asset_id) in &assets_by_node {
        let route_id = Uuid::new_v4();
        sqlx::query("INSERT INTO learning_routes (id,map_asset_id,slug,title,description,position) VALUES ($1,$2,'default','Default route','',0)")
            .bind(route_id).bind(asset_id).execute(&mut **transaction).await?;
        routes_by_node.insert(node_slug.clone(), route_id);
    }
    for node in nodes {
        let node = object(node);
        let Some(node_id) = nodes_by_slug.get(string(node, "slug")).copied() else {
            continue;
        };
        sqlx::query("UPDATE learning_nodes SET visual_config = $2 WHERE id = $1")
            .bind(node_id)
            .bind(remap_value(
                json_value(node, "visualConfig"),
                &nodes_by_source,
                &["nodeId", "node_id", "requiredNodeIds"],
            ))
            .execute(&mut **transaction)
            .await?;
    }
    let mut activities_by_key = HashMap::new();
    let mut activity_media = Vec::new();
    for node in nodes {
        let node = object(node);
        let node_slug = string(node, "slug");
        let Some(route_id) = routes_by_node.get(node_slug).copied() else {
            continue;
        };
        for activity in list(node, "activities") {
            let activity = object(activity);
            let activity_slug = string(activity, "slug");
            let graph_position = object_value(activity, "graphPosition");
            let activity_id = Uuid::new_v4();
            let config = remap_value(
                json_value(activity, "config"),
                &message_topics_by_source,
                &["messageTopicId"],
            );
            sqlx::query("INSERT INTO learning_activities (id,route_id,slug,title,description,position,activity_type,activity_config,introduction,graph_position_x,graph_position_y,ai_review_status) VALUES ($1,$2,$3,$4,'',$5,$6,$7,$8,$9,$10,'needs_review')")
                .bind(activity_id).bind(route_id).bind(activity_slug).bind(string(activity,"title")).bind(number(activity,"sortOrder",0.0) as i16).bind(string(activity,"type")).bind(&config).bind(optional_string(activity,"introduction")).bind(optional_number(graph_position,"x")).bind(optional_number(graph_position,"y")).execute(&mut **transaction).await?;
            activity_media.push((activity_id, config));
            activities_by_key.insert(
                (node_slug.to_owned(), activity_slug.to_owned()),
                activity_id,
            );
        }
    }
    for node in nodes {
        let node = object(node);
        let node_slug = string(node, "slug");
        let Some(node_id) = nodes_by_slug.get(node_slug).copied() else {
            continue;
        };
        if let Some(start_slug) = optional_string(node, "startActivitySlug") {
            if let Some(activity_id) =
                activities_by_key.get(&(node_slug.to_owned(), start_slug.to_owned()))
            {
                sqlx::query("UPDATE learning_nodes SET start_activity_id=$2 WHERE id=$1")
                    .bind(node_id)
                    .bind(activity_id)
                    .execute(&mut **transaction)
                    .await?;
            }
        }
        for start in list(node, "activityStarts") {
            let start = object(start);
            let Some(activity_slug) = optional_string(start, "activitySlug") else {
                continue;
            };
            let Some(activity_id) =
                activities_by_key.get(&(node_slug.to_owned(), activity_slug.to_owned()))
            else {
                continue;
            };
            sqlx::query("INSERT INTO learning_activity_starts (id,node_id,activity_id,label,description,image_dark,image_light,button_color_dark,button_border_color_dark,button_color_light,button_border_color_light,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)")
                .bind(Uuid::new_v4()).bind(node_id).bind(activity_id).bind(optional_string(start,"label")).bind(optional_string(start,"description")).bind(optional_string(start,"imageDark")).bind(optional_string(start,"imageLight")).bind(optional_string(start,"buttonColorDark")).bind(optional_string(start,"buttonBorderColorDark")).bind(optional_string(start,"buttonColorLight")).bind(optional_string(start,"buttonBorderColorLight")).bind(number(start,"sortOrder",0.0) as i16).execute(&mut **transaction).await?;
        }
        for activity in list(node, "activities") {
            let activity = object(activity);
            let from_slug = string(activity, "slug");
            let Some(from_id) =
                activities_by_key.get(&(node_slug.to_owned(), from_slug.to_owned()))
            else {
                continue;
            };
            for transition in list(activity, "transitions") {
                let transition = object(transition);
                let target = optional_string(transition, "toActivitySlug").and_then(|slug| {
                    activities_by_key
                        .get(&(node_slug.to_owned(), slug.to_owned()))
                        .copied()
                });
                sqlx::query("INSERT INTO learning_activity_transitions (from_activity_id,to_activity_id,from_connector,to_connector,trigger,trigger_value,label,rules) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)")
                    .bind(from_id).bind(target).bind(optional_string(transition,"fromConnector").unwrap_or("completed")).bind(optional_string(transition,"toConnector")).bind(optional_string(transition,"trigger").unwrap_or("completed")).bind(optional_string(transition,"triggerValue")).bind(optional_string(transition,"label")).bind(json_value(transition,"rules")).execute(&mut **transaction).await?;
            }
        }
    }
    import_dialogues(transaction, nodes, &activities_by_key, &nodes_by_source).await?;
    if write_portals {
        import_portals(
            transaction,
            payload,
            world_id,
            string(map, "slug"),
            &nodes_by_slug,
            &activities_by_key,
        )
        .await?;
    }
    for (asset_id, snapshot) in asset_media {
        synchronize_media_references(transaction, "map_asset", asset_id, &snapshot).await?;
    }
    for (activity_id, config) in activity_media {
        synchronize_media_references(transaction, "activity", activity_id, &config).await?;
    }
    for (node_slug, node_id) in &nodes_by_slug {
        let Some(node) = nodes
            .iter()
            .find(|node| string(object(node), "slug") == node_slug)
        else {
            continue;
        };
        let config = remap_value(
            json_value(object(node), "visualConfig"),
            &nodes_by_source,
            &["nodeId", "node_id", "requiredNodeIds"],
        );
        synchronize_media_references(transaction, "node", *node_id, &config).await?;
    }
    Ok(Some(map_id))
}

async fn unique_slug(
    transaction: &mut Transaction<'_, Postgres>,
    world_id: Uuid,
    base: &str,
    explicit: bool,
) -> Result<String, sqlx::Error> {
    for suffix in 1..10_000 {
        let candidate = if suffix == 1 {
            base.to_owned()
        } else {
            format!("{base}-{suffix}")
        };
        if candidate.len() > 140 {
            return Ok(String::new());
        }
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM learning_maps WHERE world_id=$1 AND slug=$2)",
        )
        .bind(world_id)
        .bind(&candidate)
        .fetch_one(&mut **transaction)
        .await?;
        if !exists {
            return Ok(candidate);
        }
        if explicit {
            return Ok(String::new());
        }
    }
    Ok(String::new())
}

async fn import_dialogues(
    transaction: &mut Transaction<'_, Postgres>,
    nodes: &[Value],
    activities_by_key: &HashMap<(String, String), Uuid>,
    nodes_by_source: &HashMap<String, Uuid>,
) -> Result<(), sqlx::Error> {
    for node in nodes {
        let node = object(node);
        let node_slug = string(node, "slug");
        for activity in list(node, "activities") {
            let activity = object(activity);
            let activity_slug = string(activity, "slug");
            let Some(activity_id) = activities_by_key
                .get(&(node_slug.to_owned(), activity_slug.to_owned()))
                .copied()
            else {
                continue;
            };
            let mut dialogue_nodes_by_source = HashMap::new();
            for dialogue in list(activity, "dialogueNodes") {
                let dialogue = object(dialogue);
                let Some(source_id) = optional_string(dialogue, "sourceId") else {
                    continue;
                };
                let dialogue_id = Uuid::new_v4();
                let graph_position = object_value(dialogue, "graphPosition");
                sqlx::query("INSERT INTO learning_npc_dialogue_nodes (id,activity_id,node_type,title,body,node_config,sort_order,graph_position_x,graph_position_y) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)")
                    .bind(dialogue_id)
                    .bind(activity_id)
                    .bind(optional_string(dialogue,"type").unwrap_or("npc_monologue"))
                    .bind(optional_string(dialogue,"title").unwrap_or("Dialogue node"))
                    .bind(optional_string(dialogue,"body"))
                    .bind(remap_value(json_value(dialogue,"config"), nodes_by_source, &["hideNodeIds", "unlockNodeIds"]))
                    .bind(number(dialogue,"sortOrder",0.0) as i16)
                    .bind(optional_number(graph_position,"x"))
                    .bind(optional_number(graph_position,"y"))
                    .execute(&mut **transaction)
                    .await?;
                dialogue_nodes_by_source.insert(source_id.to_owned(), dialogue_id);
            }
            for transition in list(activity, "dialogueTransitions") {
                let transition = object(transition);
                let Some(to_source_id) = optional_string(transition, "toSourceId") else {
                    continue;
                };
                let Some(to_node_id) = dialogue_nodes_by_source.get(to_source_id).copied() else {
                    return Err(protocol_error(
                        "dialogue transition target is not part of its activity",
                    ));
                };
                let from_node_id = optional_string(transition, "fromSourceId")
                    .and_then(|source_id| dialogue_nodes_by_source.get(source_id).copied());
                if optional_string(transition, "fromSourceId").is_some() && from_node_id.is_none() {
                    return Err(protocol_error(
                        "dialogue transition source is not part of its activity",
                    ));
                }
                sqlx::query("INSERT INTO learning_npc_dialogue_transitions (activity_id,from_node_id,to_node_id,from_connector,to_connector) VALUES ($1,$2,$3,$4,$5)")
                    .bind(activity_id)
                    .bind(from_node_id)
                    .bind(to_node_id)
                    .bind(optional_string(transition,"fromConnector").unwrap_or("out"))
                    .bind(optional_string(transition,"toConnector"))
                    .execute(&mut **transaction)
                    .await?;
            }
        }
    }
    Ok(())
}

async fn import_portals(
    transaction: &mut Transaction<'_, Postgres>,
    payload: &Map<String, Value>,
    world_id: Uuid,
    source_map_slug: &str,
    nodes_by_slug: &HashMap<String, Uuid>,
    activities_by_key: &HashMap<(String, String), Uuid>,
) -> Result<(), sqlx::Error> {
    for portal in list(payload, "portalTargets") {
        let portal = object(portal);
        let source_node_slug = string(portal, "sourceNodeSlug");
        let source_activity_slug = optional_string(portal, "sourceActivitySlug");
        let target_activity_slug = optional_string(portal, "targetActivitySlug");
        if source_activity_slug.is_some() != target_activity_slug.is_some() {
            return Err(protocol_error(
                "portal activities must be both present or both absent",
            ));
        }
        let Some(source_node_id) = nodes_by_slug.get(source_node_slug).copied() else {
            return Err(protocol_error(
                "portal source is not part of the imported map",
            ));
        };
        let source_activity_id = source_activity_slug
            .map(|slug| {
                activities_by_key
                    .get(&(source_node_slug.to_owned(), slug.to_owned()))
                    .copied()
                    .ok_or_else(|| protocol_error("portal source is not part of the imported map"))
            })
            .transpose()?;
        let target_map_slug = string(portal, "targetMapSlug");
        let target_node_slug = string(portal, "targetNodeSlug");
        let (target_node_id, target_activity_id) = if target_map_slug == source_map_slug {
            let Some(target_node_id) = nodes_by_slug.get(target_node_slug).copied() else {
                return Err(protocol_error(
                    "portal target node is not part of the imported map",
                ));
            };
            let target_activity_id = target_activity_slug
                .map(|slug| {
                    activities_by_key
                        .get(&(target_node_slug.to_owned(), slug.to_owned()))
                        .copied()
                        .ok_or_else(|| {
                            protocol_error("portal target activity is not part of the imported map")
                        })
                })
                .transpose()?;
            (target_node_id, target_activity_id)
        } else {
            portal_endpoint(
                transaction,
                world_id,
                target_map_slug,
                target_node_slug,
                target_activity_slug,
            )
            .await?
            .ok_or_else(|| protocol_error("portal target is unavailable in this workspace"))?
        };
        if source_node_id == target_node_id {
            return Err(protocol_error("portal target must be a different node"));
        }
        sqlx::query("INSERT INTO learning_portal_links (source_activity_id,target_activity_id,source_node_id,target_node_id,label,description) VALUES ($1,$2,$3,$4,$5,$6)")
            .bind(source_activity_id)
            .bind(target_activity_id)
            .bind(source_node_id)
            .bind(target_node_id)
            .bind(optional_string(portal,"label"))
            .bind(optional_string(portal,"description"))
            .execute(&mut **transaction)
            .await?;
    }
    Ok(())
}

/// Restores one imported map's portals after every destination map has been
/// populated. A world bundle may need to point at a destination slug that was
/// changed to avoid a collision, so both endpoints are resolved by their
/// authored slugs at this late stage.
pub(crate) async fn import_deferred_portals(
    transaction: &mut Transaction<'_, Postgres>,
    payload: &Value,
    world_id: Uuid,
    source_map_slug: &str,
    destination_map_slug: &str,
    destination_slugs: &HashMap<String, String>,
) -> Result<(), sqlx::Error> {
    let payload = object(payload);
    for portal in list(payload, "portalTargets") {
        let portal = object(portal);
        let source_activity_slug = optional_string(portal, "sourceActivitySlug");
        let target_activity_slug = optional_string(portal, "targetActivitySlug");
        if source_activity_slug.is_some() != target_activity_slug.is_some() {
            return Err(protocol_error(
                "portal activities must be both present or both absent",
            ));
        }
        let source = portal_endpoint(
            transaction,
            world_id,
            destination_map_slug,
            string(portal, "sourceNodeSlug"),
            source_activity_slug,
        )
        .await?
        .ok_or_else(|| protocol_error("portal source is not part of the imported map"))?;
        let target_source_slug = string(portal, "targetMapSlug");
        let target_map_slug = if target_source_slug == source_map_slug {
            destination_map_slug
        } else {
            destination_slugs
                .get(target_source_slug)
                .map(String::as_str)
                .unwrap_or(target_source_slug)
        };
        let target = portal_endpoint(
            transaction,
            world_id,
            target_map_slug,
            string(portal, "targetNodeSlug"),
            target_activity_slug,
        )
        .await?
        .ok_or_else(|| protocol_error("portal target is unavailable in this workspace"))?;
        if source.0 == target.0 {
            return Err(protocol_error("portal target must be a different node"));
        }
        sqlx::query("INSERT INTO learning_portal_links (source_activity_id,target_activity_id,source_node_id,target_node_id,label,description) VALUES ($1,$2,$3,$4,$5,$6)")
            .bind(source.1)
            .bind(target.1)
            .bind(source.0)
            .bind(target.0)
            .bind(optional_string(portal, "label"))
            .bind(optional_string(portal, "description"))
            .execute(&mut **transaction)
            .await?;
    }
    Ok(())
}

async fn portal_endpoint(
    transaction: &mut Transaction<'_, Postgres>,
    world_id: Uuid,
    map_slug: &str,
    node_slug: &str,
    activity_slug: Option<&str>,
) -> Result<Option<(Uuid, Option<Uuid>)>, sqlx::Error> {
    if let Some(activity_slug) = activity_slug {
        return sqlx::query_as::<_, (Uuid, Uuid)>("SELECT nodes.id, activities.id FROM learning_maps AS maps INNER JOIN learning_nodes AS nodes ON nodes.map_id = maps.id INNER JOIN learning_map_assets AS assets ON assets.id = nodes.map_asset_id INNER JOIN learning_routes AS routes ON routes.map_asset_id = assets.id INNER JOIN learning_activities AS activities ON activities.route_id = routes.id WHERE maps.world_id = $1 AND maps.slug = $2 AND nodes.slug = $3 AND activities.slug = $4 LIMIT 1")
            .bind(world_id)
            .bind(map_slug)
            .bind(node_slug)
            .bind(activity_slug)
            .fetch_optional(&mut **transaction)
            .await
            .map(|endpoint| endpoint.map(|(node_id, activity_id)| (node_id, Some(activity_id))));
    }
    sqlx::query_as::<_, (Uuid,)>("SELECT nodes.id FROM learning_maps AS maps INNER JOIN learning_nodes AS nodes ON nodes.map_id = maps.id WHERE maps.world_id = $1 AND maps.slug = $2 AND nodes.slug = $3 LIMIT 1")
        .bind(world_id)
        .bind(map_slug)
        .bind(node_slug)
        .fetch_optional(&mut **transaction)
        .await
        .map(|endpoint| endpoint.map(|(node_id,)| (node_id, None)))
}

pub(crate) async fn synchronize_media_references(
    transaction: &mut Transaction<'_, Postgres>,
    owner_kind: &str,
    owner_id: Uuid,
    snapshot: &Value,
) -> Result<(), sqlx::Error> {
    for (asset_id, field_key) in managed_media_references(snapshot) {
        let added = sqlx::query("INSERT INTO reusable_media_asset_references (asset_id,owner_kind,owner_id,field_key) SELECT id,$2,$3,$4 FROM reusable_media_assets WHERE id=$1 ON CONFLICT DO NOTHING")
            .bind(asset_id)
            .bind(owner_kind)
            .bind(owner_id)
            .bind(field_key)
            .execute(&mut **transaction)
            .await?;
        if added.rows_affected() == 0 {
            let exists: bool = sqlx::query_scalar(
                "SELECT EXISTS (SELECT 1 FROM reusable_media_assets WHERE id = $1)",
            )
            .bind(asset_id)
            .fetch_one(&mut **transaction)
            .await?;
            if !exists {
                return Err(protocol_error(
                    "referenced managed media is unavailable in this workspace",
                ));
            }
        }
    }
    Ok(())
}

fn managed_media_references(value: &Value) -> Vec<(Uuid, String)> {
    const PREFIX: &str = "/api/v1/admin/media-assets/";
    fn visit(value: &Value, path: String, output: &mut Vec<(Uuid, String)>, depth: usize) {
        if output.len() == 48 || depth > 16 {
            return;
        }
        match value {
            Value::Object(values) => {
                for (key, value) in values {
                    let path = if path.is_empty() {
                        key.to_owned()
                    } else {
                        format!("{path}.{key}")
                    };
                    visit(value, path, output, depth + 1);
                }
            }
            Value::Array(values) => {
                for (index, value) in values.iter().enumerate() {
                    visit(value, format!("{path}[{index}]"), output, depth + 1);
                }
            }
            Value::String(url) => {
                let Some(rest) = url.strip_prefix(PREFIX) else {
                    return;
                };
                let Some((asset_id, suffix)) = rest.split_once('/') else {
                    return;
                };
                if suffix == "content" && rest.len() == asset_id.len() + "/content".len() {
                    if let Ok(asset_id) = Uuid::parse_str(asset_id) {
                        if !path.is_empty() && path.len() <= 160 {
                            output.push((asset_id, path));
                        }
                    }
                }
            }
            _ => {}
        }
    }
    let mut references = Vec::new();
    visit(value, String::new(), &mut references, 0);
    references
}

pub(crate) fn remap_value(mut value: Value, ids: &HashMap<String, Uuid>, keys: &[&str]) -> Value {
    match &mut value {
        Value::Object(object) => {
            for (key, nested) in object {
                if keys.contains(&key.as_str()) {
                    remap_identifier(nested, ids);
                } else {
                    *nested = remap_value(nested.take(), ids, keys);
                }
            }
        }
        Value::Array(values) => {
            for nested in values {
                *nested = remap_value(nested.take(), ids, keys);
            }
        }
        _ => {}
    }
    value
}

fn remap_identifier(value: &mut Value, ids: &HashMap<String, Uuid>) {
    match value {
        Value::String(source) => {
            if let Some(destination) = ids.get(source) {
                *source = destination.to_string();
            }
        }
        Value::Array(values) => {
            for value in values {
                remap_identifier(value, ids);
            }
        }
        _ => {}
    }
}

pub(crate) fn protocol_error(message: &str) -> sqlx::Error {
    sqlx::Error::Protocol(message.to_owned())
}

fn object(value: &Value) -> &Map<String, Value> {
    static EMPTY: std::sync::LazyLock<Map<String, Value>> = std::sync::LazyLock::new(Map::new);
    value.as_object().unwrap_or(&EMPTY)
}
fn object_value<'a>(object: &'a Map<String, Value>, key: &str) -> &'a Map<String, Value> {
    static EMPTY: std::sync::LazyLock<Map<String, Value>> = std::sync::LazyLock::new(Map::new);
    object.get(key).and_then(Value::as_object).unwrap_or(&EMPTY)
}
fn list<'a>(object: &'a Map<String, Value>, key: &str) -> &'a Vec<Value> {
    static EMPTY: std::sync::LazyLock<Vec<Value>> = std::sync::LazyLock::new(Vec::new);
    object.get(key).and_then(Value::as_array).unwrap_or(&EMPTY)
}
fn string<'a>(object: &'a Map<String, Value>, key: &str) -> &'a str {
    const EMPTY: &str = "";
    object.get(key).and_then(Value::as_str).unwrap_or(EMPTY)
}
fn optional_string<'a>(object: &'a Map<String, Value>, key: &str) -> Option<&'a str> {
    object
        .get(key)
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
}
fn number(object: &Map<String, Value>, key: &str, fallback: f64) -> f64 {
    object.get(key).and_then(Value::as_f64).unwrap_or(fallback)
}
fn optional_number(object: &Map<String, Value>, key: &str) -> Option<f64> {
    object.get(key).and_then(Value::as_f64)
}
fn boolean(object: &Map<String, Value>, key: &str) -> bool {
    object.get(key).and_then(Value::as_bool).unwrap_or(false)
}
fn json_value(object: &Map<String, Value>, key: &str) -> Value {
    object
        .get(key)
        .cloned()
        .filter(Value::is_object)
        .unwrap_or_else(|| json!({}))
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use uuid::Uuid;

    use super::{managed_media_references, remap_value};

    #[test]
    fn remaps_only_declared_import_reference_fields() {
        let source = Uuid::new_v4();
        let destination = Uuid::new_v4();
        let value = json!({
            "nodeId": source.to_string(),
            "note": source.to_string(),
        });

        assert_eq!(
            remap_value(
                value,
                &std::collections::HashMap::from([(source.to_string(), destination)]),
                &["nodeId"],
            ),
            json!({"nodeId": destination.to_string(), "note": source.to_string()})
        );
    }

    #[test]
    fn finds_only_exact_managed_media_content_urls() {
        let managed = Uuid::new_v4();
        assert_eq!(
            managed_media_references(&json!({
                "image": format!("/api/v1/admin/media-assets/{managed}/content"),
                "thumbnail": format!("/api/v1/admin/media-assets/{managed}/thumbnail"),
            })),
            vec![(managed, "image".to_owned())]
        );
    }
}
