use axum::Json;
use axum_login::AuthSession;
use serde::Serialize;
use uuid::Uuid;

use crate::{
    error::ApiError,
    identity::{IdentityBackend, IdentitySubject},
    session_commands::{
        PENDING_TWO_FACTOR_LOGIN_KEY, PendingTwoFactorLogin, pending_two_factor_login_is_fresh,
    },
};

#[derive(Serialize)]
pub struct SessionStatusResponse {
    pub authenticated: bool,
    pub subject_id: Option<Uuid>,
    pub two_factor_required: bool,
}

pub async fn show(
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<SessionStatusResponse>, ApiError> {
    let pending_two_factor_login = auth_session
        .session
        .get::<PendingTwoFactorLogin>(PENDING_TWO_FACTOR_LOGIN_KEY)
        .await
        .map_err(|_| ApiError::service_unavailable())?;

    Ok(Json(SessionStatusResponse {
        authenticated: auth_session.user.is_some(),
        subject_id: auth_session.user.as_ref().map(IdentitySubject::subject_id),
        two_factor_required: auth_session.user.is_none()
            && pending_two_factor_login.is_some_and(|pending| {
                pending_two_factor_login_is_fresh(
                    &pending,
                    time::OffsetDateTime::now_utc().unix_timestamp(),
                )
            }),
    }))
}
