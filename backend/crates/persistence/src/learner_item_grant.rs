use std::collections::HashMap;

use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_item_grant::{
    LearnerItemGrantError, LearnerItemGrantRepository as LearnerItemGrantRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerItemGrantDisplay, LearnerItemGrantResult},
};

pub struct PostgresLearnerItemGrantRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerItemGrantRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct CurrentItemGrantRow {
    activity_config: Value,
    activity_id: Uuid,
    principal_id: Uuid,
}

#[derive(FromRow)]
struct ItemRow {
    id: Uuid,
    image_dark: Option<String>,
    image_light: Option<String>,
    slug: String,
    title: String,
}

#[derive(FromRow)]
struct StoredGrantRow {
    granted_items: Value,
    success: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct ConfiguredItemGrant {
    pub quantity: i32,
    pub slug: String,
}

impl LearnerItemGrantRepositoryPort for PostgresLearnerItemGrantRepository<'_> {
    fn roll_current_items(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerItemGrantResult>, LearnerItemGrantError>,
    > + Send {
        async move {
            roll_current_items(self.pool, principal, play_run_id, activity_slug)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not roll the current learner item grant");
                    LearnerItemGrantError
                })
        }
    }
}

async fn roll_current_items(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<LearnerItemGrantResult>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(current) =
        load_current_item_grant_for_update(&mut transaction, principal, play_run_id, activity_slug)
            .await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };

    if let Some(stored) = load_stored_grant(&mut transaction, &current, play_run_id).await? {
        let items = serde_json::from_value(stored.granted_items).unwrap_or_default();
        transaction.commit().await?;
        return Ok(Some(LearnerItemGrantResult {
            items,
            success: stored.success,
        }));
    }

    let configured_items = configured_item_grants(&current.activity_config);
    let chance_basis_points = configured_chance_basis_points(&current.activity_config);
    let roll = sqlx::query_scalar::<_, i32>("SELECT floor(random() * 10000)::INTEGER + 1")
        .fetch_one(&mut *transaction)
        .await?;
    let success = roll <= chance_basis_points;
    let items = if success {
        grant_configured_items(&mut transaction, current.principal_id, &configured_items).await?
    } else {
        Vec::new()
    };
    let serialized_items = serde_json::to_value(&items).unwrap_or_else(|_| json!([]));

    sqlx::query(
        "INSERT INTO learner_item_grants (principal_id, activity_id, play_run_id, roll, chance_basis_points, success, granted_items) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(current.principal_id)
    .bind(current.activity_id)
    .bind(play_run_id)
    .bind(roll)
    .bind(chance_basis_points)
    .bind(success)
    .bind(serialized_items)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;

    Ok(Some(LearnerItemGrantResult { items, success }))
}

async fn load_current_item_grant_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<CurrentItemGrantRow>, sqlx::Error> {
    sqlx::query_as::<_, CurrentItemGrantRow>(
        "SELECT activities.activity_config, activities.id AS activity_id, progress.principal_id FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'item_grant' AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF progress",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await
}

async fn load_stored_grant(
    transaction: &mut Transaction<'_, Postgres>,
    current: &CurrentItemGrantRow,
    play_run_id: Uuid,
) -> Result<Option<StoredGrantRow>, sqlx::Error> {
    sqlx::query_as::<_, StoredGrantRow>(
        "SELECT granted_items, success FROM learner_item_grants WHERE principal_id = $1 AND activity_id = $2 AND play_run_id = $3",
    )
    .bind(current.principal_id)
    .bind(current.activity_id)
    .bind(play_run_id)
    .fetch_optional(&mut **transaction)
    .await
}

async fn grant_configured_items(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    configured_items: &[ConfiguredItemGrant],
) -> Result<Vec<LearnerItemGrantDisplay>, sqlx::Error> {
    let slugs = configured_items
        .iter()
        .map(|item| item.slug.as_str())
        .collect::<Vec<_>>();
    let rows = sqlx::query_as::<_, ItemRow>(
        "SELECT id, image_dark, image_light, slug, title FROM learning_items WHERE slug = ANY($1)",
    )
    .bind(&slugs)
    .fetch_all(&mut **transaction)
    .await?;
    let items_by_slug = rows
        .into_iter()
        .map(|item| (item.slug.clone(), item))
        .collect::<HashMap<_, _>>();
    let mut display = Vec::new();

    for configured in configured_items {
        let Some(item) = items_by_slug.get(&configured.slug) else {
            continue;
        };
        sqlx::query(
            "INSERT INTO learner_item_holdings (principal_id, item_id, quantity, acquired_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (principal_id, item_id) DO UPDATE SET quantity = learner_item_holdings.quantity + EXCLUDED.quantity, acquired_at = COALESCE(learner_item_holdings.acquired_at, EXCLUDED.acquired_at), updated_at = NOW()",
        )
        .bind(principal_id)
        .bind(item.id)
        .bind(configured.quantity)
        .execute(&mut **transaction)
        .await?;
        display.push(LearnerItemGrantDisplay {
            image_dark: item.image_dark.clone(),
            image_light: item.image_light.clone(),
            quantity: configured.quantity,
            slug: item.slug.clone(),
            title: item.title.clone(),
        });
    }

    Ok(display)
}

pub(crate) fn configured_item_grants(config: &Value) -> Vec<ConfiguredItemGrant> {
    let Some(items) = config.get("items").and_then(Value::as_array) else {
        return Vec::new();
    };

    items
        .iter()
        .take(100)
        .filter_map(|item| {
            let object = item.as_object()?;
            let slug = object.get("itemId")?.as_str()?.trim();
            valid_public_slug(slug).then(|| ConfiguredItemGrant {
                quantity: object
                    .get("quantity")
                    .and_then(Value::as_i64)
                    .and_then(|quantity| i32::try_from(quantity).ok())
                    .filter(|quantity| (1..=999).contains(quantity))
                    .unwrap_or(1),
                slug: slug.to_owned(),
            })
        })
        .collect()
}

pub(crate) fn configured_chance_basis_points(config: &Value) -> i32 {
    let probability = config
        .get("probabilityPercent")
        .and_then(Value::as_f64)
        .filter(|value| value.is_finite())
        .unwrap_or(100.0)
        .clamp(0.01, 100.0);

    (probability * 100.0).round() as i32
}

pub(crate) fn valid_public_slug(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 80
        && value.bytes().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == b'-'
        })
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{configured_chance_basis_points, configured_item_grants};

    #[test]
    fn accepts_only_bounded_public_item_references() {
        let items = configured_item_grants(&json!({
            "items": [
                { "itemId": "portal-key", "quantity": 3 },
                { "itemId": 12, "quantity": 2 },
                { "itemId": "Portal-key", "quantity": 1 },
                { "itemId": "default-quantity" }
            ]
        }));

        assert_eq!(items.len(), 2);
        assert_eq!(items[0].slug, "portal-key");
        assert_eq!(items[0].quantity, 3);
        assert_eq!(items[1].slug, "default-quantity");
        assert_eq!(items[1].quantity, 1);
    }

    #[test]
    fn bounds_the_source_probability_to_basis_points() {
        assert_eq!(
            configured_chance_basis_points(&json!({ "probabilityPercent": 72.5 })),
            7_250
        );
        assert_eq!(
            configured_chance_basis_points(&json!({ "probabilityPercent": 0 })),
            1
        );
        assert_eq!(configured_chance_basis_points(&json!({})), 10_000);
    }
}
