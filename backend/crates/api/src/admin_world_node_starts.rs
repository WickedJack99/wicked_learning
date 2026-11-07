use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::admin_world_node_starts::{
    AdminWorldNodeStartsCommand, AdminWorldNodeStartsError, StartRouteDirection, StartRouteForm,
};
use wicked_learning_domain::world_content::AdminActivityStartRoute;
use wicked_learning_persistence::admin_world_node_starts::PostgresAdminWorldNodeStartsRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct AddStartRouteRequest {
    activity_id: String,
}

#[derive(Deserialize)]
pub struct SaveStartRouteRequest {
    label: Option<String>,
    description: Option<String>,
    image_dark: Option<String>,
    image_light: Option<String>,
    button_color_dark: Option<String>,
    button_border_color_dark: Option<String>,
    button_color_light: Option<String>,
    button_border_color_light: Option<String>,
}

#[derive(Deserialize)]
pub struct ReorderStartRouteRequest {
    direction: String,
}

#[derive(Serialize)]
pub struct StartRoutesResponse {
    pub start_activity_id: Option<Uuid>,
    pub start_routes: Vec<AdminActivityStartRoute>,
}

/// Adds a source-compatible route start to an editable node. Exit portal
/// activities are not eligible starts, just as in the Laravel editor.
pub async fn add(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<AddStartRouteRequest>,
) -> Result<Json<StartRoutesResponse>, ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let activity_id =
        Uuid::parse_str(&request.activity_id).map_err(|_| ApiError::invalid_request())?;
    execute_mutation(
        &state,
        headers,
        csrf_token,
        auth_session,
        StartRoutesMutation::Add {
            node_id,
            activity_id,
        },
    )
    .await
}

pub async fn remove_all(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<StartRoutesResponse>, ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    execute_mutation(
        &state,
        headers,
        csrf_token,
        auth_session,
        StartRoutesMutation::Remove {
            node_id,
            activity_id: None,
        },
    )
    .await
}

pub async fn remove_one(
    State(state): State<AppState>,
    Path((node_id, activity_id)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<StartRoutesResponse>, ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::invalid_request())?;
    execute_mutation(
        &state,
        headers,
        csrf_token,
        auth_session,
        StartRoutesMutation::Remove {
            node_id,
            activity_id: Some(activity_id),
        },
    )
    .await
}

/// Saves source-defined route presentation fields without changing the route's
/// activity membership or learner progress.
pub async fn update(
    State(state): State<AppState>,
    Path(start_route_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SaveStartRouteRequest>,
) -> Result<Json<StartRoutesResponse>, ApiError> {
    let start_route_id = Uuid::parse_str(&start_route_id).map_err(|_| ApiError::not_found())?;
    let form = StartRouteForm::parse(
        request.label.as_deref(),
        request.description.as_deref(),
        request.image_dark.as_deref(),
        request.image_light.as_deref(),
        request.button_color_dark.as_deref(),
        request.button_border_color_dark.as_deref(),
        request.button_color_light.as_deref(),
        request.button_border_color_light.as_deref(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    execute_mutation(
        &state,
        headers,
        csrf_token,
        auth_session,
        StartRoutesMutation::Update {
            start_route_id,
            form,
        },
    )
    .await
}

pub async fn reorder(
    State(state): State<AppState>,
    Path(start_route_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<ReorderStartRouteRequest>,
) -> Result<Json<StartRoutesResponse>, ApiError> {
    let start_route_id = Uuid::parse_str(&start_route_id).map_err(|_| ApiError::not_found())?;
    let direction =
        StartRouteDirection::parse(&request.direction).ok_or_else(ApiError::invalid_request)?;
    execute_mutation(
        &state,
        headers,
        csrf_token,
        auth_session,
        StartRoutesMutation::Reorder {
            start_route_id,
            direction,
        },
    )
    .await
}

pub async fn delete(
    State(state): State<AppState>,
    Path(start_route_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<StartRoutesResponse>, ApiError> {
    let start_route_id = Uuid::parse_str(&start_route_id).map_err(|_| ApiError::not_found())?;
    execute_mutation(
        &state,
        headers,
        csrf_token,
        auth_session,
        StartRoutesMutation::Delete { start_route_id },
    )
    .await
}

enum StartRoutesMutation {
    Add {
        node_id: Uuid,
        activity_id: Uuid,
    },
    Remove {
        node_id: Uuid,
        activity_id: Option<Uuid>,
    },
    Update {
        start_route_id: Uuid,
        form: StartRouteForm,
    },
    Reorder {
        start_route_id: Uuid,
        direction: StartRouteDirection,
    },
    Delete {
        start_route_id: Uuid,
    },
}

async fn execute_mutation(
    state: &AppState,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    operation: StartRoutesMutation,
) -> Result<Json<StartRoutesResponse>, ApiError> {
    let principal = authenticated_principal(state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldNodeStartsRepository::new(&state.application_database);
    let command = AdminWorldNodeStartsCommand::new(&repository);
    let starts = match operation {
        StartRoutesMutation::Add {
            node_id,
            activity_id,
        } => command.add_start(&principal, node_id, activity_id).await,
        StartRoutesMutation::Remove {
            node_id,
            activity_id,
        } => {
            command
                .remove_starts(&principal, node_id, activity_id)
                .await
        }
        StartRoutesMutation::Update {
            start_route_id,
            form,
        } => {
            command
                .update_start(&principal, start_route_id, &form)
                .await
        }
        StartRoutesMutation::Reorder {
            start_route_id,
            direction,
        } => {
            command
                .reorder_start(&principal, start_route_id, direction)
                .await
        }
        StartRoutesMutation::Delete { start_route_id } => {
            command.delete_start(&principal, start_route_id).await
        }
    }
    .map_err(map_error)?
    .ok_or_else(ApiError::not_found)?;
    Ok(Json(StartRoutesResponse {
        start_activity_id: starts.start_activity_id,
        start_routes: starts.start_routes,
    }))
}

fn map_error(error: AdminWorldNodeStartsError) -> ApiError {
    match error {
        AdminWorldNodeStartsError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldNodeStartsError::Unavailable => ApiError::service_unavailable(),
    }
}
