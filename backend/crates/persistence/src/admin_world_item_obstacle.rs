use std::collections::{HashMap, HashSet};

use serde_json::{Value, json};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::{
    admin_world_item_grant::generated_slug,
    admin_world_item_obstacle::{
        AdminWorldItemObstacleError, AdminWorldItemObstacleRepository as Port,
        ItemObstacleActivityForm, ItemObstacleSound, UpdatedItemObstacleActivity,
    },
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

use crate::admin_world_activity_history::record_activity_version;

pub struct PostgresAdminWorldItemObstacleRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldItemObstacleRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldItemObstacleRepository<'_> {
    fn create_item_obstacle(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &ItemObstacleActivityForm,
    ) -> impl std::future::Future<Output = Result<Option<Uuid>, AdminWorldItemObstacleError>> + Send
    {
        async move {
            create(self.pool, principal, node_id, form)
                .await
                .map_err(map_error)
        }
    }

    fn update_item_obstacle(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &ItemObstacleActivityForm,
        expected_updated_at: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<UpdatedItemObstacleActivity>, AdminWorldItemObstacleError>,
    > + Send {
        async move {
            update(self.pool, principal, activity_id, form, expected_updated_at)
                .await
                .map_err(map_error)
        }
    }
}

#[derive(FromRow)]
struct ScopedNode {
    map_asset_id: Option<Uuid>,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
}

#[derive(FromRow)]
struct ScopedActivity {
    map_asset_id: Uuid,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
    slug: String,
    title: String,
    introduction: Option<String>,
    config: Value,
    updated_at: String,
}

#[derive(FromRow)]
struct CatalogItem {
    id: Uuid,
    slug: String,
}

struct ResolvedCatalogReferences {
    item_slugs: Vec<String>,
    sound_not_met_id: Option<String>,
    sound_met_id: Option<String>,
    sound_transition_id: Option<String>,
}

enum MutationError {
    Invalid,
    Conflict,
    Storage(sqlx::Error),
}

impl From<sqlx::Error> for MutationError {
    fn from(error: sqlx::Error) -> Self {
        Self::Storage(error)
    }
}

fn map_error(error: MutationError) -> AdminWorldItemObstacleError {
    match error {
        MutationError::Invalid => AdminWorldItemObstacleError::InvalidActivity,
        MutationError::Conflict => AdminWorldItemObstacleError::Conflict,
        MutationError::Storage(error) => {
            tracing::error!(%error, "could not mutate scoped World Builder item-obstacle activity");
            AdminWorldItemObstacleError::Unavailable
        }
    }
}

async fn create(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    form: &ItemObstacleActivityForm,
) -> Result<Option<Uuid>, MutationError> {
    let mut transaction = pool.begin().await?;
    let Some(node) = lock_node(&mut transaction, principal, node_id).await? else {
        return Ok(None);
    };
    let Some(map_asset_id) = node.map_asset_id else {
        return Ok(None);
    };
    let references = resolve_catalog_references(&mut transaction, form).await?;
    let Some(route_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM learning_routes WHERE map_asset_id = $1 ORDER BY position ASC, id ASC LIMIT 1 FOR UPDATE",
    )
    .bind(map_asset_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    let slug = unique_slug(&mut transaction, map_asset_id, form, None).await?;
    let position: i16 = sqlx::query_scalar(
        "SELECT (COALESCE(MAX(position), -1)::integer + 1)::smallint FROM learning_activities WHERE route_id = $1",
    )
    .bind(route_id)
    .fetch_one(&mut *transaction)
    .await?;
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO learning_activities (id, route_id, slug, title, description, position, published_at, activity_type, activity_config, introduction, ai_review_status) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'item_obstacle', $7, $8, 'needs_review')",
    )
    .bind(id)
    .bind(route_id)
    .bind(slug)
    .bind(&form.title)
    .bind(form.introduction.clone().unwrap_or_default())
    .bind(position)
    .bind(config(form, &references))
    .bind(&form.introduction)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Some(id))
}

async fn update(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    form: &ItemObstacleActivityForm,
    expected_updated_at: &str,
) -> Result<Option<UpdatedItemObstacleActivity>, MutationError> {
    let mut transaction = pool.begin().await?;
    let Some(current) = lock_activity(&mut transaction, principal, activity_id).await? else {
        return Ok(None);
    };
    if current.updated_at != expected_updated_at {
        return Err(MutationError::Conflict);
    }
    let references = resolve_catalog_references(&mut transaction, form).await?;
    let slug = unique_slug(
        &mut transaction,
        current.map_asset_id,
        form,
        Some(activity_id),
    )
    .await?;
    let mut config_value = current.config.clone();
    let target = config_value.as_object_mut().ok_or(MutationError::Invalid)?;
    for (key, value) in config(form, &references)
        .as_object()
        .expect("item-obstacle config is an object")
    {
        target.insert(key.clone(), value.clone());
    }
    if current.slug == slug
        && current.title == form.title
        && current.introduction == form.introduction
        && current.config == config_value
    {
        transaction.commit().await?;
        return Ok(Some(UpdatedItemObstacleActivity {
            activity_id,
            updated_at: current.updated_at,
        }));
    }
    record_activity_version(&mut transaction, activity_id, principal).await?;
    let updated_at: String = sqlx::query_scalar(
        "UPDATE learning_activities SET slug = $2, title = $3, description = $4, introduction = $5, activity_config = $6, ai_review_status = 'needs_review', ai_reviewed_at = NULL, ai_review = NULL, updated_at = NOW() WHERE id = $1 RETURNING to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')",
    )
    .bind(activity_id)
    .bind(slug)
    .bind(&form.title)
    .bind(form.introduction.clone().unwrap_or_default())
    .bind(&form.introduction)
    .bind(config_value)
    .fetch_one(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Some(UpdatedItemObstacleActivity {
        activity_id,
        updated_at,
    }))
}

async fn resolve_catalog_references(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    form: &ItemObstacleActivityForm,
) -> Result<ResolvedCatalogReferences, MutationError> {
    let item_ids: Vec<Uuid> = form.slots.iter().map(|slot| slot.item_id).collect();
    let unique_item_ids: HashSet<Uuid> = item_ids.iter().copied().collect();
    let items: Vec<CatalogItem> =
        sqlx::query_as("SELECT id, slug FROM learning_items WHERE id = ANY($1)")
            .bind(&item_ids)
            .fetch_all(&mut **transaction)
            .await?;
    if items.len() != unique_item_ids.len() {
        return Err(MutationError::Invalid);
    }
    let item_slugs_by_id: HashMap<Uuid, String> =
        items.into_iter().map(|item| (item.id, item.slug)).collect();
    let item_slugs = item_ids
        .into_iter()
        .map(|item_id| {
            item_slugs_by_id
                .get(&item_id)
                .cloned()
                .ok_or(MutationError::Invalid)
        })
        .collect::<Result<Vec<_>, _>>()?;

    let sound_ids: Vec<Uuid> = [
        form.sound_not_met.sound_id,
        form.sound_met.sound_id,
        form.sound_transition.sound_id,
    ]
    .into_iter()
    .flatten()
    .collect();
    let unique_sound_ids: HashSet<Uuid> = sound_ids.iter().copied().collect();
    let found_sound_ids: Vec<Uuid> =
        sqlx::query_scalar("SELECT id FROM learning_sounds WHERE id = ANY($1)")
            .bind(&sound_ids)
            .fetch_all(&mut **transaction)
            .await?;
    if found_sound_ids.len() != unique_sound_ids.len() {
        return Err(MutationError::Invalid);
    }
    let sound_ids: HashSet<Uuid> = found_sound_ids.into_iter().collect();
    Ok(ResolvedCatalogReferences {
        item_slugs,
        sound_not_met_id: resolve_sound_id(&form.sound_not_met, &sound_ids)?,
        sound_met_id: resolve_sound_id(&form.sound_met, &sound_ids)?,
        sound_transition_id: resolve_sound_id(&form.sound_transition, &sound_ids)?,
    })
}

fn resolve_sound_id(
    sound: &ItemObstacleSound,
    resolved_sound_ids: &HashSet<Uuid>,
) -> Result<Option<String>, MutationError> {
    sound
        .sound_id
        .map(|sound_id| {
            resolved_sound_ids
                .contains(&sound_id)
                .then(|| sound_id.to_string())
                .ok_or(MutationError::Invalid)
        })
        .transpose()
}

fn config(form: &ItemObstacleActivityForm, references: &ResolvedCatalogReferences) -> Value {
    json!({
        "backgroundDark": form.background_dark,
        "backgroundLight": form.background_light,
        "backgroundMirrored": form.background_mirrored,
        "metBackgroundDark": form.met_background_dark,
        "metBackgroundLight": form.met_background_light,
        "metBackgroundMirrored": form.met_background_mirrored,
        "overlayDark": form.overlay_dark,
        "overlayLight": form.overlay_light,
        "overlayMirrored": form.overlay_mirrored,
        "overlayX": form.overlay_x,
        "overlayY": form.overlay_y,
        "overlayWidth": form.overlay_width,
        "slots": form.slots.iter().zip(&references.item_slugs).map(|(slot, item_slug)| json!({
            "itemId": item_slug,
            "x": slot.x,
            "y": slot.y,
            "width": slot.width,
        })).collect::<Vec<_>>(),
        "consumeOnEachEntry": form.consume_on_each_entry,
        "lockMinutes": form.lock_minutes,
        "sounds": {
            "notMet": { "enabled": form.sound_not_met.enabled, "soundId": references.sound_not_met_id },
            "met": { "enabled": form.sound_met.enabled, "soundId": references.sound_met_id },
            "transition": { "enabled": form.sound_transition.enabled, "soundId": references.sound_transition_id },
        },
    })
}

async fn unique_slug(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    map_asset_id: Uuid,
    form: &ItemObstacleActivityForm,
    excluded_activity_id: Option<Uuid>,
) -> Result<String, MutationError> {
    let base = form
        .slug
        .clone()
        .unwrap_or_else(|| generated_slug(&form.title));
    let mut candidate = base.clone();
    let mut suffix = 2;
    loop {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id WHERE routes.map_asset_id = $1 AND activities.slug = $2 AND ($3::uuid IS NULL OR activities.id <> $3))",
        )
        .bind(map_asset_id)
        .bind(&candidate)
        .bind(excluded_activity_id)
        .fetch_one(&mut **transaction)
        .await?;
        if !exists {
            return Ok(candidate);
        }
        if form.slug.is_some() {
            return Err(MutationError::Invalid);
        }
        candidate = format!("{base}-{suffix}");
        if candidate.len() > 140 || suffix > 10_000 {
            return Err(MutationError::Invalid);
        }
        suffix += 1;
    }
}

async fn lock_activity(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
) -> Result<Option<ScopedActivity>, sqlx::Error> {
    let Some(principal_id) = principal_id(transaction, principal).await? else {
        return Ok(None);
    };
    let Some(activity) = sqlx::query_as::<_, ScopedActivity>(
        "SELECT routes.map_asset_id, nodes.map_id, maps.created_by_principal_id AS map_creator_id, activities.slug, activities.title, activities.introduction, activities.activity_config AS config, to_char(activities.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE activities.id = $1 AND activities.activity_type = 'item_obstacle' FOR UPDATE OF activities, nodes",
    )
    .bind(activity_id)
    .fetch_optional(&mut **transaction)
    .await?
    else {
        return Ok(None);
    };
    Ok(scoped_access(
        transaction,
        principal,
        principal_id,
        activity.map_id,
        activity.map_creator_id,
    )
    .await?
    .then_some(activity))
}

async fn lock_node(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
) -> Result<Option<ScopedNode>, sqlx::Error> {
    let Some(principal_id) = principal_id(transaction, principal).await? else {
        return Ok(None);
    };
    let Some(node) = sqlx::query_as::<_, ScopedNode>(
        "SELECT nodes.map_asset_id, nodes.map_id, maps.created_by_principal_id AS map_creator_id FROM learning_nodes AS nodes INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE nodes.id = $1 FOR UPDATE OF nodes",
    )
    .bind(node_id)
    .fetch_optional(&mut **transaction)
    .await?
    else {
        return Ok(None);
    };
    Ok(scoped_access(
        transaction,
        principal,
        principal_id,
        node.map_id,
        node.map_creator_id,
    )
    .await?
    .then_some(node))
}

async fn principal_id(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(principal.subject_id)
        .fetch_optional(&mut **transaction)
        .await
}

async fn scoped_access(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    let direct_editor: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE editing_groups.map_id = $1 AND memberships.principal_id = $2)",
    )
    .bind(map_id)
    .bind(principal_id)
    .fetch_one(&mut **transaction)
    .await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(false);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && map_creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct_editor)
        || direct_editor)
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use uuid::Uuid;
    use wicked_learning_application::admin_world_item_obstacle::{
        ItemObstacleActivityForm, ItemObstacleSlot, ItemObstacleSound,
    };

    use super::{ResolvedCatalogReferences, config};

    #[test]
    fn stores_only_server_resolved_catalog_references_for_playback() {
        let form = ItemObstacleActivityForm::parse(
            "Obstacle",
            None,
            None,
            Some("/media/dark.webp"),
            None,
            false,
            None,
            None,
            false,
            None,
            None,
            false,
            50.0,
            50.0,
            30.0,
            vec![ItemObstacleSlot {
                item_id: Uuid::new_v4(),
                x: 25.0,
                y: 75.0,
                width: 12.0,
            }],
            true,
            15,
            ItemObstacleSound {
                enabled: true,
                sound_id: Some(Uuid::new_v4()),
            },
            ItemObstacleSound {
                enabled: false,
                sound_id: None,
            },
            ItemObstacleSound {
                enabled: true,
                sound_id: Some(Uuid::new_v4()),
            },
        )
        .expect("a valid source-shaped item-obstacle form");
        let references = ResolvedCatalogReferences {
            item_slugs: vec!["portal-key".to_owned()],
            sound_not_met_id: Some("00000000-0000-4000-8000-000000000058".to_owned()),
            sound_met_id: None,
            sound_transition_id: Some("00000000-0000-4000-8000-000000000059".to_owned()),
        };

        assert_eq!(
            config(&form, &references),
            json!({
                "backgroundDark": "/media/dark.webp", "backgroundLight": "", "backgroundMirrored": false,
                "metBackgroundDark": "", "metBackgroundLight": "", "metBackgroundMirrored": false,
                "overlayDark": "", "overlayLight": "", "overlayMirrored": false,
                "overlayX": 50.0, "overlayY": 50.0, "overlayWidth": 30.0,
                "slots": [{"itemId": "portal-key", "x": 25.0, "y": 75.0, "width": 12.0}],
                "consumeOnEachEntry": true, "lockMinutes": 15,
                "sounds": {
                    "notMet": {"enabled": true, "soundId": "00000000-0000-4000-8000-000000000058"},
                    "met": {"enabled": false, "soundId": null},
                    "transition": {"enabled": true, "soundId": "00000000-0000-4000-8000-000000000059"}
                }
            }),
        );
    }
}
