use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_bookmark::{
    LearnerBookmarkError, LearnerBookmarkRepository as LearnerBookmarkRepositoryPort,
    LearnerBookmarkTarget,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerBookmark, LearnerBookmarkResult},
};

use crate::public_world::load_first_visible;

pub struct PostgresLearnerBookmarkRepository<'pool> {
    pool: &'pool PgPool,
}

#[derive(FromRow)]
struct BookmarkRow {
    map_slug: String,
    node_slug: String,
}

impl<'pool> PostgresLearnerBookmarkRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl LearnerBookmarkRepositoryPort for PostgresLearnerBookmarkRepository<'_> {
    fn bookmark(
        &self,
        principal: &AuthorizedPrincipal,
        target: &LearnerBookmarkTarget,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerBookmarkResult>, LearnerBookmarkError>,
    > + Send {
        async move {
            mutate(self.pool, principal, target, true)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not save learner bookmark");
                    LearnerBookmarkError
                })
        }
    }

    fn unbookmark(
        &self,
        principal: &AuthorizedPrincipal,
        target: &LearnerBookmarkTarget,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerBookmarkResult>, LearnerBookmarkError>,
    > + Send {
        async move {
            mutate(self.pool, principal, target, false)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not remove learner bookmark");
                    LearnerBookmarkError
                })
        }
    }
}

async fn mutate(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    target: &LearnerBookmarkTarget,
    bookmarked: bool,
) -> Result<Option<LearnerBookmarkResult>, sqlx::Error> {
    let Some(visible_world) = load_first_visible(pool, &principal.roles).await? else {
        return Ok(None);
    };
    let Some(principal_id) = application_principal_id(pool, principal).await? else {
        return Ok(None);
    };
    let node_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT nodes.id FROM learning_nodes AS nodes INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE nodes.map_id = ANY($1) AND maps.slug = $2 AND nodes.slug = $3 AND nodes.published_at IS NOT NULL AND nodes.state <> 'hidden' AND NOT (nodes.visual_config @> '{\"hideEmptySpace\": true}'::jsonb) LIMIT 1",
    )
    .bind(&visible_world.map_ids)
    .bind(&target.map_slug)
    .bind(&target.node_slug)
    .fetch_optional(pool)
    .await?;
    let Some(node_id) = node_id else {
        return Ok(None);
    };

    if bookmarked {
        sqlx::query(
            "INSERT INTO learner_node_bookmarks (principal_id, node_id) VALUES ($1, $2) ON CONFLICT (principal_id, node_id) DO NOTHING",
        )
        .bind(principal_id)
        .bind(node_id)
        .execute(pool)
        .await?;
    } else {
        sqlx::query("DELETE FROM learner_node_bookmarks WHERE principal_id = $1 AND node_id = $2")
            .bind(principal_id)
            .bind(node_id)
            .execute(pool)
            .await?;
    }

    let bookmarked_nodes = sqlx::query_as::<_, BookmarkRow>(
        "SELECT maps.slug AS map_slug, nodes.slug AS node_slug FROM learner_node_bookmarks AS bookmarks INNER JOIN learning_nodes AS nodes ON nodes.id = bookmarks.node_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE bookmarks.principal_id = $1 AND nodes.map_id = ANY($2) AND nodes.published_at IS NOT NULL AND nodes.state <> 'hidden' AND NOT (nodes.visual_config @> '{\"hideEmptySpace\": true}'::jsonb) ORDER BY bookmarks.created_at ASC, maps.slug ASC, nodes.slug ASC LIMIT 500",
    )
    .bind(principal_id)
    .bind(&visible_world.map_ids)
    .fetch_all(pool)
    .await?;

    Ok(Some(LearnerBookmarkResult {
        bookmarked,
        bookmarked_nodes: bookmarked_nodes
            .into_iter()
            .map(|row| LearnerBookmark {
                map_slug: row.map_slug,
                node_slug: row.node_slug,
            })
            .collect(),
    }))
}

async fn application_principal_id(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(principal.subject_id)
        .fetch_optional(pool)
        .await
}
