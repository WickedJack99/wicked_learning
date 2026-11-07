use axum::Json;
use axum_login::AuthSession;
use serde::Serialize;
use uuid::Uuid;

use crate::identity::{IdentityBackend, IdentitySubject};

#[derive(Serialize)]
pub struct SessionStatusResponse {
    pub authenticated: bool,
    pub subject_id: Option<Uuid>,
    pub two_factor_required: bool,
}

pub async fn show(auth_session: AuthSession<IdentityBackend>) -> Json<SessionStatusResponse> {
    Json(SessionStatusResponse {
        authenticated: auth_session.user.is_some(),
        subject_id: auth_session.user.as_ref().map(IdentitySubject::subject_id),
        two_factor_required: false,
    })
}
