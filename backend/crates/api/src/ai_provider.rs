use async_openai::{
    Client,
    config::OpenAIConfig,
    types::responses::{OutputItem, OutputMessageContent, Status},
};
use serde_json::{Value, json};
use wicked_learning_application::{
    admin_activity_ai_review::activity_review_schema,
    admin_ai_content_authoring::content_plan_document,
};
use wicked_learning_persistence::admin_activity_ai_review::{
    ActivityReviewExecution, ActivityReviewUsage,
};
use wicked_learning_persistence::admin_ai_content_authoring::{
    ContentAuthoringExecution, ContentAuthoringProviderOutput,
};
use wicked_learning_persistence::admin_ai_template_test::AiTemplateTestExecution;
use wicked_learning_persistence::learner_companion::CompanionTurnExecution;

use crate::ai_credential_crypto::AiCredentialCipher;

/// The sole outbound AI boundary. Browser handlers and application policy see
/// neither provider SDK types nor credential plaintext.
pub struct AiProvider;

pub struct AiProviderReviewOutput {
    pub review: Value,
    pub usage: ActivityReviewUsage,
}

pub struct AiProviderContentPlanOutput {
    pub output: ContentAuthoringProviderOutput,
}

pub struct AiProviderTemplateTestOutput {
    pub text: String,
    pub model: String,
    pub provider: String,
    pub response_id: Option<String>,
    pub request_id: Option<String>,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub total_tokens: Option<i64>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AiProviderError {
    Configuration,
    Credential,
    Response,
}

impl AiProvider {
    pub async fn test_template(
        execution: AiTemplateTestExecution,
        cipher: &AiCredentialCipher,
    ) -> Result<AiProviderTemplateTestOutput, AiProviderError> {
        let provider = execution
            .provider
            .as_deref()
            .filter(|value| matches!(*value, "openai" | "compatible"))
            .ok_or(AiProviderError::Configuration)?;
        if !execution.provider_enabled {
            return Err(AiProviderError::Configuration);
        }
        let encrypted_api_key = execution
            .encrypted_api_key
            .as_deref()
            .filter(|value| !value.is_empty())
            .ok_or(AiProviderError::Credential)?;
        let api_key_nonce = execution
            .api_key_nonce
            .as_deref()
            .filter(|value| !value.is_empty())
            .ok_or(AiProviderError::Credential)?;
        let model = execution
            .model
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or(AiProviderError::Configuration)?;
        let client = provider_client(
            provider,
            execution.base_url.as_deref(),
            execution.organization.as_deref(),
            encrypted_api_key,
            api_key_nonce,
            cipher,
        )?;
        let request = template_test_response_request(&execution, model)?;
        let response = client
            .responses()
            .create(request)
            .await
            .map_err(|_| AiProviderError::Response)?;
        if response.status != Status::Completed {
            return Err(AiProviderError::Response);
        }
        let text = response_text(&response);

        Ok(AiProviderTemplateTestOutput {
            text,
            model: model.to_owned(),
            provider: provider.to_owned(),
            response_id: Some(response.id),
            request_id: None,
            input_tokens: response
                .usage
                .as_ref()
                .map(|usage| i64::from(usage.input_tokens)),
            output_tokens: response
                .usage
                .as_ref()
                .map(|usage| i64::from(usage.output_tokens)),
            total_tokens: response.usage.map(|usage| i64::from(usage.total_tokens)),
        })
    }

    pub async fn companion_turn(
        execution: CompanionTurnExecution,
        cipher: &AiCredentialCipher,
    ) -> Result<String, AiProviderError> {
        let client = provider_client(
            &execution.provider,
            execution.base_url.as_deref(),
            execution.organization.as_deref(),
            &execution.encrypted_api_key,
            &execution.api_key_nonce,
            cipher,
        )?;
        let request = companion_response_request(&execution)?;
        let response = client
            .responses()
            .create(request)
            .await
            .map_err(|_| AiProviderError::Response)?;
        if response.status != Status::Completed {
            return Err(AiProviderError::Response);
        }
        let text = response_text(&response);
        (!text.trim().is_empty())
            .then_some(text)
            .ok_or(AiProviderError::Response)
    }

    pub async fn review_activity(
        execution: ActivityReviewExecution,
        cipher: &AiCredentialCipher,
    ) -> Result<AiProviderReviewOutput, AiProviderError> {
        let client = provider_client(
            &execution.provider,
            execution.base_url.as_deref(),
            execution.organization.as_deref(),
            &execution.encrypted_api_key,
            &execution.api_key_nonce,
            cipher,
        )?;
        let request = response_request(&execution)?;
        let response = client
            .responses()
            .create(request)
            .await
            .map_err(|_| AiProviderError::Response)?;
        if response.status != Status::Completed {
            return Err(AiProviderError::Response);
        }
        let text = response_text(&response);
        let review = serde_json::from_str(&text).map_err(|_| AiProviderError::Response)?;
        let usage = response
            .usage
            .map(|usage| ActivityReviewUsage {
                input_tokens: Some(i64::from(usage.input_tokens)),
                output_tokens: Some(i64::from(usage.output_tokens)),
                total_tokens: Some(i64::from(usage.total_tokens)),
            })
            .unwrap_or(ActivityReviewUsage {
                input_tokens: None,
                output_tokens: None,
                total_tokens: None,
            });
        Ok(AiProviderReviewOutput { review, usage })
    }

    pub async fn generate_content_plan(
        execution: &ContentAuthoringExecution,
        cipher: &AiCredentialCipher,
    ) -> Result<AiProviderContentPlanOutput, AiProviderError> {
        let client = provider_client(
            &execution.provider,
            execution.base_url.as_deref(),
            execution.organization.as_deref(),
            &execution.encrypted_api_key,
            &execution.api_key_nonce,
            cipher,
        )?;
        let request = content_plan_response_request(&execution)?;
        let response = client
            .responses()
            .create(request)
            .await
            .map_err(|_| AiProviderError::Response)?;
        if response.status != Status::Completed {
            return Err(AiProviderError::Response);
        }
        let text = response_text(&response);
        let plan = serde_json::from_str(&text).map_err(|_| AiProviderError::Response)?;
        let output = ContentAuthoringProviderOutput {
            plan,
            provider_response_id: Some(response.id),
            provider_request_id: None,
            input_tokens: response
                .usage
                .as_ref()
                .map(|usage| i64::from(usage.input_tokens)),
            output_tokens: response
                .usage
                .as_ref()
                .map(|usage| i64::from(usage.output_tokens)),
            total_tokens: response.usage.map(|usage| i64::from(usage.total_tokens)),
        };
        Ok(AiProviderContentPlanOutput { output })
    }
}

fn provider_client(
    provider: &str,
    base_url: Option<&str>,
    organization: Option<&str>,
    encrypted_api_key: &[u8],
    api_key_nonce: &[u8],
    cipher: &AiCredentialCipher,
) -> Result<Client<OpenAIConfig>, AiProviderError> {
    let api_key = String::from_utf8(
        cipher
            .decrypt(encrypted_api_key, api_key_nonce)
            .map_err(|_| AiProviderError::Credential)?,
    )
    .map_err(|_| AiProviderError::Credential)?;
    if api_key.trim().is_empty() {
        return Err(AiProviderError::Credential);
    }
    let api_base = match (provider, base_url) {
        ("openai", Some(url)) if !url.trim().is_empty() => url.trim(),
        ("openai", _) => "https://api.openai.com/v1",
        ("compatible", Some(url)) if !url.trim().is_empty() => url.trim(),
        _ => return Err(AiProviderError::Configuration),
    };
    let mut config = OpenAIConfig::new()
        .with_api_key(api_key)
        .with_api_base(api_base);
    if let Some(organization) = organization.filter(|value| !value.trim().is_empty()) {
        config = config.with_org_id(organization);
    }
    Ok(Client::with_config(config))
}

fn response_text(response: &async_openai::types::responses::Response) -> String {
    response
        .output
        .iter()
        .filter_map(|item| match item {
            OutputItem::Message(message) => Some(message),
            _ => None,
        })
        .flat_map(|message| message.content.iter())
        .filter_map(|content| match content {
            OutputMessageContent::OutputText(text) => Some(text.text.as_str()),
            _ => None,
        })
        .collect()
}

fn response_request(
    execution: &ActivityReviewExecution,
) -> Result<async_openai::types::responses::CreateResponse, AiProviderError> {
    let instructions = [
        execution.system_prompt.as_deref(),
        execution.task_prompt.as_deref(),
    ]
    .into_iter()
    .flatten()
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .collect::<Vec<_>>()
    .join("\n\n");
    let mut request = json!({
        "model": execution.model,
        "input": execution.prompt,
        "text": {"format": {"type": "json_schema", "name": "wicked_learning_activity_review", "description": "A structured, non-grading review of one learning activity.", "strict": true, "schema": activity_review_schema()}},
    });
    if !instructions.is_empty() {
        request["instructions"] = json!(instructions);
    }
    if let Some(maximum) = execution.max_output_tokens.filter(|value| *value > 0) {
        request["max_output_tokens"] = json!(maximum);
    }
    if let Some(temperature) = execution.temperature {
        request["temperature"] = json!(temperature);
    }
    if let Some(effort) = execution.reasoning_effort.as_deref() {
        request["reasoning"] = json!({"effort": effort});
    }
    serde_json::from_value(request).map_err(|_| AiProviderError::Configuration)
}

fn template_test_response_request(
    execution: &AiTemplateTestExecution,
    model: &str,
) -> Result<async_openai::types::responses::CreateResponse, AiProviderError> {
    let instructions = [
        execution.system_prompt.as_deref(),
        execution.task_prompt.as_deref(),
    ]
    .into_iter()
    .flatten()
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .collect::<Vec<_>>()
    .join("\n\n");
    let mut request = json!({
        "model": model,
        "input": execution.prompt,
    });
    if !instructions.is_empty() {
        request["instructions"] = json!(instructions);
    }
    if let Some(maximum) = execution.max_output_tokens.filter(|value| *value > 0) {
        request["max_output_tokens"] = json!(maximum);
    }
    if let Some(temperature) = execution.temperature {
        request["temperature"] = json!(temperature);
    }
    if let Some(effort) = execution.reasoning_effort.as_deref() {
        request["reasoning"] = json!({"effort": effort});
    }
    serde_json::from_value(request).map_err(|_| AiProviderError::Configuration)
}

fn content_plan_response_request(
    execution: &ContentAuthoringExecution,
) -> Result<async_openai::types::responses::CreateResponse, AiProviderError> {
    let instructions = [
        execution.system_prompt.as_deref(),
        execution.task_prompt.as_deref(),
    ]
    .into_iter()
    .flatten()
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .collect::<Vec<_>>()
    .join("\n\n");
    let mut request = json!({
        "model": execution.model,
        "input": execution.prompt,
        "text": {"format": {"type": "json_schema", "name": "wicked_learning_content_plan", "description": "A reviewable draft for one MapAsset and a short linear learning route.", "strict": true, "schema": content_plan_document()["schema"]}},
    });
    if !instructions.is_empty() {
        request["instructions"] = json!(instructions);
    }
    if let Some(maximum) = execution.max_output_tokens.filter(|value| *value > 0) {
        request["max_output_tokens"] = json!(maximum);
    }
    if let Some(temperature) = execution.temperature {
        request["temperature"] = json!(temperature);
    }
    if let Some(effort) = execution.reasoning_effort.as_deref() {
        request["reasoning"] = json!({"effort": effort});
    }
    serde_json::from_value(request).map_err(|_| AiProviderError::Configuration)
}

fn companion_response_request(
    execution: &CompanionTurnExecution,
) -> Result<async_openai::types::responses::CreateResponse, AiProviderError> {
    let instructions = [
        execution.system_prompt.as_deref(),
        execution.task_prompt.as_deref(),
    ]
    .into_iter()
    .flatten()
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .collect::<Vec<_>>()
    .join("\n\n");
    let mut request = json!({
        "model": execution.model,
        "input": execution.prompt,
    });
    if !instructions.is_empty() {
        request["instructions"] = json!(instructions);
    }
    if let Some(maximum) = execution.max_output_tokens.filter(|value| *value > 0) {
        request["max_output_tokens"] = json!(maximum.min(400));
    }
    if let Some(temperature) = execution.temperature {
        request["temperature"] = json!(temperature);
    }
    if let Some(effort) = execution.reasoning_effort.as_deref() {
        request["reasoning"] = json!({"effort": effort});
    }
    serde_json::from_value(request).map_err(|_| AiProviderError::Configuration)
}

#[cfg(test)]
mod tests {
    use super::{
        companion_response_request, content_plan_response_request, response_request,
        template_test_response_request,
    };
    use serde_json::json;
    use uuid::Uuid;
    use wicked_learning_application::learner_companion_turn::LearnerCompanionAssistanceLevel;
    use wicked_learning_persistence::{
        admin_activity_ai_review::ActivityReviewExecution,
        admin_ai_content_authoring::ContentAuthoringExecution,
        admin_ai_template_test::AiTemplateTestExecution, learner_companion::CompanionTurnExecution,
    };

    #[test]
    fn template_test_request_uses_the_saved_agent_controls_and_prompt() {
        let request = template_test_response_request(
            &AiTemplateTestExecution {
                provider: Some("openai".into()),
                provider_enabled: true,
                base_url: None,
                organization: None,
                encrypted_api_key: Some(vec![1]),
                api_key_nonce: Some(vec![2; 12]),
                model: Some("test-model".into()),
                system_prompt: Some("System boundary".into()),
                task_prompt: Some("Task boundary".into()),
                temperature: Some(0.4),
                reasoning_effort: None,
                max_output_tokens: Some(700),
                prompt: "A bounded test prompt".into(),
            },
            "test-model",
        )
        .expect("request");
        let request = serde_json::to_value(request).expect("serialize request");

        assert_eq!(request["input"], json!("A bounded test prompt"));
        assert_eq!(
            request["instructions"],
            json!("System boundary\n\nTask boundary")
        );
        assert!((request["temperature"].as_f64().expect("temperature") - 0.4).abs() < 0.000_001);
        assert_eq!(request["max_output_tokens"], json!(700));
    }

    #[test]
    fn response_request_keeps_the_named_strict_contract_and_server_prompt() {
        let request = response_request(&ActivityReviewExecution {
            activity_id: Uuid::new_v4(),
            template_id: Uuid::new_v4(),
            provider: "openai".into(),
            base_url: None,
            organization: None,
            encrypted_api_key: vec![1],
            api_key_nonce: vec![2; 12],
            model: "test-model".into(),
            system_prompt: Some("System boundary".into()),
            task_prompt: Some("Task boundary".into()),
            temperature: None,
            reasoning_effort: None,
            max_output_tokens: Some(600),
            prompt: "Scoped source context".into(),
        })
        .expect("request");
        let request = serde_json::to_value(request).expect("serialize request");
        assert_eq!(
            request["text"]["format"]["name"],
            json!("wicked_learning_activity_review")
        );
        assert_eq!(request["text"]["format"]["strict"], json!(true));
        assert_eq!(request["input"], json!("Scoped source context"));
        assert_eq!(
            request["instructions"],
            json!("System boundary\n\nTask boundary")
        );
    }

    #[test]
    fn companion_request_keeps_the_plain_text_guarded_prompt_and_output_cap() {
        let request = companion_response_request(&CompanionTurnExecution {
            activity_id: None,
            assistance_level: LearnerCompanionAssistanceLevel::Question,
            dialogue_node_id: "ai-turn".into(),
            encrypted_api_key: vec![1],
            api_key_nonce: vec![2; 12],
            base_url: None,
            model: "test-model".into(),
            organization: None,
            play_run_id: None,
            prompt: "Authored context only".into(),
            provider: "openai".into(),
            max_output_tokens: Some(4_000),
            reasoning_effort: None,
            system_prompt: Some("System boundary".into()),
            task_prompt: Some("Task boundary".into()),
            temperature: None,
        })
        .expect("request");
        let request = serde_json::to_value(request).expect("serialize request");

        assert_eq!(request["input"], json!("Authored context only"));
        assert_eq!(
            request["instructions"],
            json!("System boundary\n\nTask boundary")
        );
        assert_eq!(request["max_output_tokens"], json!(400));
        assert!(request.get("text").is_none());
    }

    #[test]
    fn content_plan_request_keeps_the_named_strict_contract_and_scoped_prompt() {
        let request = content_plan_response_request(&ContentAuthoringExecution {
            map_id: Uuid::new_v4(),
            template_id: Uuid::new_v4(),
            provider: "openai".into(),
            base_url: None,
            organization: None,
            encrypted_api_key: vec![1],
            api_key_nonce: vec![2; 12],
            model: "test-model".into(),
            system_prompt: Some("System boundary".into()),
            task_prompt: Some("Task boundary".into()),
            temperature: None,
            reasoning_effort: None,
            max_output_tokens: Some(600),
            prompt: "Scoped map context".into(),
            context: json!({}),
            brief:
                wicked_learning_application::admin_ai_content_authoring::ContentPlanBrief::parse(
                    Uuid::new_v4(),
                    "Draft a route",
                    None,
                    None,
                    1,
                    vec!["markdown".into()],
                    vec![],
                )
                .expect("brief"),
        })
        .expect("request");
        let request = serde_json::to_value(request).expect("serialize request");
        assert_eq!(
            request["text"]["format"]["name"],
            json!("wicked_learning_content_plan")
        );
        assert_eq!(request["text"]["format"]["strict"], json!(true));
        assert_eq!(request["input"], json!("Scoped map context"));
    }
}
