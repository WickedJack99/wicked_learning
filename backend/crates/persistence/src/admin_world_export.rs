use serde_json::{Value, json};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_world_export::{
    AdminWorldExportError, AdminWorldExportRepository as Port, ExportedWorld,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

use crate::admin_world_map_export::{collect_media_urls, export_map_payload, exported_at};

pub struct PostgresAdminWorldExportRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldExportRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldExportRepository<'_> {
    fn export_world(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl std::future::Future<Output = Result<Option<ExportedWorld>, AdminWorldExportError>> + Send
    {
        async move {
            export_world(self.pool, principal).await.map_err(|error| {
                tracing::error!(%error, "could not export scoped World Builder world");
                AdminWorldExportError
            })
        }
    }
}

#[derive(FromRow)]
struct WorldRow {
    id: Uuid,
    slug: String,
    title: String,
    description: String,
}

async fn export_world(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<Option<ExportedWorld>, sqlx::Error> {
    let Some(world) = sqlx::query_as::<_, WorldRow>(
        "SELECT id, slug, title, description FROM learning_worlds ORDER BY created_at ASC, slug ASC LIMIT 1",
    )
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };

    let map_ids = scoped_map_ids(pool, world.id, principal).await?;
    let mut maps = Vec::with_capacity(map_ids.len());
    for map_id in map_ids {
        if let Some(map) = export_map_payload(pool, map_id).await? {
            maps.push(map);
        }
    }
    let media_urls = collect_media_urls(&Value::Array(maps.clone()));
    let payload = json!({
        "format": "wicked-learning-world",
        "formatVersion": 1,
        "exportedAt": exported_at(),
        "world": {
            "slug": world.slug,
            "title": world.title,
            "description": world.description,
        },
        "maps": maps,
        "references": {"mediaUrls": media_urls},
    });

    Ok(Some(ExportedWorld {
        filename: format!(
            "{}-wicked-learning-world.json",
            payload["world"]["slug"].as_str().unwrap_or("world")
        ),
        payload,
    }))
}

async fn scoped_map_ids(
    pool: &PgPool,
    world_id: Uuid,
    principal: &AuthorizedPrincipal,
) -> Result<Vec<Uuid>, sqlx::Error> {
    let world_map_scope = principal.permission_scope("world_maps", "ru");
    if world_map_scope.is_some_and(|scope| scope == "all") {
        return sqlx::query_scalar(
            "SELECT id FROM learning_maps WHERE world_id = $1 ORDER BY id ASC",
        )
        .bind(world_id)
        .fetch_all(pool)
        .await;
    }

    let Some(principal_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(pool)
    .await?
    else {
        return Ok(vec![]);
    };
    let can_edit_own = world_map_scope.is_some_and(|scope| permission_scope_allows(scope, "own"));

    // This is intentionally the narrower source `scopeMapsUserCanEdit()`
    // boundary for transferable maps, rather than the broader overview scope.
    sqlx::query_scalar(
        "SELECT maps.id FROM learning_maps AS maps WHERE maps.world_id = $1 AND (($2 AND maps.created_by_principal_id = $3) OR EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE editing_groups.map_id = maps.id AND memberships.principal_id = $3)) ORDER BY maps.id ASC",
    )
    .bind(world_id)
    .bind(can_edit_own)
    .bind(principal_id)
    .fetch_all(pool)
    .await
}
