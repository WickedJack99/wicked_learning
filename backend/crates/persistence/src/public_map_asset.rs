use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::public_map_asset::{
    PublicMapAssetReadError, PublicMapAssetRepository as PublicMapAssetRepositoryPort,
};
use wicked_learning_domain::world_content::{PublicMapAssetDetail, PublicRoutePreview};

const MAX_ROUTE_PREVIEWS: i64 = 12;

pub struct PostgresPublicMapAssetRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresPublicMapAssetRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl PublicMapAssetRepositoryPort for PostgresPublicMapAssetRepository<'_> {
    fn load_published_focusable(
        &self,
        world_slug: &str,
        map_slug: &str,
        asset_slug: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<PublicMapAssetDetail>, PublicMapAssetReadError>,
    > + Send {
        async move {
            load_published_focusable(self.pool, world_slug, map_slug, asset_slug)
                .await
                .map_err(|_| PublicMapAssetReadError)
        }
    }
}

#[derive(FromRow)]
struct MapAssetDetailRow {
    id: Uuid,
    world_slug: String,
    world_title: String,
    map_slug: String,
    map_title: String,
    slug: String,
    title: String,
    description: String,
}

#[derive(FromRow)]
struct RoutePreviewRow {
    slug: String,
    title: String,
    description: String,
    activity_count: i64,
}

async fn load_published_focusable(
    pool: &PgPool,
    world_slug: &str,
    map_slug: &str,
    asset_slug: &str,
) -> Result<Option<PublicMapAssetDetail>, sqlx::Error> {
    let Some(asset) = sqlx::query_as::<_, MapAssetDetailRow>(
        r#"
            SELECT
                assets.id,
                worlds.slug AS world_slug,
                worlds.title AS world_title,
                maps.slug AS map_slug,
                maps.title AS map_title,
                assets.slug,
                assets.title,
                assets.description
            FROM learning_map_assets AS assets
            INNER JOIN learning_maps AS maps ON maps.id = assets.map_id
            INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id
            WHERE worlds.slug = $1
                AND worlds.published_at IS NOT NULL
                AND maps.slug = $2
                AND maps.published_at IS NOT NULL
                AND assets.slug = $3
                AND assets.published_at IS NOT NULL
                AND assets.interaction_mode = 'focusable'
        "#,
    )
    .bind(world_slug)
    .bind(map_slug)
    .bind(asset_slug)
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };

    let routes = sqlx::query_as::<_, RoutePreviewRow>(
        r#"
            SELECT
                routes.slug,
                routes.title,
                routes.description,
                COUNT(activities.id) AS activity_count
            FROM learning_routes AS routes
            LEFT JOIN learning_activities AS activities
                ON activities.route_id = routes.id
                AND activities.published_at IS NOT NULL
            WHERE routes.map_asset_id = $1 AND routes.published_at IS NOT NULL
            GROUP BY routes.id
            ORDER BY routes.position ASC, routes.slug ASC
            LIMIT $2
        "#,
    )
    .bind(asset.id)
    .bind(MAX_ROUTE_PREVIEWS)
    .fetch_all(pool)
    .await?;

    Ok(Some(PublicMapAssetDetail {
        world_slug: asset.world_slug,
        world_title: asset.world_title,
        map_slug: asset.map_slug,
        map_title: asset.map_title,
        slug: asset.slug,
        title: asset.title,
        description: asset.description,
        routes: routes
            .into_iter()
            .map(|route| PublicRoutePreview {
                slug: route.slug,
                title: route.title,
                description: route.description,
                activity_count: route.activity_count,
            })
            .collect(),
    }))
}
