use serde_json::Value;
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_item_obstacle::{
    LearnerItemObstacleError, LearnerItemObstacleRepository as LearnerItemObstacleRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearnerItem, LearnerItemObstacleFilledSlot, LearnerItemObstacleResult,
        LearnerItemObstacleState,
    },
};

use crate::learner_item_grant::valid_public_slug;

pub struct PostgresLearnerItemObstacleRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerItemObstacleRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct CurrentObstacleRow {
    activity_config: Value,
    activity_id: Uuid,
    principal_id: Uuid,
}

#[derive(FromRow)]
struct StateRow {
    locked_until: Option<String>,
    is_locked: bool,
}

#[derive(FromRow)]
struct FilledSlotRow {
    item_slug: String,
    slot_index: i16,
}

#[derive(FromRow)]
struct InventoryRow {
    config: Value,
    description: Option<String>,
    image_dark: Option<String>,
    image_light: Option<String>,
    quantity: i32,
    slug: String,
    title: String,
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct ConfiguredItemObstacleSlot {
    pub item_slug: String,
    pub slot_index: i16,
    pub width: f64,
    pub x: f64,
    pub y: f64,
}

impl LearnerItemObstacleRepositoryPort for PostgresLearnerItemObstacleRepository<'_> {
    fn place_current_item(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        item_slug: &str,
        slot_index: i16,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerItemObstacleResult>, LearnerItemObstacleError>,
    > + Send {
        async move {
            place_current_item(
                self.pool,
                principal,
                play_run_id,
                activity_slug,
                item_slug,
                slot_index,
            )
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not place a learner item-obstacle slot");
                LearnerItemObstacleError
            })
        }
    }

    fn continue_current_obstacle(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerItemObstacleResult>, LearnerItemObstacleError>,
    > + Send {
        async move {
            continue_current_obstacle(self.pool, principal, play_run_id, activity_slug)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not continue a learner item obstacle");
                    LearnerItemObstacleError
                })
        }
    }
}

async fn place_current_item(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
    item_slug: &str,
    slot_index: i16,
) -> Result<Option<LearnerItemObstacleResult>, sqlx::Error> {
    if !valid_public_slug(item_slug) || !(0..=9).contains(&slot_index) {
        return Ok(None);
    }
    let mut transaction = pool.begin().await?;
    let Some(current) =
        load_current_obstacle_for_update(&mut transaction, principal, play_run_id, activity_slug)
            .await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let slots = configured_slots(&current.activity_config);
    let Some(expected) = slots.iter().find(|slot| slot.slot_index == slot_index) else {
        transaction.commit().await?;
        return Ok(None);
    };
    if expected.item_slug != item_slug {
        transaction.commit().await?;
        return Ok(None);
    }
    let state =
        ensure_state_for_update(&mut transaction, current.principal_id, current.activity_id)
            .await?;
    if state.is_locked {
        transaction.commit().await?;
        return Ok(None);
    }
    let already_filled = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learner_item_obstacle_slots WHERE principal_id = $1 AND activity_id = $2 AND slot_index = $3)",
    )
    .bind(current.principal_id)
    .bind(current.activity_id)
    .bind(slot_index)
    .fetch_one(&mut *transaction)
    .await?;
    if !already_filled {
        let item_id =
            sqlx::query_scalar::<_, Uuid>("SELECT id FROM learning_items WHERE slug = $1")
                .bind(item_slug)
                .fetch_optional(&mut *transaction)
                .await?;
        let Some(item_id) = item_id else {
            transaction.commit().await?;
            return Ok(None);
        };
        let consumed = sqlx::query_scalar::<_, Uuid>(
            "UPDATE learner_item_holdings SET quantity = quantity - 1, updated_at = NOW() WHERE principal_id = $1 AND item_id = $2 AND quantity > 0 RETURNING item_id",
        )
        .bind(current.principal_id)
        .bind(item_id)
        .fetch_optional(&mut *transaction)
        .await?;
        if consumed.is_none() {
            transaction.commit().await?;
            return Ok(None);
        }
        sqlx::query(
            "INSERT INTO learner_item_obstacle_slots (principal_id, activity_id, slot_index, item_id) VALUES ($1, $2, $3, $4)",
        )
        .bind(current.principal_id)
        .bind(current.activity_id)
        .bind(slot_index)
        .bind(item_id)
        .execute(&mut *transaction)
        .await?;
        sqlx::query(
            "UPDATE learner_item_obstacle_states SET passed_play_run_id = NULL, updated_at = NOW() WHERE principal_id = $1 AND activity_id = $2",
        )
        .bind(current.principal_id)
        .bind(current.activity_id)
        .execute(&mut *transaction)
        .await?;
    }
    let result = result_for_state(
        &mut transaction,
        current.principal_id,
        current.activity_id,
        &slots,
        None,
    )
    .await?;
    transaction.commit().await?;
    Ok(Some(result))
}

async fn continue_current_obstacle(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<LearnerItemObstacleResult>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(current) =
        load_current_obstacle_for_update(&mut transaction, principal, play_run_id, activity_slug)
            .await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let slots = configured_slots(&current.activity_config);
    let state =
        ensure_state_for_update(&mut transaction, current.principal_id, current.activity_id)
            .await?;
    if state.is_locked {
        transaction.commit().await?;
        return Ok(None);
    }
    let filled_slots =
        load_filled_slots(&mut transaction, current.principal_id, current.activity_id).await?;
    let met = conditions_met(&slots, &filled_slots);
    if met {
        sqlx::query(
            "UPDATE learner_item_obstacle_states SET passed_play_run_id = $3, updated_at = NOW() WHERE principal_id = $1 AND activity_id = $2",
        )
        .bind(current.principal_id)
        .bind(current.activity_id)
        .bind(play_run_id)
        .execute(&mut *transaction)
        .await?;
        if consume_on_each_entry(&current.activity_config) {
            sqlx::query(
                "DELETE FROM learner_item_obstacle_slots WHERE principal_id = $1 AND activity_id = $2",
            )
            .bind(current.principal_id)
            .bind(current.activity_id)
            .execute(&mut *transaction)
            .await?;
        }
        let result = result_for_state(
            &mut transaction,
            current.principal_id,
            current.activity_id,
            &slots,
            Some(true),
        )
        .await?;
        transaction.commit().await?;
        return Ok(Some(result));
    }

    let lock_minutes = lock_minutes(&current.activity_config);
    sqlx::query(
        "UPDATE learner_item_obstacle_states SET failed_attempts = failed_attempts + 1, locked_until = CASE WHEN $3 > 0 THEN NOW() + ($3::text || ' minutes')::interval ELSE locked_until END, updated_at = NOW() WHERE principal_id = $1 AND activity_id = $2",
    )
    .bind(current.principal_id)
    .bind(current.activity_id)
    .bind(lock_minutes)
    .execute(&mut *transaction)
    .await?;
    let result = result_for_state(
        &mut transaction,
        current.principal_id,
        current.activity_id,
        &slots,
        Some(false),
    )
    .await?;
    transaction.commit().await?;
    Ok(Some(result))
}

async fn load_current_obstacle_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<CurrentObstacleRow>, sqlx::Error> {
    let route = sqlx::query_as::<_, CurrentObstacleRow>(
        "SELECT activities.activity_config, activities.id AS activity_id, progress.principal_id FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'item_obstacle' AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF progress",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await?;
    if route.is_some() {
        return Ok(route);
    }

    sqlx::query_as::<_, CurrentObstacleRow>(
        "SELECT activities.activity_config, activities.id AS activity_id, runs.principal_id FROM learner_activity_replay_runs AS runs INNER JOIN application_principals AS principals ON principals.id = runs.principal_id INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'item_obstacle' AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF runs",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await
}

async fn ensure_state_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
) -> Result<StateRow, sqlx::Error> {
    sqlx::query(
        "INSERT INTO learner_item_obstacle_states (principal_id, activity_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    )
    .bind(principal_id)
    .bind(activity_id)
    .execute(&mut **transaction)
    .await?;
    sqlx::query_as::<_, StateRow>(
        "SELECT to_char(locked_until AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS locked_until, COALESCE(locked_until > NOW(), FALSE) AS is_locked FROM learner_item_obstacle_states WHERE principal_id = $1 AND activity_id = $2 FOR UPDATE",
    )
    .bind(principal_id)
    .bind(activity_id)
    .fetch_one(&mut **transaction)
    .await
}

async fn load_filled_slots(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
) -> Result<Vec<FilledSlotRow>, sqlx::Error> {
    sqlx::query_as::<_, FilledSlotRow>(
        "SELECT items.slug AS item_slug, slots.slot_index FROM learner_item_obstacle_slots AS slots INNER JOIN learning_items AS items ON items.id = slots.item_id WHERE slots.principal_id = $1 AND slots.activity_id = $2 ORDER BY slots.slot_index ASC",
    )
    .bind(principal_id)
    .bind(activity_id)
    .fetch_all(&mut **transaction)
    .await
}

async fn result_for_state(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
    slots: &[ConfiguredItemObstacleSlot],
    can_continue: Option<bool>,
) -> Result<LearnerItemObstacleResult, sqlx::Error> {
    let state = ensure_state_for_update(transaction, principal_id, activity_id).await?;
    let filled_slots = load_filled_slots(transaction, principal_id, activity_id).await?;
    let inventory = load_inventory(transaction, principal_id).await?;
    Ok(LearnerItemObstacleResult {
        inventory,
        state: LearnerItemObstacleState {
            can_continue,
            conditions_met: conditions_met(slots, &filled_slots),
            filled_slots: filled_slots
                .into_iter()
                .map(|slot| LearnerItemObstacleFilledSlot {
                    item_slug: slot.item_slug,
                    slot_index: slot.slot_index,
                })
                .collect(),
            locked_until: state.locked_until,
        },
    })
}

pub(crate) async fn load_inventory(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
) -> Result<Vec<LearnerItem>, sqlx::Error> {
    sqlx::query_as::<_, InventoryRow>(
        "SELECT items.config, items.description, items.image_dark, items.image_light, holdings.quantity, items.slug, items.title FROM learner_item_holdings AS holdings INNER JOIN learning_items AS items ON items.id = holdings.item_id WHERE holdings.principal_id = $1 AND holdings.quantity > 0 ORDER BY holdings.acquired_at ASC NULLS LAST, items.slug ASC LIMIT 100",
    )
    .bind(principal_id)
    .fetch_all(&mut **transaction)
    .await
    .map(|items| {
        items
            .into_iter()
            .map(|item| LearnerItem {
                config: item.config,
                description: item.description,
                image_dark: item.image_dark,
                image_light: item.image_light,
                quantity: item.quantity,
                slug: item.slug,
                title: item.title,
            })
            .collect()
    })
}

/// Reads the durable source obstacle state without creating it. Playback GET
/// requests remain read-only; the first interaction initializes the row.
pub(crate) async fn load_state(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
    slots: &[ConfiguredItemObstacleSlot],
) -> Result<LearnerItemObstacleState, sqlx::Error> {
    #[derive(FromRow)]
    struct ReadStateRow {
        locked_until: Option<String>,
    }

    let state = sqlx::query_as::<_, ReadStateRow>(
        "SELECT to_char(locked_until AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS locked_until FROM learner_item_obstacle_states WHERE principal_id = $1 AND activity_id = $2",
    )
    .bind(principal_id)
    .bind(activity_id)
    .fetch_optional(&mut **transaction)
    .await?;
    let filled_slots = load_filled_slots(transaction, principal_id, activity_id).await?;

    Ok(LearnerItemObstacleState {
        can_continue: None,
        conditions_met: conditions_met(slots, &filled_slots),
        filled_slots: filled_slots
            .into_iter()
            .map(|slot| LearnerItemObstacleFilledSlot {
                item_slug: slot.item_slug,
                slot_index: slot.slot_index,
            })
            .collect(),
        locked_until: state.and_then(|state| state.locked_until),
    })
}

pub(crate) fn configured_slots(config: &Value) -> Vec<ConfiguredItemObstacleSlot> {
    config
        .get("slots")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .take(10)
        .enumerate()
        .filter_map(|(index, slot)| {
            let object = slot.as_object()?;
            let item_slug = object.get("itemId")?.as_str()?.trim();
            if !valid_public_slug(item_slug) {
                return None;
            }
            Some(ConfiguredItemObstacleSlot {
                item_slug: item_slug.to_owned(),
                slot_index: index as i16,
                width: bounded_number(object.get("width"), 10.0, 3.0, 60.0)?,
                x: bounded_number(object.get("x"), 50.0, 0.0, 100.0)?,
                y: bounded_number(object.get("y"), 50.0, 0.0, 100.0)?,
            })
        })
        .collect()
}

fn bounded_number(value: Option<&Value>, fallback: f64, minimum: f64, maximum: f64) -> Option<f64> {
    let value = value.map_or(Some(fallback), Value::as_f64)?;
    (value.is_finite() && (minimum..=maximum).contains(&value)).then_some(value)
}

fn conditions_met(slots: &[ConfiguredItemObstacleSlot], filled_slots: &[FilledSlotRow]) -> bool {
    !slots.is_empty()
        && slots.iter().all(|slot| {
            filled_slots.iter().any(|filled| {
                filled.slot_index == slot.slot_index && filled.item_slug == slot.item_slug
            })
        })
}

fn consume_on_each_entry(config: &Value) -> bool {
    config
        .get("consumeOnEachEntry")
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn lock_minutes(config: &Value) -> i32 {
    config
        .get("lockMinutes")
        .and_then(Value::as_i64)
        .and_then(|value| i32::try_from(value).ok())
        .filter(|value| (0..=10_080).contains(value))
        .unwrap_or(0)
}

pub(crate) async fn item_obstacle_passed_for_run(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
    play_run_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learner_item_obstacle_states WHERE principal_id = $1 AND activity_id = $2 AND passed_play_run_id = $3)",
    )
    .bind(principal_id)
    .bind(activity_id)
    .bind(play_run_id)
    .fetch_one(&mut **transaction)
    .await
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::configured_slots;

    #[test]
    fn retains_only_bounded_public_slots() {
        let slots = configured_slots(&json!({
            "slots": [
                { "itemId": "portal-key", "x": 25, "y": 75, "width": 12 },
                { "itemId": 4 },
                { "itemId": "invalid-slug", "x": 101 }
            ]
        }));
        assert_eq!(slots.len(), 1);
        assert_eq!(slots[0].item_slug, "portal-key");
        assert_eq!(slots[0].slot_index, 0);
    }
}
