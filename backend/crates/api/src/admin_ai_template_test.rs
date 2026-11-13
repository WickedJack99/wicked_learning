use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_persistence::admin_ai_template_test::PostgresAdminAiTemplateTestRepository;

use crate::{
    AppState, ai_provider::AiProvider, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct TestAiTemplateRequest {
    prompt: String,
}

#[derive(Serialize)]
pub struct TestAiTemplateResponse {
    pub text: String,
    pub model: String,
    pub provider: String,
    #[serde(rename = "responseId")]
    pub response_id: Option<String>,
    #[serde(rename = "requestId")]
    pub request_id: Option<String>,
    pub usage: TestAiTemplateUsage,
}

#[derive(Serialize)]
pub struct TestAiTemplateUsage {
    #[serde(rename = "inputTokens")]
    pub input_tokens: Option<i64>,
    #[serde(rename = "outputTokens")]
    pub output_tokens: Option<i64>,
    #[serde(rename = "totalTokens")]
    pub total_tokens: Option<i64>,
}

/// Runs a saved template only after the source-sized prompt and server-owned
/// credential configuration have been validated. Neither encrypted material
/// nor plaintext credentials enter the response.
pub async fn create(
    State(state): State<AppState>,
    Path(template_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<TestAiTemplateRequest>,
) -> Result<Json<TestAiTemplateResponse>, ApiError> {
    let template_id = Uuid::parse_str(&template_id).map_err(|_| ApiError::not_found())?;
    let prompt = bounded_prompt(&request.prompt).ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    if !principal.has_permission("ai", "ru") {
        return Err(ApiError::forbidden());
    }
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminAiTemplateTestRepository::new(&state.application_database);
    let execution = repository
        .prepare(&principal, template_id, prompt)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    let output = AiProvider::test_template(execution, &state.ai_credential_cipher)
        .await
        .map_err(|_| ApiError::ai_template_test_rejected())?;

    Ok(Json(TestAiTemplateResponse {
        text: output.text,
        model: output.model,
        provider: output.provider,
        response_id: output.response_id,
        request_id: output.request_id,
        usage: TestAiTemplateUsage {
            input_tokens: output.input_tokens,
            output_tokens: output.output_tokens,
            total_tokens: output.total_tokens,
        },
    }))
}

fn bounded_prompt(value: &str) -> Option<String> {
    let value = value.trim();
    (!value.is_empty() && value.chars().count() <= 12_000).then(|| value.to_owned())
}

#[cfg(test)]
mod tests {
    use super::{
        TestAiTemplateRequest, TestAiTemplateResponse, TestAiTemplateUsage, bounded_prompt,
    };
    use serde_json::json;

    #[test]
    fn accepts_only_a_bounded_nonempty_source_test_prompt() {
        let request =
            serde_json::from_str::<TestAiTemplateRequest>(r#"{"prompt":"Draft a small test."}"#)
                .expect("request");

        assert_eq!(
            bounded_prompt(&request.prompt).as_deref(),
            Some("Draft a small test.")
        );
        assert!(bounded_prompt("   ").is_none());
        assert!(bounded_prompt(&"x".repeat(12_000)).is_some());
        assert!(bounded_prompt(&"x".repeat(12_001)).is_none());
    }

    #[test]
    fn response_preserves_the_source_test_shape_without_credential_material() {
        let response = serde_json::to_value(TestAiTemplateResponse {
            text: "A bounded response.".into(),
            model: "test-model".into(),
            provider: "openai".into(),
            response_id: Some("resp_123".into()),
            request_id: None,
            usage: TestAiTemplateUsage {
                input_tokens: Some(12),
                output_tokens: Some(8),
                total_tokens: Some(20),
            },
        })
        .expect("a serializable template test response");

        assert_eq!(
            response,
            json!({
                "text": "A bounded response.",
                "model": "test-model",
                "provider": "openai",
                "responseId": "resp_123",
                "requestId": null,
                "usage": {"inputTokens": 12, "outputTokens": 8, "totalTokens": 20}
            })
        );
    }
}
