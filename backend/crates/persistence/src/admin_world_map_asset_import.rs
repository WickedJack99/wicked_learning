use std::collections::HashMap;

use serde_json::{Map, Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::admin_world_map_asset_import::{
    AdminWorldMapAssetImportError, AdminWorldMapAssetImportRepository as Port,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

use crate::admin_world_map_import::{protocol_error, remap_value, synchronize_media_references};

pub struct PostgresAdminWorldMapAssetImportRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldMapAssetImportRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldMapAssetImportRepository<'_> {
    fn import_map_asset(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        manifest: &Value,
    ) -> impl std::future::Future<Output = Result<Option<Uuid>, AdminWorldMapAssetImportError>> + Send
    {
        async move {
            import_asset(self.pool, principal, map_id, manifest)
                .await
                .map_err(|error| {
                    if matches!(error, sqlx::Error::Protocol(_)) {
                        AdminWorldMapAssetImportError::Invalid
                    } else {
                        tracing::error!(%error, "could not import World Builder MapAsset manifest");
                        AdminWorldMapAssetImportError::Unavailable
                    }
                })
        }
    }
}

#[derive(FromRow)]
struct DestinationMap {
    world_slug: String,
    creator_id: Option<Uuid>,
}

async fn import_asset(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_id: Uuid,
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
    let Some(destination) = sqlx::query_as::<_, DestinationMap>(
        "SELECT worlds.slug AS world_slug, maps.created_by_principal_id AS creator_id FROM learning_maps AS maps INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id WHERE maps.id = $1 FOR UPDATE OF maps",
    )
    .bind(map_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    if !editable(
        &mut transaction,
        principal,
        principal_id,
        map_id,
        destination.creator_id,
    )
    .await?
    {
        return Ok(None);
    }
    let payload = object(manifest);
    if string(
        object_value(object_value(payload, "source"), "world"),
        "slug",
    ) != destination.world_slug
    {
        return Ok(None);
    }
    let asset = object_value(payload, "mapAsset");
    let asset_id = Uuid::new_v4();
    let asset_slug =
        unique_slug(&mut transaction, map_id, "map-asset", "learning_map_assets").await?;
    let title = optional_string(asset, "text").unwrap_or("MapAsset");
    let image_url = optional_string(asset, "imageUrl");
    let visual_config = json_value(asset, "visualConfig");
    let interaction_config = json_value(asset, "interactionConfig");
    let sound_config = json_value(asset, "soundConfig");
    sqlx::query("INSERT INTO learning_map_assets (id,map_id,slug,title,description,image_url,text,position_x,position_y,position_z,interaction_mode,width,opacity,locked,visual_config,interaction_config,sound_config) VALUES ($1,$2,$3,$4,'',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)")
        .bind(asset_id).bind(map_id).bind(asset_slug).bind(title).bind(image_url).bind(optional_string(asset,"text")).bind(number(asset,"x",50.0)).bind(number(asset,"y",50.0)).bind(number(asset,"z",0.0) as i32).bind(optional_string(asset,"interactionMode").unwrap_or("focusable")).bind(number(asset,"width",14.0)).bind(number(asset,"opacity",1.0)).bind(boolean(asset,"locked")).bind(&visual_config).bind(&interaction_config).bind(&sound_config).execute(&mut *transaction).await?;

    let mut topics_by_source = HashMap::new();
    for topic in list(asset, "messageTopics") {
        let topic = object(topic);
        let topic_id = Uuid::new_v4();
        let slug = optional_string(topic, "slug").unwrap_or("topic");
        sqlx::query(
            "INSERT INTO learning_message_topics (id,map_asset_id,slug,title) VALUES ($1,$2,$3,$4)",
        )
        .bind(topic_id)
        .bind(asset_id)
        .bind(slug)
        .bind(optional_string(topic, "title").unwrap_or(slug))
        .execute(&mut *transaction)
        .await?;
        if let Some(source_id) = optional_string(topic, "sourceId") {
            topics_by_source.insert(source_id.to_owned(), topic_id);
        }
    }

    let node = payload.get("node").and_then(Value::as_object);
    if let Some(node) = node {
        let node_id = Uuid::new_v4();
        let node_slug = unique_slug(
            &mut transaction,
            map_id,
            optional_string(node, "slug").unwrap_or("imported-place"),
            "learning_nodes",
        )
        .await?;
        let position = object_value(node, "position");
        let (position_q, position_r) = available_position(
            &mut transaction,
            map_id,
            number(position, "q", 0.0) as i32,
            number(position, "r", 0.0) as i32,
        )
        .await?;
        let nodes_by_source = optional_string(node, "sourceId")
            .map(|source_id| HashMap::from([(source_id.to_owned(), node_id)]))
            .unwrap_or_default();
        sqlx::query("INSERT INTO learning_nodes (id,map_id,map_asset_id,slug,title,description,position_q,position_r,state,visual_config,activity_graph_layout) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)")
            .bind(node_id).bind(map_id).bind(asset_id).bind(&node_slug).bind(optional_string(node,"title").unwrap_or(&node_slug)).bind(optional_string(node,"description").unwrap_or_default()).bind(position_q).bind(position_r).bind(optional_string(node,"state").unwrap_or("available")).bind(remap_value(json_value(node,"visualConfig"), &nodes_by_source, &["nodeId", "node_id", "requiredNodeIds"])).bind(json_value(node,"activityGraphLayout")).execute(&mut *transaction).await?;
        let route_id = Uuid::new_v4();
        sqlx::query("INSERT INTO learning_routes (id,map_asset_id,slug,title,description,position) VALUES ($1,$2,'default','Default route','',0)")
            .bind(route_id).bind(asset_id).execute(&mut *transaction).await?;
        let mut activities_by_slug = HashMap::new();
        let mut activity_media = Vec::new();
        for activity in list(node, "activities") {
            let activity = object(activity);
            let activity_id = Uuid::new_v4();
            let activity_slug = string(activity, "slug");
            let graph_position = object_value(activity, "graphPosition");
            let config = remap_value(
                json_value(activity, "config"),
                &topics_by_source,
                &["messageTopicId"],
            );
            sqlx::query("INSERT INTO learning_activities (id,route_id,slug,title,description,position,activity_type,activity_config,introduction,graph_position_x,graph_position_y,ai_review_status) VALUES ($1,$2,$3,$4,'',$5,$6,$7,$8,$9,$10,'needs_review')")
                .bind(activity_id).bind(route_id).bind(activity_slug).bind(string(activity,"title")).bind(number(activity,"sortOrder",0.0) as i16).bind(string(activity,"type")).bind(&config).bind(optional_string(activity,"introduction")).bind(optional_number(graph_position,"x")).bind(optional_number(graph_position,"y")).execute(&mut *transaction).await?;
            activities_by_slug.insert(activity_slug.to_owned(), activity_id);
            activity_media.push((activity_id, config));
        }
        if let Some(start_slug) = optional_string(node, "startActivitySlug")
            && let Some(activity_id) = activities_by_slug.get(start_slug)
        {
            sqlx::query("UPDATE learning_nodes SET start_activity_id = $2 WHERE id = $1")
                .bind(node_id)
                .bind(activity_id)
                .execute(&mut *transaction)
                .await?;
        }
        for start in list(node, "activityStarts") {
            let start = object(start);
            let Some(activity_id) = optional_string(start, "activitySlug")
                .and_then(|slug| activities_by_slug.get(slug))
                .copied()
            else {
                continue;
            };
            sqlx::query("INSERT INTO learning_activity_starts (id,node_id,activity_id,label,description,image_dark,image_light,button_color_dark,button_border_color_dark,button_color_light,button_border_color_light,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)")
                .bind(Uuid::new_v4()).bind(node_id).bind(activity_id).bind(optional_string(start,"label")).bind(optional_string(start,"description")).bind(optional_string(start,"imageDark")).bind(optional_string(start,"imageLight")).bind(optional_string(start,"buttonColorDark")).bind(optional_string(start,"buttonBorderColorDark")).bind(optional_string(start,"buttonColorLight")).bind(optional_string(start,"buttonBorderColorLight")).bind(number(start,"sortOrder",0.0) as i16).execute(&mut *transaction).await?;
        }
        for activity in list(node, "activities") {
            let activity = object(activity);
            let Some(from_id) = activities_by_slug.get(string(activity, "slug")).copied() else {
                continue;
            };
            for transition in list(activity, "transitions") {
                let transition = object(transition);
                let target = optional_string(transition, "toActivitySlug")
                    .and_then(|slug| activities_by_slug.get(slug))
                    .copied();
                sqlx::query("INSERT INTO learning_activity_transitions (from_activity_id,to_activity_id,from_connector,to_connector,trigger,trigger_value,label,rules) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)")
                    .bind(from_id).bind(target).bind(optional_string(transition,"fromConnector").unwrap_or("completed")).bind(optional_string(transition,"toConnector")).bind(optional_string(transition,"trigger").unwrap_or("completed")).bind(optional_string(transition,"triggerValue")).bind(optional_string(transition,"label")).bind(json_value(transition,"rules")).execute(&mut *transaction).await?;
            }
            import_dialogues(
                &mut transaction,
                activity,
                *activities_by_slug
                    .get(string(activity, "slug"))
                    .expect("source activity was just inserted"),
                &nodes_by_source,
            )
            .await?;
        }
        for (activity_id, config) in activity_media {
            synchronize_media_references(&mut transaction, "activity", activity_id, &config)
                .await?;
        }
    }
    synchronize_media_references(&mut transaction, "map_asset", asset_id, &json!({"image_url": image_url, "visual_config": visual_config, "interaction_config": interaction_config, "sound_config": sound_config})).await?;
    transaction.commit().await?;
    Ok(Some(asset_id))
}

async fn editable(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map_id: Uuid,
    creator_id: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    let direct: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id = $1 AND memberships.principal_id = $2)").bind(map_id).bind(principal_id).fetch_one(&mut **transaction).await?;
    let Some(scope) = principal.permission_scope("world_maps", "ru") else {
        return Ok(false);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct)
        || direct)
}

async fn unique_slug(
    transaction: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
    base: &str,
    table: &str,
) -> Result<String, sqlx::Error> {
    for suffix in 1..10_000 {
        let candidate = if suffix == 1 {
            base.to_owned()
        } else {
            format!("{base}-{suffix}")
        };
        let exists: bool = match table {
            "learning_map_assets" => sqlx::query_scalar(
                "SELECT EXISTS (SELECT 1 FROM learning_map_assets WHERE map_id = $1 AND slug = $2)",
            )
            .bind(map_id)
            .bind(&candidate)
            .fetch_one(&mut **transaction)
            .await?,
            _ => {
                sqlx::query_scalar(
                    "SELECT EXISTS (SELECT 1 FROM learning_nodes WHERE map_id = $1 AND slug = $2)",
                )
                .bind(map_id)
                .bind(&candidate)
                .fetch_one(&mut **transaction)
                .await?
            }
        };
        if !exists {
            return Ok(candidate);
        }
    }
    Err(protocol_error(
        "could not create a unique standalone MapAsset slug",
    ))
}

async fn available_position(
    transaction: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
    mut q: i32,
    r: i32,
) -> Result<(i32, i32), sqlx::Error> {
    loop {
        let occupied: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_nodes WHERE map_id = $1 AND position_q = $2 AND position_r = $3)").bind(map_id).bind(q).bind(r).fetch_one(&mut **transaction).await?;
        if !occupied {
            return Ok((q, r));
        }
        q += 1;
    }
}

async fn import_dialogues(
    transaction: &mut Transaction<'_, Postgres>,
    activity: &Map<String, Value>,
    activity_id: Uuid,
    nodes_by_source: &HashMap<String, Uuid>,
) -> Result<(), sqlx::Error> {
    let mut dialogue_by_source = HashMap::new();
    for dialogue in list(activity, "dialogueNodes") {
        let dialogue = object(dialogue);
        let Some(source_id) = optional_string(dialogue, "sourceId") else {
            continue;
        };
        let dialogue_id = Uuid::new_v4();
        let graph_position = object_value(dialogue, "graphPosition");
        sqlx::query("INSERT INTO learning_npc_dialogue_nodes (id,activity_id,node_type,title,body,node_config,sort_order,graph_position_x,graph_position_y) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)")
            .bind(dialogue_id).bind(activity_id).bind(optional_string(dialogue,"type").unwrap_or("npc_monologue")).bind(optional_string(dialogue,"title").unwrap_or("Dialogue node")).bind(optional_string(dialogue,"body")).bind(remap_value(json_value(dialogue,"config"), nodes_by_source, &["hideNodeIds", "unlockNodeIds"])).bind(number(dialogue,"sortOrder",0.0) as i16).bind(optional_number(graph_position,"x")).bind(optional_number(graph_position,"y")).execute(&mut **transaction).await?;
        dialogue_by_source.insert(source_id.to_owned(), dialogue_id);
    }
    for transition in list(activity, "dialogueTransitions") {
        let transition = object(transition);
        let Some(to_source_id) = optional_string(transition, "toSourceId") else {
            continue;
        };
        let Some(to_node_id) = dialogue_by_source.get(to_source_id).copied() else {
            return Err(protocol_error(
                "dialogue transition target is not part of its activity",
            ));
        };
        let from_node_id = optional_string(transition, "fromSourceId")
            .and_then(|source_id| dialogue_by_source.get(source_id))
            .copied();
        if optional_string(transition, "fromSourceId").is_some() && from_node_id.is_none() {
            return Err(protocol_error(
                "dialogue transition source is not part of its activity",
            ));
        }
        sqlx::query("INSERT INTO learning_npc_dialogue_transitions (activity_id,from_node_id,to_node_id,from_connector,to_connector) VALUES ($1,$2,$3,$4,$5)")
            .bind(activity_id).bind(from_node_id).bind(to_node_id).bind(optional_string(transition,"fromConnector").unwrap_or("out")).bind(optional_string(transition,"toConnector")).execute(&mut **transaction).await?;
    }
    Ok(())
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
    object.get(key).and_then(Value::as_str).unwrap_or("")
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
