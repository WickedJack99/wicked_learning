use axum::{Json, extract::State, http::HeaderMap};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use wicked_learning_application::learner_language_preference::{
    LearnerLanguagePreference, LearnerLanguagePreferenceError, LearnerLanguagePreferenceQuery,
    UpdateLearnerLanguagePreferenceCommand,
};
use wicked_learning_persistence::learner_language_preference::PostgresLearnerLanguagePreferenceRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

const MAX_LOCALE_BYTES: usize = 16;

#[derive(Deserialize)]
pub struct UpdateLearnerLanguagePreferenceRequest {
    locale: String,
}

#[derive(Serialize)]
pub struct LearnerLanguagePreferenceResponse {
    pub available_languages: Vec<LanguageResponse>,
    pub locale: String,
}

#[derive(Serialize)]
pub struct LanguageResponse {
    pub code: String,
    pub name: String,
    pub native_name: String,
}

pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerLanguagePreferenceResponse>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerLanguagePreferenceRepository::new(&state.application_database);
    let preference = LearnerLanguagePreferenceQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(map_error)?;
    Ok(Json(response(preference)))
}

pub async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateLearnerLanguagePreferenceRequest>,
) -> Result<Json<LearnerLanguagePreferenceResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let locale = normalize_locale(request.locale).ok_or_else(ApiError::invalid_request)?;
    let repository = PostgresLearnerLanguagePreferenceRepository::new(&state.application_database);
    let preference = UpdateLearnerLanguagePreferenceCommand::new(&repository)
        .execute(&principal, locale)
        .await
        .map_err(map_error)?;
    Ok(Json(response(preference)))
}

fn response(preference: LearnerLanguagePreference) -> LearnerLanguagePreferenceResponse {
    LearnerLanguagePreferenceResponse {
        available_languages: preference
            .available_languages
            .into_iter()
            .map(|language| LanguageResponse {
                code: language.code,
                name: language.name,
                native_name: language.native_name,
            })
            .collect(),
        locale: preference.locale,
    }
}

fn normalize_locale(locale: String) -> Option<String> {
    let locale = locale.trim().to_owned();
    (!locale.is_empty() && locale.len() <= MAX_LOCALE_BYTES).then_some(locale)
}

fn map_error(error: LearnerLanguagePreferenceError) -> ApiError {
    match error {
        LearnerLanguagePreferenceError::InvalidLocale => ApiError::invalid_request(),
        LearnerLanguagePreferenceError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::normalize_locale;

    #[test]
    fn normalizes_a_bounded_nonempty_locale_code() {
        assert_eq!(
            normalize_locale(" en-GB ".to_owned()).as_deref(),
            Some("en-GB")
        );
        assert_eq!(normalize_locale("   ".to_owned()), None);
        assert_eq!(normalize_locale("a".repeat(17)), None);
    }
}
