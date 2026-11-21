use axum::{
    body::Body,
    extract::{Path, State},
    http::{HeaderMap, HeaderValue, header},
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
/// authored element visible through the same role policy as the learner world,
/// by the platform-owned Journal presentation for an authenticated learner,
/// or by an item/tool currently held by this principal.
pub async fn content(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
    Path(asset_id): Path<Uuid>,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    let subject_id = auth_session
        .user
        .as_ref()
        .map(|subject| subject.subject_id());
    let authenticated = subject_id.is_some();
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
        "SELECT media.object_key, media.content_type FROM reusable_media_assets AS media WHERE media.id = $1 AND EXISTS (SELECT 1 FROM reusable_media_asset_references AS media_references INNER JOIN learning_map_assets AS assets ON assets.id = media_references.owner_id INNER JOIN learning_maps AS maps ON maps.id = assets.map_id INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id WHERE media_references.asset_id = media.id AND media_references.owner_kind = 'map_asset' AND worlds.published_at IS NOT NULL AND maps.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) UNION SELECT 1 FROM reusable_media_asset_references AS media_references INNER JOIN learning_maps AS maps ON maps.id = media_references.owner_id INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id WHERE media_references.asset_id = media.id AND media_references.owner_kind = 'map' AND worlds.published_at IS NOT NULL AND maps.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) UNION SELECT 1 FROM reusable_media_asset_references AS media_references INNER JOIN learning_nodes AS nodes ON nodes.id = media_references.owner_id INNER JOIN learning_map_assets AS assets ON assets.id = nodes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id WHERE media_references.asset_id = media.id AND media_references.owner_kind = 'node' AND worlds.published_at IS NOT NULL AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) UNION SELECT 1 FROM reusable_media_asset_references AS media_references INNER JOIN learning_activity_starts AS starts ON starts.id = media_references.owner_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = starts.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id WHERE media_references.asset_id = media.id AND media_references.owner_kind = 'activity_start' AND nodes.map_asset_id = assets.id AND worlds.published_at IS NOT NULL AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) UNION SELECT 1 FROM reusable_media_asset_references AS media_references INNER JOIN learning_activities AS activities ON activities.id = media_references.owner_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id WHERE media_references.asset_id = media.id AND media_references.owner_kind = 'activity' AND worlds.published_at IS NOT NULL AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) UNION SELECT 1 FROM reusable_media_asset_references AS media_references WHERE media_references.asset_id = media.id AND media_references.owner_kind = 'journal_presentation' AND $3::boolean UNION SELECT 1 FROM reusable_media_asset_references AS media_references INNER JOIN learner_item_holdings AS holdings ON holdings.item_id = media_references.owner_id INNER JOIN application_principals AS principals ON principals.id = holdings.principal_id WHERE media_references.asset_id = media.id AND media_references.owner_kind = 'learning_item' AND holdings.quantity > 0 AND principals.identity_subject_id = $4 UNION SELECT 1 FROM reusable_media_asset_references AS media_references INNER JOIN learner_tools AS holdings ON holdings.tool_id = media_references.owner_id INNER JOIN application_principals AS principals ON principals.id = holdings.principal_id WHERE media_references.asset_id = media.id AND media_references.owner_kind = 'learning_tool' AND principals.identity_subject_id = $4)",
    )
    .bind(asset_id)
    .bind(&roles)
    .bind(authenticated)
    .bind(subject_id)
    .fetch_optional(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::not_found)?;
    if stored.content_type.starts_with("video/") {
        return crate::video_media::response(
            &state,
            &stored.object_key,
            &stored.content_type,
            &headers,
        )
        .await;
    }
    stored_response(&state, &stored.object_key, &stored.content_type).await
}

/// Call only after proving the selected media reference is visible to the caller.
pub(crate) async fn stored_response(
    state: &AppState,
    object_key: &str,
    content_type: &str,
) -> Result<Response, ApiError> {
    let key = MediaObjectKey::from_stored_value(object_key).ok_or_else(ApiError::not_found)?;
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
        HeaderValue::from_str(content_type).map_err(|_| ApiError::internal_server_error())?,
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
