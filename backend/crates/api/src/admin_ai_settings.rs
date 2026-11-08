use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use url::Url;
use uuid::Uuid;
use wicked_learning_application::admin_ai_settings::{
    AdminAiSettingsCommand, AdminAiSettingsError, AdminAiSettingsQuery, AgentTemplateForm,
    EncryptedApiKey, ProviderCredentialForm,
};
use wicked_learning_domain::ai::{AdminAiSettings, AiAgentTemplate, AiProviderCredential};
use wicked_learning_persistence::admin_ai_settings::PostgresAdminAiSettingsRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct ProviderCredentialRequest {
    label: String,
    provider: String,
    base_url: Option<String>,
    api_key: Option<String>,
    organization: Option<String>,
    #[serde(default)]
    enabled: bool,
    monthly_token_limit: Option<i64>,
    monthly_cost_limit_cents: Option<i32>,
    notes: Option<String>,
}

#[derive(Deserialize)]
pub struct AgentTemplateRequest {
    ai_provider_credential_id: Option<Uuid>,
    name: String,
    slug: Option<String>,
    purpose: String,
    model: Option<String>,
    system_prompt: Option<String>,
    task_prompt: Option<String>,
    temperature: Option<f64>,
    reasoning_effort: Option<String>,
    max_output_tokens: Option<i32>,
    concurrency_limit: i16,
    monthly_token_limit: Option<i64>,
    #[serde(default)]
    enabled: bool,
    #[serde(default = "default_true")]
    guarded_context: bool,
}

#[derive(Serialize)]
pub struct ProviderCredentialResponse {
    pub provider_credential: AiProviderCredential,
}

#[derive(Serialize)]
pub struct AgentTemplateResponse {
    pub agent_template: AiAgentTemplate,
}

/// Loads source-adapted provider and template settings. The safe projection
/// deliberately contains no provider-key plaintext, ciphertext or nonce.
pub async fn index(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<AdminAiSettings>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminAiSettingsRepository::new(&state.application_database);
    AdminAiSettingsQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(map_error)?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn create_provider(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<ProviderCredentialRequest>,
) -> Result<(StatusCode, Json<ProviderCredentialResponse>), ApiError> {
    let form = provider_form(&state, request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminAiSettingsRepository::new(&state.application_database);
    let provider_credential = AdminAiSettingsCommand::new(&repository)
        .create_provider(&principal, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(ProviderCredentialResponse {
            provider_credential,
        }),
    ))
}

pub async fn update_provider(
    State(state): State<AppState>,
    Path(provider_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<ProviderCredentialRequest>,
) -> Result<Json<ProviderCredentialResponse>, ApiError> {
    let provider_id = Uuid::parse_str(&provider_id).map_err(|_| ApiError::not_found())?;
    let form = provider_form(&state, request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminAiSettingsRepository::new(&state.application_database);
    let provider_credential = AdminAiSettingsCommand::new(&repository)
        .update_provider(&principal, provider_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(ProviderCredentialResponse {
        provider_credential,
    }))
}

pub async fn delete_provider(
    State(state): State<AppState>,
    Path(provider_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    let provider_id = Uuid::parse_str(&provider_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminAiSettingsRepository::new(&state.application_database);
    if !AdminAiSettingsCommand::new(&repository)
        .delete_provider(&principal, provider_id)
        .await
        .map_err(map_error)?
    {
        return Err(ApiError::not_found());
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn create_template(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<AgentTemplateRequest>,
) -> Result<(StatusCode, Json<AgentTemplateResponse>), ApiError> {
    let form = template_form(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminAiSettingsRepository::new(&state.application_database);
    let agent_template = AdminAiSettingsCommand::new(&repository)
        .create_template(&principal, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(AgentTemplateResponse { agent_template }),
    ))
}

pub async fn update_template(
    State(state): State<AppState>,
    Path(template_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<AgentTemplateRequest>,
) -> Result<Json<AgentTemplateResponse>, ApiError> {
    let template_id = Uuid::parse_str(&template_id).map_err(|_| ApiError::not_found())?;
    let form = template_form(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminAiSettingsRepository::new(&state.application_database);
    let agent_template = AdminAiSettingsCommand::new(&repository)
        .update_template(&principal, template_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(AgentTemplateResponse { agent_template }))
}

pub async fn delete_template(
    State(state): State<AppState>,
    Path(template_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    let template_id = Uuid::parse_str(&template_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminAiSettingsRepository::new(&state.application_database);
    if !AdminAiSettingsCommand::new(&repository)
        .delete_template(&principal, template_id)
        .await
        .map_err(map_error)?
    {
        return Err(ApiError::not_found());
    }
    Ok(StatusCode::NO_CONTENT)
}

fn provider_form(
    state: &AppState,
    request: ProviderCredentialRequest,
) -> Result<ProviderCredentialForm, ApiError> {
    let base_url = optional_http_url(request.base_url.as_deref())?;
    let api_key = request
        .api_key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| {
            if value.chars().count() > 2_000 {
                return Err(ApiError::invalid_request());
            }
            let encrypted = state
                .ai_credential_cipher
                .encrypt(value.as_bytes())
                .map_err(|_| ApiError::service_unavailable())?;
            let last_four: String = value
                .chars()
                .rev()
                .take(4)
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect();
            Ok(EncryptedApiKey {
                ciphertext: encrypted.ciphertext,
                nonce: encrypted.nonce,
                last_four,
            })
        })
        .transpose()?;
    ProviderCredentialForm::parse(
        &request.label,
        &request.provider,
        base_url.as_deref(),
        api_key,
        request.organization.as_deref(),
        request.enabled,
        request.monthly_token_limit,
        request.monthly_cost_limit_cents,
        request.notes.as_deref(),
    )
    .ok_or_else(ApiError::invalid_request)
}

fn template_form(request: AgentTemplateRequest) -> Result<AgentTemplateForm, ApiError> {
    AgentTemplateForm::parse(
        request.ai_provider_credential_id,
        &request.name,
        request.slug.as_deref(),
        &request.purpose,
        request.model.as_deref(),
        request.system_prompt.as_deref(),
        request.task_prompt.as_deref(),
        request.temperature,
        request.reasoning_effort.as_deref(),
        request.max_output_tokens,
        request.concurrency_limit,
        request.monthly_token_limit,
        request.enabled,
        request.guarded_context,
    )
    .ok_or_else(ApiError::invalid_request)
}

fn optional_http_url(value: Option<&str>) -> Result<Option<String>, ApiError> {
    let value = value.map(str::trim).filter(|value| !value.is_empty());
    let Some(value) = value else {
        return Ok(None);
    };
    let parsed = Url::parse(value).map_err(|_| ApiError::invalid_request())?;
    if !matches!(parsed.scheme(), "http" | "https")
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || value.chars().count() > 255
    {
        return Err(ApiError::invalid_request());
    }
    Ok(Some(value.to_owned()))
}

fn default_true() -> bool {
    true
}

fn map_error(error: AdminAiSettingsError) -> ApiError {
    match error {
        AdminAiSettingsError::Conflict => ApiError::conflict(),
        AdminAiSettingsError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::{AgentTemplateRequest, ProviderCredentialRequest, optional_http_url};

    #[test]
    fn accepts_source_settings_request_shapes_without_exposing_keys_in_responses() {
        let provider = serde_json::from_str::<ProviderCredentialRequest>(
            r#"{"label":"OpenAI main","provider":"openai","api_key":"development-only","enabled":true}"#,
        )
        .expect("provider request");
        assert_eq!(provider.provider, "openai");
        let template = serde_json::from_str::<AgentTemplateRequest>(
            r#"{"name":"Activity reviewer","purpose":"activity_review","concurrency_limit":1}"#,
        )
        .expect("template request");
        assert!(template.guarded_context);
        assert!(optional_http_url(Some("https://localhost:11434/v1")).is_ok());
        assert!(optional_http_url(Some("file:///tmp/key")).is_err());
    }
}
