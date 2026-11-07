use std::collections::{BTreeSet, HashMap};

use axum::{
    Json,
    body::Body,
    extract::{Path, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::Response,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_domain::identity_access::ApplicationCapability;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal, media_store::MediaObjectKey,
};

#[derive(Serialize)]
pub struct ReportPageResponse {
    pub reports: Vec<ReportResponse>,
}

#[derive(Serialize)]
pub struct ReportResponse {
    pub created_at: String,
    pub icon_url: Option<String>,
    pub icon_setter: Option<IdentityResponse>,
    pub id: String,
    pub organization: OrganizationResponse,
    pub reason: Option<String>,
    pub reporter: IdentityResponse,
}

#[derive(Serialize)]
pub struct IdentityResponse {
    pub email: Option<String>,
    pub name: Option<String>,
    pub subject_id: String,
}

#[derive(Serialize)]
pub struct OrganizationResponse {
    pub name: String,
    pub slug: String,
}

#[derive(Deserialize)]
pub struct ResolveRequest {
    pub remove_icon: bool,
}

#[derive(FromRow)]
struct ReportRow {
    created_at: String,
    icon_content_type: Option<String>,
    icon_setter_subject_id: Option<Uuid>,
    id: Uuid,
    organization_name: String,
    organization_slug: String,
    reason: Option<String>,
    reporter_subject_id: Uuid,
}

#[derive(Clone, FromRow)]
struct IdentityRow {
    display_name: Option<String>,
    normalized_email: String,
    subject_id: Uuid,
}

pub async fn index(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<ReportPageResponse>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    if !principal.has_capability(ApplicationCapability::ModerateOrganizationIcons) {
        return Err(ApiError::not_found());
    }
    let reports = pending_reports(&state.application_database).await?;
    let identities = identities(
        &state.identity_database,
        &reports
            .iter()
            .flat_map(|report| {
                [
                    Some(report.reporter_subject_id),
                    report.icon_setter_subject_id,
                ]
            })
            .flatten()
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect::<Vec<_>>(),
    )
    .await?;
    Ok(Json(ReportPageResponse {
        reports: reports
            .into_iter()
            .map(|report| ReportResponse {
                created_at: report.created_at,
                icon_url: report
                    .icon_content_type
                    .map(|_| format!("/api/v1/admin/organization-icon-reports/{}/icon", report.id)),
                icon_setter: report
                    .icon_setter_subject_id
                    .and_then(|subject_id| identities.get(&subject_id).cloned())
                    .map(identity_response),
                id: report.id.to_string(),
                organization: OrganizationResponse {
                    name: report.organization_name,
                    slug: report.organization_slug,
                },
                reason: report.reason,
                reporter: identities
                    .get(&report.reporter_subject_id)
                    .cloned()
                    .map(identity_response)
                    .unwrap_or_else(|| unavailable_identity(report.reporter_subject_id)),
            })
            .collect(),
    }))
}

pub async fn resolve(
    State(state): State<AppState>,
    Path(report_id): Path<Uuid>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<ResolveRequest>,
) -> Result<StatusCode, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    if !principal.has_capability(ApplicationCapability::ModerateOrganizationIcons) {
        return Err(ApiError::not_found());
    }
    let mut transaction = state
        .application_database
        .begin()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let moderator_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::not_found)?;
    let organization_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT organization_id FROM organization_icon_reports WHERE id = $1 AND status = 'pending' FOR UPDATE",
    )
    .bind(report_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::not_found)?;
    if request.remove_icon {
        sqlx::query("UPDATE organizations SET icon_id = NULL, icon_set_by_principal_id = NULL, updated_at = NOW() WHERE id = $1")
            .bind(organization_id)
            .execute(&mut *transaction)
            .await
            .map_err(|_| ApiError::service_unavailable())?;
    }
    sqlx::query("UPDATE organization_icon_reports SET status = $2, resolved_by_principal_id = $3, resolved_at = NOW() WHERE id = $1")
        .bind(report_id)
        .bind(if request.remove_icon { "resolved" } else { "dismissed" })
        .bind(moderator_id)
        .execute(&mut *transaction)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    transaction
        .commit()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn show_icon(
    State(state): State<AppState>,
    Path(report_id): Path<Uuid>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Response, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    if !principal.has_capability(ApplicationCapability::ModerateOrganizationIcons) {
        return Err(ApiError::not_found());
    }
    let report = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT icon_object_key, icon_content_type FROM organization_icon_reports WHERE id = $1",
    )
    .bind(report_id)
    .fetch_optional(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::not_found)?;
    let content_type = report.1.ok_or_else(ApiError::not_found)?;
    let key = MediaObjectKey::from_stored_value(&report.0).ok_or_else(ApiError::not_found)?;
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
        HeaderValue::from_str(&content_type).map_err(|_| ApiError::internal_server_error())?,
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
        HeaderValue::from_static("private, no-store"),
    );
    Ok(response)
}

async fn pending_reports(pool: &PgPool) -> Result<Vec<ReportRow>, ApiError> {
    sqlx::query_as::<_, ReportRow>(
        "SELECT to_char(reports.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, reports.icon_content_type, setter.identity_subject_id AS icon_setter_subject_id, reports.id, organizations.name AS organization_name, organizations.slug AS organization_slug, reports.reason, reporter.identity_subject_id AS reporter_subject_id FROM organization_icon_reports AS reports INNER JOIN organizations ON organizations.id = reports.organization_id INNER JOIN application_principals AS reporter ON reporter.id = reports.reported_by_principal_id LEFT JOIN application_principals AS setter ON setter.id = reports.icon_set_by_principal_id WHERE reports.status = 'pending' ORDER BY reports.created_at DESC, reports.id DESC LIMIT 100",
    )
    .fetch_all(pool)
    .await
    .map_err(|_| ApiError::service_unavailable())
}

async fn identities(
    pool: &PgPool,
    subject_ids: &[Uuid],
) -> Result<HashMap<Uuid, IdentityRow>, ApiError> {
    if subject_ids.is_empty() {
        return Ok(HashMap::new());
    }
    sqlx::query_as::<_, IdentityRow>("SELECT subjects.id AS subject_id, subjects.normalized_email, profiles.display_name FROM identity_subjects AS subjects LEFT JOIN identity_profiles AS profiles ON profiles.subject_id = subjects.id WHERE subjects.id = ANY($1)")
        .bind(subject_ids).fetch_all(pool).await.map(|rows| rows.into_iter().map(|row| (row.subject_id, row)).collect()).map_err(|_| ApiError::service_unavailable())
}

fn identity_response(identity: IdentityRow) -> IdentityResponse {
    IdentityResponse {
        email: Some(identity.normalized_email),
        name: identity.display_name,
        subject_id: identity.subject_id.to_string(),
    }
}
fn unavailable_identity(subject_id: Uuid) -> IdentityResponse {
    IdentityResponse {
        email: None,
        name: None,
        subject_id: subject_id.to_string(),
    }
}
