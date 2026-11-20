use crate::{
    learner_journal::{learner_theme, load_settings},
    learner_world::load_inventory,
};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_shell::{LearnerShellError, LearnerShellRepository};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_shell::{LearnerMenuTheme, LearnerShell},
};

pub struct PostgresLearnerShellRepository<'a> {
    pool: &'a PgPool,
}
impl<'a> PostgresLearnerShellRepository<'a> {
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }
}
impl LearnerShellRepository for PostgresLearnerShellRepository<'_> {
    async fn load(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<LearnerShell>, LearnerShellError> {
        load(self.pool, principal).await.map_err(|error| {
            tracing::error!(%error, "could not load learner shell");
            LearnerShellError
        })
    }
    async fn remember_map(
        &self,
        principal: &AuthorizedPrincipal,
        reference: &str,
    ) -> Result<Option<LearnerMenuTheme>, LearnerShellError> {
        remember(self.pool, principal, reference)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not remember learner map");
                LearnerShellError
            })
    }
}

#[derive(FromRow)]
struct MenuRow {
    map_id: Uuid,
    map_slug: String,
    background_config: serde_json::Value,
}
impl From<MenuRow> for LearnerMenuTheme {
    fn from(row: MenuRow) -> Self {
        Self {
            map_id: row.map_id,
            map_slug: row.map_slug,
            background_config: row.background_config,
        }
    }
}

async fn load(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<Option<LearnerShell>, sqlx::Error> {
    let id: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
            .bind(principal.subject_id)
            .fetch_optional(pool)
            .await?;
    let Some(id) = id else {
        return Ok(None);
    };
    let (items, tools) = load_inventory(pool, id).await?;
    let (_, theme) = load_settings(pool).await?;
    // Resolve only the single preferred visible map, never the entire World
    // graph. Revoked access/drafts fall back to the first current visible map.
    let menu = sqlx::query_as::<_, MenuRow>(
        "SELECT maps.id AS map_id, maps.slug AS map_slug, maps.background_config FROM learning_maps AS maps \
         LEFT JOIN learner_map_locations AS location ON location.principal_id = $1 AND location.map_id = maps.id \
         WHERE maps.world_id = (SELECT id FROM learning_worlds WHERE published_at IS NOT NULL ORDER BY published_at, slug LIMIT 1) \
         AND maps.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS \
         (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS role(value) WHERE role.value = ANY($2))) \
         ORDER BY (location.map_id IS NOT NULL) DESC, maps.position, maps.slug LIMIT 1")
        .bind(id).bind(&principal.roles).fetch_optional(pool).await?;
    Ok(Some(LearnerShell {
        items,
        tools,
        journal_theme: learner_theme(theme),
        menu_theme: menu.map(Into::into),
    }))
}

async fn remember(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    reference: &str,
) -> Result<Option<LearnerMenuTheme>, sqlx::Error> {
    // One statement checks visibility and ownership and persists the actual
    // UUID. The client cannot nominate a different principal or bypass access.
    sqlx::query_as::<_, MenuRow>(
        "WITH target AS (SELECT maps.id AS map_id, maps.slug AS map_slug, maps.background_config, principals.id AS principal_id \
         FROM learning_maps AS maps CROSS JOIN application_principals AS principals \
         WHERE principals.identity_subject_id = $1 AND (maps.slug = $2 OR maps.id::text = $2) \
         AND maps.world_id = (SELECT id FROM learning_worlds WHERE published_at IS NOT NULL ORDER BY published_at, slug LIMIT 1) \
         AND maps.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS \
         (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS role(value) WHERE role.value = ANY($3))) LIMIT 1), \
         saved AS (INSERT INTO learner_map_locations (principal_id, map_id) SELECT principal_id, map_id FROM target \
         ON CONFLICT (principal_id) DO UPDATE SET map_id = EXCLUDED.map_id, updated_at = NOW() RETURNING map_id) \
         SELECT target.map_id, target.map_slug, target.background_config FROM target INNER JOIN saved USING (map_id)")
        .bind(principal.subject_id).bind(reference).bind(&principal.roles).fetch_optional(pool).await.map(|row| row.map(Into::into))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    #[ignore = "requires TEST_APPLICATION_DATABASE_URL pointing to the migrated local test stack"]
    async fn shell_preserves_owned_inventory_and_revalidates_preferred_map_access() {
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(1)
            .idle_timeout(None)
            .max_lifetime(None)
            .connect(&std::env::var("TEST_APPLICATION_DATABASE_URL").expect("test database URL"))
            .await
            .unwrap();
        for table in [
            "application_principals",
            "learning_worlds",
            "learning_maps",
            "learning_items",
            "learner_item_holdings",
            "learning_tools",
            "learner_tools",
            "application_journal_feedback_policy",
        ] {
            sqlx::query(&format!(
                "CREATE TEMP TABLE {table} AS SELECT * FROM public.{table} WITH NO DATA"
            ))
            .execute(&pool)
            .await
            .unwrap();
        }
        sqlx::query("CREATE TEMP TABLE learner_map_locations (LIKE public.learner_map_locations INCLUDING ALL)")
            .execute(&pool).await.unwrap();
        let principal_id = Uuid::new_v4();
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".into()],
            capabilities: vec![],
        };
        sqlx::query("INSERT INTO application_principals (id, identity_subject_id) VALUES ($1, $2)")
            .bind(principal_id)
            .bind(principal.subject_id)
            .execute(&pool)
            .await
            .unwrap();
        let item = Uuid::new_v4();
        let tool = Uuid::new_v4();
        sqlx::query("INSERT INTO learning_items (id, slug, title, config) VALUES ($1, 'item', 'Owned item', '{}')")
            .bind(item).execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO learner_item_holdings (principal_id, item_id, quantity) VALUES ($1, $2, 2)")
            .bind(principal_id).bind(item).execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO learning_tools (id, slug, title, config) VALUES ($1, 'tool', 'Owned tool', '{}')")
            .bind(tool).execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO learner_tools (principal_id, tool_id) VALUES ($1, $2)")
            .bind(principal_id)
            .bind(tool)
            .execute(&pool)
            .await
            .unwrap();
        let shell = load(&pool, &principal).await.unwrap().unwrap();
        assert_eq!(shell.items[0].id, item);
        assert_eq!(shell.items[0].quantity, 2);
        assert_eq!(shell.tools[0].id, tool);
        assert!(shell.menu_theme.is_none()); // Inventory survives an empty World.
        let world = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO learning_worlds (id, slug, published_at) VALUES ($1, 'world', NOW())",
        )
        .bind(world)
        .execute(&pool)
        .await
        .unwrap();
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        let draft = Uuid::new_v4();
        for (id, slug, position, published) in [
            (first, "first", 0_i16, true),
            (second, "second", 1_i16, true),
            (draft, "draft", 2_i16, false),
        ] {
            sqlx::query("INSERT INTO learning_maps (id, world_id, slug, position, background_config, access_roles, published_at) VALUES ($1, $2, $3, $4, '{}', '[\"public\"]', CASE WHEN $5 THEN NOW() END)")
                .bind(id).bind(world).bind(slug).bind(position).bind(published).execute(&pool).await.unwrap();
        }
        assert_eq!(
            load(&pool, &principal)
                .await
                .unwrap()
                .unwrap()
                .menu_theme
                .unwrap()
                .map_id,
            first
        );
        assert_eq!(
            remember(&pool, &principal, "second")
                .await
                .unwrap()
                .unwrap()
                .map_id,
            second
        );
        assert_eq!(
            load(&pool, &principal)
                .await
                .unwrap()
                .unwrap()
                .menu_theme
                .unwrap()
                .map_id,
            second
        );
        assert!(
            remember(&pool, &principal, "draft")
                .await
                .unwrap()
                .is_none()
        );
        sqlx::query("UPDATE learning_maps SET slug = 'renamed' WHERE id = $1")
            .bind(second)
            .execute(&pool)
            .await
            .unwrap();
        assert_eq!(
            load(&pool, &principal)
                .await
                .unwrap()
                .unwrap()
                .menu_theme
                .unwrap()
                .map_slug,
            "renamed"
        );
        sqlx::query("UPDATE learning_maps SET access_roles = $1 WHERE id = $2")
            .bind(json!(["administrator"]))
            .bind(second)
            .execute(&pool)
            .await
            .unwrap();
        assert!(
            remember(&pool, &principal, &second.to_string())
                .await
                .unwrap()
                .is_none()
        );
        assert_eq!(
            load(&pool, &principal)
                .await
                .unwrap()
                .unwrap()
                .menu_theme
                .unwrap()
                .map_id,
            first
        );
        // A different principal sees neither the saved preference nor holdings.
        let other = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".into()],
            capabilities: vec![],
        };
        sqlx::query("INSERT INTO application_principals (id, identity_subject_id) VALUES ($1, $2)")
            .bind(Uuid::new_v4())
            .bind(other.subject_id)
            .execute(&pool)
            .await
            .unwrap();
        let other_shell = load(&pool, &other).await.unwrap().unwrap();
        assert!(other_shell.items.is_empty());
        assert!(other_shell.tools.is_empty());
        assert_eq!(other_shell.menu_theme.unwrap().map_id, first);
        // An oversized inventory is not silently presented as the full list.
        sqlx::query("INSERT INTO learning_items (id, slug, title, config) SELECT md5(value::text)::uuid, 'extra-' || value, 'Extra', '{}'::jsonb FROM generate_series(1, 100) AS value").execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO learner_item_holdings (principal_id, item_id, quantity) SELECT $1, id, 1 FROM learning_items WHERE id <> $2")
            .bind(principal_id).bind(item).execute(&pool).await.unwrap();
        assert!(load(&pool, &principal).await.is_err());
        pool.close().await;
    }
}
