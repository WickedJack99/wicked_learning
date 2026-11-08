use std::collections::HashMap;

use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;
use wicked_learning_application::{
    admin_world_import::{
        AdminWorldImportError, AdminWorldImportRepository as Port, ImportedWorld,
    },
    admin_world_map_create::CreateWorldMapForm,
};
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

use crate::admin_world_map_import::{import_deferred_portals, import_map_in_transaction};

pub struct PostgresAdminWorldImportRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldImportRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldImportRepository<'_> {
    fn import_world(
        &self,
        principal: &AuthorizedPrincipal,
        manifest: &Value,
    ) -> impl std::future::Future<Output = Result<Option<ImportedWorld>, AdminWorldImportError>> + Send
    {
        async move {
            import_world(self.pool, principal, manifest)
                .await
                .map_err(|error| {
                    if matches!(error, sqlx::Error::Protocol(_)) {
                        AdminWorldImportError::Invalid
                    } else {
                        tracing::error!(%error, "could not import World Builder world manifest");
                        AdminWorldImportError::Unavailable
                    }
                })
        }
    }
}

async fn import_world(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    manifest: &Value,
) -> Result<Option<ImportedWorld>, sqlx::Error> {
    let Some(maps) = manifest.get("maps").and_then(Value::as_array) else {
        return Ok(None);
    };
    let Some(source_world_slug) = manifest
        .get("world")
        .and_then(Value::as_object)
        .and_then(|world| world.get("slug"))
        .and_then(Value::as_str)
    else {
        return Ok(None);
    };
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
    if source_world_slug != world_slug {
        return Err(sqlx::Error::Protocol(
            "world bundle does not match the current workspace".to_owned(),
        ));
    }

    let mut source_payloads = Vec::with_capacity(maps.len());
    let mut destination_slugs = HashMap::with_capacity(maps.len());
    let mut map_ids = Vec::with_capacity(maps.len());
    for map in maps {
        let Some(map_details) = map.get("map").and_then(Value::as_object) else {
            return Ok(None);
        };
        let Some(source_slug) = map_details.get("slug").and_then(Value::as_str) else {
            return Ok(None);
        };
        let title = map_details
            .get("title")
            .and_then(Value::as_str)
            .unwrap_or(source_slug);
        let Some(form) = CreateWorldMapForm::parse(title, None, None) else {
            return Ok(None);
        };
        let Some(map_id) = import_map_in_transaction(
            &mut transaction,
            principal_id,
            world_id,
            &world_slug,
            &form,
            map,
            false,
        )
        .await?
        else {
            return Ok(None);
        };
        let destination_slug: String =
            sqlx::query_scalar("SELECT slug FROM learning_maps WHERE id = $1")
                .bind(map_id)
                .fetch_one(&mut *transaction)
                .await?;
        destination_slugs.insert(source_slug.to_owned(), destination_slug.clone());
        source_payloads.push((source_slug.to_owned(), destination_slug, map));
        map_ids.push(map_id);
    }
    for (source_slug, destination_slug, map) in source_payloads {
        import_deferred_portals(
            &mut transaction,
            map,
            world_id,
            &source_slug,
            &destination_slug,
            &destination_slugs,
        )
        .await?;
    }
    transaction.commit().await?;
    Ok(Some(ImportedWorld { map_ids }))
}
