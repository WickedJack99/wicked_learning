use axum::{
    Json,
    extract::{Multipart, Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use wicked_learning_application::admin_translation_catalog::{
    AdminPlatformLanguage, AdminTranslationCatalogCommand, AdminTranslationCatalogError,
    PlatformLanguageForm,
};
use wicked_learning_persistence::admin_translation_catalog::PostgresAdminTranslationCatalogRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

pub const MAX_TRANSLATION_CATALOG_BYTES: usize = 2 * 1024 * 1024;

#[derive(Deserialize)]
pub struct CreateLanguageRequest {
    code: String,
    name: String,
    native_name: String,
}

#[derive(Deserialize)]
pub struct UpdateLanguageRequest {
    name: String,
    native_name: String,
}

#[derive(Serialize)]
pub struct LanguagesResponse {
    pub languages: Vec<LanguageResponse>,
}

#[derive(Serialize)]
pub struct LanguageResponse {
    pub code: String,
    pub name: String,
    pub native_name: String,
    pub is_enabled: bool,
    pub is_default: bool,
    pub updated_at: String,
}

#[derive(Serialize)]
pub struct LanguageCatalogResponse {
    pub catalog: Value,
}

pub async fn list(
    State(state): State<AppState>,
    session: AuthSession<IdentityBackend>,
) -> Result<Json<LanguagesResponse>, ApiError> {
    let principal = authenticated_principal(&state, session).await?;
    let repository = PostgresAdminTranslationCatalogRepository::new(&state.application_database);
    let languages = AdminTranslationCatalogCommand::new(&repository)
        .list(&principal)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(LanguagesResponse {
        languages: languages.into_iter().map(language).collect(),
    }))
}

pub async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    Json(request): Json<CreateLanguageRequest>,
) -> Result<Json<LanguageResponse>, ApiError> {
    let form = PlatformLanguageForm::parse(&request.code, &request.name, &request.native_name)
        .ok_or_else(ApiError::invalid_request)?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let principal = authenticated_principal(&state, session).await?;
    let repository = PostgresAdminTranslationCatalogRepository::new(&state.application_database);
    let created_language = AdminTranslationCatalogCommand::new(&repository)
        .create(&principal, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(language(created_language)))
}

pub async fn update(
    State(state): State<AppState>,
    Path(code): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateLanguageRequest>,
) -> Result<Json<LanguageResponse>, ApiError> {
    let form = PlatformLanguageForm::parse(&code, &request.name, &request.native_name)
        .ok_or_else(ApiError::invalid_request)?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let principal = authenticated_principal(&state, session).await?;
    let repository = PostgresAdminTranslationCatalogRepository::new(&state.application_database);
    let updated_language = AdminTranslationCatalogCommand::new(&repository)
        .update(&principal, &code, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(language(updated_language)))
}

pub async fn english_export(
    State(state): State<AppState>,
    session: AuthSession<IdentityBackend>,
) -> Result<Json<LanguageCatalogResponse>, ApiError> {
    let principal = authenticated_principal(&state, session).await?;
    let repository = PostgresAdminTranslationCatalogRepository::new(&state.application_database);
    let catalog = AdminTranslationCatalogCommand::new(&repository)
        .english_export(&principal)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(LanguageCatalogResponse { catalog }))
}

pub async fn language_export(
    State(state): State<AppState>,
    Path(code): Path<String>,
    session: AuthSession<IdentityBackend>,
) -> Result<Json<LanguageCatalogResponse>, ApiError> {
    let principal = authenticated_principal(&state, session).await?;
    let repository = PostgresAdminTranslationCatalogRepository::new(&state.application_database);
    let catalog = AdminTranslationCatalogCommand::new(&repository)
        .language_export(&principal, &code)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(LanguageCatalogResponse { catalog }))
}

pub async fn import(
    State(state): State<AppState>,
    Path(code): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    mut multipart: Multipart,
) -> Result<(), ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let catalog = catalog_upload(&mut multipart).await?;
    let principal = authenticated_principal(&state, session).await?;
    let repository = PostgresAdminTranslationCatalogRepository::new(&state.application_database);
    AdminTranslationCatalogCommand::new(&repository)
        .import(&principal, &code, catalog)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(())
}

async fn catalog_upload(multipart: &mut Multipart) -> Result<Value, ApiError> {
    let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| ApiError::invalid_request())?
    else {
        return Err(ApiError::invalid_request());
    };
    if field.name() != Some("catalog")
        || !matches!(
            field.content_type().map(|value| value.as_ref()),
            Some("application/json" | "text/plain")
        )
    {
        return Err(ApiError::invalid_request());
    }
    let bytes = field
        .bytes()
        .await
        .map_err(|_| ApiError::invalid_request())?;
    if bytes.is_empty() || bytes.len() > MAX_TRANSLATION_CATALOG_BYTES {
        return Err(ApiError::invalid_request());
    }
    if multipart
        .next_field()
        .await
        .map_err(|_| ApiError::invalid_request())?
        .is_some()
    {
        return Err(ApiError::invalid_request());
    }
    serde_json::from_slice(&bytes).map_err(|_| ApiError::invalid_request())
}

fn language(language: AdminPlatformLanguage) -> LanguageResponse {
    LanguageResponse {
        is_default: language.code == "en",
        code: language.code,
        name: language.name,
        native_name: language.native_name,
        is_enabled: language.is_enabled,
        updated_at: language.updated_at,
    }
}

fn map_error(error: AdminTranslationCatalogError) -> ApiError {
    match error {
        AdminTranslationCatalogError::Conflict => ApiError::conflict(),
        AdminTranslationCatalogError::Invalid => ApiError::invalid_request(),
        AdminTranslationCatalogError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::{CreateLanguageRequest, UpdateLanguageRequest};

    #[test]
    fn requires_complete_source_language_forms() {
        assert!(
            serde_json::from_str::<CreateLanguageRequest>(
                r#"{"code":"de","name":"German","native_name":"Deutsch"}"#
            )
            .is_ok()
        );
        assert!(serde_json::from_str::<CreateLanguageRequest>(r#"{"code":"de"}"#).is_err());
        assert!(
            serde_json::from_str::<UpdateLanguageRequest>(
                r#"{"name":"German","native_name":"Deutsch"}"#
            )
            .is_ok()
        );
    }
}
