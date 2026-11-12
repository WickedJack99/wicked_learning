use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::Deserialize;
use serde_json::{Value, json};
use wicked_learning_application::{
    admin_world_graph::AdminWorldGraphQuery,
    admin_world_map_create::{AdminWorldMapCreateCommand, CreateWorldMapForm},
};
use wicked_learning_persistence::{
    admin_world_graph::PostgresAdminWorldGraphRepository,
    admin_world_map_create::PostgresAdminWorldMapCreateRepository,
};

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

/// Serves the source Content API's machine-readable authoring boundary. The
/// contract is intentionally a separate `/api/content/v1` namespace: it is an
/// authenticated administration API, not a browser capability or public token.
pub async fn contract(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<Value>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    if !principal.has_permission("content_api", "ro") {
        return Err(ApiError::forbidden());
    }

    Ok(Json(json!({ "data": document() })))
}

#[derive(Deserialize)]
pub struct CreateMapRequest {
    title: String,
    slug: Option<String>,
    description: Option<String>,
}

/// Lists only maps already visible in the caller's existing scoped World
/// Builder graph. Content API permission opens this namespace; map scope still
/// decides which records can be returned.
pub async fn maps(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<Value>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    require_content_permission(&principal, "ro")?;
    let repository = PostgresAdminWorldGraphRepository::new(&state.application_database);
    let graph = AdminWorldGraphQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::forbidden)?;

    Ok(Json(json!({
        "data": graph.maps.into_iter().map(|map| json!({
            "id": map.id,
            "slug": map.slug,
            "title": map.title,
            "description": map.description,
        })).collect::<Vec<_>>(),
    })))
}

/// Creates a map through the established World Builder command. The Content
/// API adds no browser-chosen World or scope: both remain server-owned.
pub async fn create_map(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<CreateMapRequest>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let form = CreateWorldMapForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.description.as_deref(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    require_content_permission(&principal, "ru")?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMapCreateRepository::new(&state.application_database);
    let map_id = AdminWorldMapCreateCommand::new(&repository)
        .execute(&principal, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::forbidden)?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "data": {
                "id": map_id,
                "slug": form.slug.unwrap_or_else(|| wicked_learning_application::admin_world_map_create::generated_map_slug(&form.title)),
                "title": form.title,
                "description": form.description,
            }
        })),
    ))
}

fn require_content_permission(
    principal: &wicked_learning_domain::identity_access::AuthorizedPrincipal,
    level: &str,
) -> Result<(), ApiError> {
    principal
        .has_permission("content_api", level)
        .then_some(())
        .ok_or_else(ApiError::forbidden)
}

fn document() -> Value {
    json!({
        "name": "Wicked Learning Content API",
        "version": "1.1",
        "basePath": "/api/content/v1",
        "authentication": {
            "type": "session",
            "description": "Requests use the signed-in administrator session. Mutating requests require the page CSRF token in the X-CSRF-Token header."
        },
        "aiInstructions": [
            "Use only operations listed in this contract.",
            "Treat returned IDs as opaque identifiers and reuse them exactly.",
            "Create or select a map before creating MapAssets, then create Activities through the returned MapAsset ID.",
            "Do not invent uploaded media paths. Reuse an existing path supplied by an administrator or leave image_url null.",
            "Show the planned request body to the administrator before sending a mutating request.",
            "Use the ContentPlan schema for AI-assisted drafts and never apply a generated draft without explicit administrator approval.",
            "If validation fails, repair only the fields named in the 422 response and ask before changing the instructional intent."
        ],
        "activityTypes": [],
        "contentPlan": {
            "humanApprovalRequired": true,
            "placementDefaults": { "positionX": 50, "positionY": 50, "width": 14 },
            "purpose": "Structured AI-assisted authoring drafts require administrator review before content is created.",
            "schema": {},
            "supportedActivityTypes": [],
            "version": "1.5"
        },
        "operations": [
            operation("contract.show", "GET", "/api/content/v1/contract", "Read the machine contract", "Returns this versioned document for API consoles and AI context.", Value::Null, json!({ "data": { "version": "1.1", "operations": [] } })),
            operation("maps.index", "GET", "/api/content/v1/maps", "List editable maps", "Returns only maps within the administrator's editable scope.", Value::Null, json!({ "data": [] })),
            operation("maps.store", "POST", "/api/content/v1/maps", "Create a map", "Creates a new map in the current learning world.", json!({ "title": "Engine Bay", "slug": "engine-bay", "description": "An exploratory map of connected vehicle systems." }), json!({ "data": { "id": "opaque-map-id", "slug": "engine-bay", "title": "Engine Bay" } })),
        ],
        "errors": {
            "401": "No authenticated administration session.",
            "403": "The current role or map scope does not allow this operation.",
            "404": "The requested content object does not exist.",
            "422": "The request body does not satisfy the documented contract."
        }
    })
}

fn operation(
    id: &str,
    method: &str,
    path: &str,
    summary: &str,
    description: &str,
    request_example: Value,
    response_example: Value,
) -> Value {
    json!({
        "id": id,
        "method": method,
        "path": path,
        "summary": summary,
        "description": description,
        "requestExample": request_example,
        "responseExample": response_example,
    })
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::{document, require_content_permission};

    #[test]
    fn contract_lists_only_the_available_bounded_authoring_operations() {
        let document = document();
        let operations = document["operations"].as_array().expect("operations array");

        assert_eq!(document["basePath"], "/api/content/v1");
        assert_eq!(operations.len(), 3);
        assert_eq!(operations[0]["id"], "contract.show");
        assert_eq!(operations[2]["id"], "maps.store");
    }

    #[test]
    fn content_api_permission_is_distinct_from_world_builder_permission() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:rud:all".to_owned()],
        };

        assert!(require_content_permission(&principal, "ro").is_err());
    }
}
