use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use uuid::Uuid;
use wicked_learning_application::admin_world_markdown::{
    AdminWorldMarkdownCommand, AdminWorldMarkdownError, MarkdownActivityForm, MarkdownGraphLayout,
    MarkdownPageForm, MarkdownPageVisual, MarkdownPosition, MarkdownTransitionForm,
};
use wicked_learning_persistence::admin_world_markdown::PostgresAdminWorldMarkdownRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct MarkdownPositionRequest {
    x: f64,
    y: f64,
}

#[derive(Deserialize)]
pub struct MarkdownVisualRequest {
    page_color_dark: String,
    page_color_light: String,
    border_color_dark: String,
    border_color_light: String,
    heading_color_dark: String,
    heading_color_light: String,
    text_color_dark: String,
    text_color_light: String,
}

#[derive(Deserialize)]
pub struct MarkdownPageRequest {
    id: String,
    title: String,
    body: String,
    position: MarkdownPositionRequest,
    visual: MarkdownVisualRequest,
}

#[derive(Deserialize)]
pub struct MarkdownTransitionRequest {
    id: String,
    from: String,
    to: String,
}

#[derive(Deserialize)]
pub struct MarkdownGraphLayoutRequest {
    start: Option<MarkdownPositionRequest>,
    end: Option<MarkdownPositionRequest>,
}

#[derive(Deserialize)]
pub struct MarkdownActivityRequest {
    title: String,
    slug: NullableString,
    introduction: NullableString,
    markdown_pages: Vec<MarkdownPageRequest>,
    markdown_transitions: Vec<MarkdownTransitionRequest>,
    markdown_graph_layout: MarkdownGraphLayoutRequest,
}

#[derive(Deserialize)]
pub struct CreateMarkdownActivityRequest {
    title: String,
    slug: Option<String>,
    introduction: Option<String>,
    markdown_pages: Vec<MarkdownPageRequest>,
    markdown_transitions: Vec<MarkdownTransitionRequest>,
    markdown_graph_layout: MarkdownGraphLayoutRequest,
}

#[derive(Deserialize)]
pub struct UpdateMarkdownActivityRequest {
    #[serde(flatten)]
    form: MarkdownActivityRequest,
    updated_at: String,
}

#[derive(Serialize)]
pub struct CreateMarkdownActivityResponse {
    pub activity_id: Uuid,
}

#[derive(Serialize)]
pub struct UpdateMarkdownActivityResponse {
    pub activity_id: Uuid,
    pub updated_at: String,
}

/// A required JSON field that may intentionally contain `null`. Markdown saves
/// receive the whole source-shaped activity form rather than a partial patch.
#[derive(Deserialize)]
#[serde(untagged)]
enum NullableString {
    Text(String),
    Null(()),
}

impl NullableString {
    fn as_deref(&self) -> Option<&str> {
        match self {
            Self::Text(value) => Some(value),
            Self::Null(()) => None,
        }
    }
}

fn position(request: MarkdownPositionRequest) -> Result<MarkdownPosition, ApiError> {
    MarkdownPosition::parse(request.x, request.y).ok_or_else(ApiError::invalid_request)
}

pub(crate) fn form(
    title: &str,
    slug: Option<&str>,
    introduction: Option<&str>,
    pages: Vec<MarkdownPageRequest>,
    transitions: Vec<MarkdownTransitionRequest>,
    layout: MarkdownGraphLayoutRequest,
) -> Result<MarkdownActivityForm, ApiError> {
    let pages = pages
        .into_iter()
        .map(|page| {
            let visual = MarkdownPageVisual::parse(
                &page.visual.page_color_dark,
                &page.visual.page_color_light,
                &page.visual.border_color_dark,
                &page.visual.border_color_light,
                &page.visual.heading_color_dark,
                &page.visual.heading_color_light,
                &page.visual.text_color_dark,
                &page.visual.text_color_light,
            )
            .ok_or_else(ApiError::invalid_request)?;
            MarkdownPageForm::parse(
                &page.id,
                &page.title,
                &page.body,
                position(page.position)?,
                visual,
            )
            .ok_or_else(ApiError::invalid_request)
        })
        .collect::<Result<Vec<_>, _>>()?;
    let transitions = transitions
        .into_iter()
        .map(|transition| {
            MarkdownTransitionForm::parse(&transition.id, &transition.from, &transition.to)
                .ok_or_else(ApiError::invalid_request)
        })
        .collect::<Result<Vec<_>, _>>()?;
    let graph_layout = MarkdownGraphLayout {
        start: layout.start.map(position).transpose()?,
        end: layout.end.map(position).transpose()?,
    };
    MarkdownActivityForm::parse(title, slug, introduction, pages, transitions, graph_layout)
        .ok_or_else(ApiError::invalid_request)
}

pub async fn create(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<CreateMarkdownActivityRequest>,
) -> Result<(StatusCode, Json<CreateMarkdownActivityResponse>), ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let form = form(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        request.markdown_pages,
        request.markdown_transitions,
        request.markdown_graph_layout,
    )?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMarkdownRepository::new(&state.application_database);
    let created = AdminWorldMarkdownCommand::new(&repository)
        .create(&principal, node_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(CreateMarkdownActivityResponse {
            activity_id: created.activity_id,
        }),
    ))
}

pub async fn update(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateMarkdownActivityRequest>,
) -> Result<Json<UpdateMarkdownActivityResponse>, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    OffsetDateTime::parse(&request.updated_at, &Rfc3339)
        .map_err(|_| ApiError::invalid_request())?;
    let form = form(
        &request.form.title,
        request.form.slug.as_deref(),
        request.form.introduction.as_deref(),
        request.form.markdown_pages,
        request.form.markdown_transitions,
        request.form.markdown_graph_layout,
    )?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMarkdownRepository::new(&state.application_database);
    let updated = AdminWorldMarkdownCommand::new(&repository)
        .update(&principal, activity_id, &form, &request.updated_at)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(UpdateMarkdownActivityResponse {
        activity_id: updated.activity_id,
        updated_at: updated.updated_at,
    }))
}

fn map_error(error: AdminWorldMarkdownError) -> ApiError {
    match error {
        AdminWorldMarkdownError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldMarkdownError::Conflict => ApiError::conflict(),
        AdminWorldMarkdownError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateMarkdownActivityRequest;

    #[test]
    fn update_requires_the_complete_source_markdown_form() {
        let complete = r##"{"title":"Briefing","slug":null,"introduction":null,"markdown_pages":[{"id":"page-1","title":"First page","body":"# Hello","position":{"x":140,"y":80},"visual":{"page_color_dark":"#0f172a","page_color_light":"#ffffff","border_color_dark":"#2dd4bf","border_color_light":"#0891b2","heading_color_dark":"#67e8f9","heading_color_light":"#0e7490","text_color_dark":"#f8fafc","text_color_light":"#0f172a"}}],"markdown_transitions":[{"id":"start-page","from":"start","to":"page-1"}],"markdown_graph_layout":{},"updated_at":"2026-11-08T00:00:00Z"}"##;
        assert!(serde_json::from_str::<UpdateMarkdownActivityRequest>(complete).is_ok());
        assert!(serde_json::from_str::<UpdateMarkdownActivityRequest>(
            r#"{"title":"Briefing","slug":null,"introduction":null,"markdown_pages":[],"updated_at":"2026-11-08T00:00:00Z"}"#,
        )
        .is_err());
    }
}
