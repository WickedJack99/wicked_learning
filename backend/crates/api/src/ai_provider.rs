use async_openai::{
    Client,
    config::OpenAIConfig,
    types::responses::{OutputItem, OutputMessageContent, Status},
};
use serde_json::{Value, json};
use wicked_learning_application::admin_activity_ai_review::activity_review_schema;
use wicked_learning_persistence::admin_activity_ai_review::{
    ActivityReviewExecution, ActivityReviewUsage,
};

use crate::ai_credential_crypto::AiCredentialCipher;

/// The sole outbound AI boundary. Browser handlers and application policy see
/// neither provider SDK types nor credential plaintext.
pub struct AiProvider;

pub struct AiProviderReviewOutput {
    pub review: Value,
    pub usage: ActivityReviewUsage,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AiProviderError {
    Configuration,
    Credential,
    Response,
}

impl AiProvider {
    pub async fn review_activity(
        execution: ActivityReviewExecution,
        cipher: &AiCredentialCipher,
    ) -> Result<AiProviderReviewOutput, AiProviderError> {
        let api_key = String::from_utf8(
            cipher
                .decrypt(&execution.encrypted_api_key, &execution.api_key_nonce)
                .map_err(|_| AiProviderError::Credential)?,
        )
        .map_err(|_| AiProviderError::Credential)?;
        if api_key.trim().is_empty() {
            return Err(AiProviderError::Credential);
        }
        if execution.provider != "openai" && execution.provider != "compatible" {
            return Err(AiProviderError::Configuration);
        }
        let api_base = match (execution.provider.as_str(), execution.base_url.as_deref()) {
            ("openai", Some(url)) if !url.trim().is_empty() => url.trim(),
            ("openai", _) => "https://api.openai.com/v1",
            ("compatible", Some(url)) if !url.trim().is_empty() => url.trim(),
            _ => return Err(AiProviderError::Configuration),
        };
        let mut config = OpenAIConfig::new()
            .with_api_key(api_key)
            .with_api_base(api_base);
        if let Some(organization) = execution
            .organization
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            config = config.with_org_id(organization);
        }
        let request = response_request(&execution)?;
        let response = Client::with_config(config)
            .responses()
            .create(request)
            .await
            .map_err(|_| AiProviderError::Response)?;
        if response.status != Status::Completed {
            return Err(AiProviderError::Response);
        }
        let text = response
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
            .collect::<String>();
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

#[cfg(test)]
mod tests {
    use super::response_request;
    use serde_json::json;
    use uuid::Uuid;
    use wicked_learning_persistence::admin_activity_ai_review::ActivityReviewExecution;

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
}
