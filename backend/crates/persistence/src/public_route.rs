use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::public_route::{
    PublicRouteReadError, PublicRouteRepository as PublicRouteRepositoryPort,
};
use wicked_learning_domain::world_content::{PublicActivityOutline, PublicRouteOutline};

const MAX_ACTIVITY_OUTLINES: i64 = 24;

pub struct PostgresPublicRouteRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresPublicRouteRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl PublicRouteRepositoryPort for PostgresPublicRouteRepository<'_> {
    fn load_published_outline(
        &self,
        world_slug: &str,
        map_slug: &str,
        asset_slug: &str,
        route_slug: &str,
    ) -> impl std::future::Future<Output = Result<Option<PublicRouteOutline>, PublicRouteReadError>> + Send
    {
        async move {
            load_published_outline(self.pool, world_slug, map_slug, asset_slug, route_slug)
                .await
                .map_err(|_| PublicRouteReadError)
        }
    }
}

#[derive(FromRow)]
struct RouteOutlineRow {
    id: Uuid,
    world_slug: String,
    world_title: String,
    map_slug: String,
    map_title: String,
    asset_slug: String,
    asset_title: String,
    slug: String,
    title: String,
    description: String,
}

#[derive(FromRow)]
struct ActivityOutlineRow {
    slug: String,
    title: String,
    description: String,
}

async fn load_published_outline(
    pool: &PgPool,
    world_slug: &str,
    map_slug: &str,
    asset_slug: &str,
    route_slug: &str,
) -> Result<Option<PublicRouteOutline>, sqlx::Error> {
    let Some(route) = sqlx::query_as::<_, RouteOutlineRow>(
        r#"
            SELECT
                routes.id,
                worlds.slug AS world_slug,
                worlds.title AS world_title,
                maps.slug AS map_slug,
                maps.title AS map_title,
                assets.slug AS asset_slug,
                assets.title AS asset_title,
                routes.slug,
                routes.title,
                routes.description
            FROM learning_routes AS routes
            INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id
            INNER JOIN learning_maps AS maps ON maps.id = assets.map_id
            INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id
            WHERE worlds.slug = $1
                AND worlds.published_at IS NOT NULL
                AND maps.slug = $2
                AND maps.published_at IS NOT NULL
                AND assets.slug = $3
                AND assets.published_at IS NOT NULL
                AND assets.interaction_mode = 'focusable'
                AND routes.slug = $4
                AND routes.published_at IS NOT NULL
        "#,
    )
    .bind(world_slug)
    .bind(map_slug)
    .bind(asset_slug)
    .bind(route_slug)
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };

    let activities = sqlx::query_as::<_, ActivityOutlineRow>(
        r#"
            SELECT slug, title, description
            FROM learning_activities
            WHERE route_id = $1 AND published_at IS NOT NULL
            ORDER BY position ASC, slug ASC
            LIMIT $2
        "#,
    )
    .bind(route.id)
    .bind(MAX_ACTIVITY_OUTLINES)
    .fetch_all(pool)
    .await?;

    Ok(Some(PublicRouteOutline {
        world_slug: route.world_slug,
        world_title: route.world_title,
        map_slug: route.map_slug,
        map_title: route.map_title,
        asset_slug: route.asset_slug,
        asset_title: route.asset_title,
        slug: route.slug,
        title: route.title,
        description: route.description,
        activities: activities
            .into_iter()
            .map(|activity| PublicActivityOutline {
                slug: activity.slug,
                title: activity.title,
                description: activity.description,
            })
            .collect(),
    }))
}
