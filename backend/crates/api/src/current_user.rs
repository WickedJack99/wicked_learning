use axum::{Json, extract::State};
use axum_login::AuthSession;
use serde::Serialize;
use uuid::Uuid;

use crate::{AppState, error::ApiError, identity::IdentityBackend};

#[derive(Serialize)]
pub struct CurrentUserResponse {
    pub subject_id: Uuid,
    pub roles: Vec<String>,
}

pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<CurrentUserResponse>, ApiError> {
    let subject = auth_session
        .user
        .ok_or_else(ApiError::authentication_required)?;
    let subject_id = subject.subject_id();
    let roles = sqlx::query_scalar::<_, String>(
        r#"
            SELECT roles.role_key
            FROM application_principals AS principals
            INNER JOIN application_principal_roles AS principal_roles
                ON principal_roles.principal_id = principals.id
            INNER JOIN application_roles AS roles
                ON roles.role_key = principal_roles.role_key
            WHERE principals.identity_subject_id = $1
            ORDER BY roles.role_key ASC
        "#,
    )
    .bind(subject_id)
    .fetch_all(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?;

    if roles.is_empty() {
        return Err(ApiError::forbidden());
    }

    Ok(Json(CurrentUserResponse { subject_id, roles }))
}
