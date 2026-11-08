use axum::{
    body::Body,
    extract::{Path, State},
    http::{HeaderValue, header},
    response::Response,
};
use axum_login::AuthSession;
use sqlx::FromRow;
use uuid::Uuid;
use wicked_learning_application::current_user::CurrentUserQuery;
use wicked_learning_persistence::current_user::PostgresCurrentUserRepository;

use crate::{AppState, error::ApiError, identity::IdentityBackend, media_store::MediaObjectKey};

#[derive(FromRow)]
struct StoredAsset {
    object_key: String,
    content_type: String,
}

/// Serves a reusable visual only when it is actively referenced by a published
/// authored element on a map visible through the same role policy as
/// the learner world.
pub async fn content(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
    Path(asset_id): Path<Uuid>,
) -> Result<Response, ApiError> {
    let roles = match auth_session.user {
        Some(subject) => {
            let repository = PostgresCurrentUserRepository::new(&state.application_database);
            CurrentUserQuery::new(&repository)
                .execute(subject.subject_id())
                .await
                .map_err(|_| ApiError::service_unavailable())?
                .ok_or_else(ApiError::forbidden)?
                .principal
                .roles
        }
        None => Vec::new(),
    };
    let stored = sqlx::query_as::<_, StoredAsset>(
        "SELECT media.object_key, media.content_type FROM reusable_media_assets AS media WHERE media.id = $1 AND EXISTS (SELECT 1 FROM reusable_media_asset_references AS media_references INNER JOIN learning_map_assets AS assets ON assets.id = media_references.owner_id INNER JOIN learning_maps AS maps ON maps.id = assets.map_id INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id WHERE media_references.asset_id = media.id AND media_references.owner_kind = 'map_asset' AND worlds.published_at IS NOT NULL AND maps.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) UNION SELECT 1 FROM reusable_media_asset_references AS media_references INNER JOIN learning_activity_starts AS starts ON starts.id = media_references.owner_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = starts.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id WHERE media_references.asset_id = media.id AND media_references.owner_kind = 'activity_start' AND nodes.map_asset_id = assets.id AND worlds.published_at IS NOT NULL AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) UNION SELECT 1 FROM reusable_media_asset_references AS media_references INNER JOIN learning_activities AS activities ON activities.id = media_references.owner_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id WHERE media_references.asset_id = media.id AND media_references.owner_kind = 'activity' AND worlds.published_at IS NOT NULL AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))))",
    )
    .bind(asset_id)
    .bind(&roles)
    .fetch_optional(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::not_found)?;
    let key =
        MediaObjectKey::from_stored_value(&stored.object_key).ok_or_else(ApiError::not_found)?;
    let bytes = state
        .media_store
        .get(&key)
        .await
        .map_err(|_| ApiError::not_found())?
        .bytes()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let mut response = Response::new(Body::from(bytes));
    let headers = response.headers_mut();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&stored.content_type)
            .map_err(|_| ApiError::internal_server_error())?,
    );
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static(
            "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
        ),
    );
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, max-age=300"),
    );
    Ok(response)
}
