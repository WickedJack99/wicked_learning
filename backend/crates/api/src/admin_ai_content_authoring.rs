use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;
use wicked_learning_application::admin_ai_content_authoring::{
    ContentPlanBrief, validate_content_plan,
};
use wicked_learning_persistence::admin_ai_content_authoring::{
    ContentAuthoringRun, PostgresContentAuthoringRepository,
};

use crate::{
    AppState, ai_provider::AiProvider, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct GenerateContentPlanRequest {
    template_id: Uuid,
    goal: String,
    target_audience: Option<String>,
    prior_knowledge: Option<String>,
    route_length: usize,
    activity_types: Vec<String>,
    #[serde(default)]
    source_record_ids: Vec<Uuid>,
}

#[derive(Deserialize)]
pub struct UpdateContentPlanRequest {
    plan: Value,
}

/// Generates and persists one reviewable ContentPlan draft. The model receives
/// only scoped map and explicitly selected source context; no generated content
/// is applied by this endpoint.
pub async fn generate(
    State(state): State<AppState>,
    Path(map_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<GenerateContentPlanRequest>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let map_id = Uuid::parse_str(&map_id).map_err(|_| ApiError::not_found())?;
    let brief = ContentPlanBrief::parse(
        request.template_id,
        &request.goal,
        request.target_audience.as_deref(),
        request.prior_knowledge.as_deref(),
        request.route_length,
        request.activity_types,
        request.source_record_ids,
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    if !principal.has_permission("ai", "ru") {
        return Err(ApiError::forbidden());
    }
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresContentAuthoringRepository::new(&state.application_database);
    let execution = repository
        .prepare(&principal, map_id, brief)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    let output = AiProvider::generate_content_plan(&execution, &state.ai_credential_cipher)
        .await
        .map_err(|_| ApiError::content_plan_rejected())?
        .output;
    validate_content_plan(
        output.plan.clone(),
        &execution.brief.activity_types,
        Some(&execution.brief.source_record_ids),
    )
    .map_err(|_| ApiError::content_plan_rejected())?;
    if output.plan["activities"].as_array().map_or(0, Vec::len) != execution.brief.route_length {
        return Err(ApiError::content_plan_rejected());
    }
    let run = repository
        .save_draft(&principal, &execution, output)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(json!({ "data": serialize_run(run) })),
    ))
}

/// Saves a human-edited draft after validating it against the original brief
/// and source-record snapshot. It never creates a MapAsset or Activity.
pub async fn update(
    State(state): State<AppState>,
    Path(run_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateContentPlanRequest>,
) -> Result<Json<Value>, ApiError> {
    let run_id = Uuid::parse_str(&run_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    if !principal.has_permission("ai", "ru") {
        return Err(ApiError::forbidden());
    }
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresContentAuthoringRepository::new(&state.application_database);
    let editable = repository
        .load_editable_draft(&principal, run_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    validate_content_plan(
        request.plan.clone(),
        &editable.allowed_activity_types,
        Some(&editable.selected_source_record_ids),
    )
    .map_err(|_| ApiError::content_plan_rejected())?;
    let run = repository
        .update_draft(&principal, run_id, request.plan)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(json!({ "data": serialize_run(run) })))
}

fn serialize_run(run: ContentAuthoringRun) -> Value {
    json!({
        "id": run.id,
        "status": run.status,
        "contractVersion": run.contract_version,
        "plan": run.plan,
        "sourceRecords": run.source_records,
        "warnings": run.warnings,
        "provider": run.provider,
        "model": run.model,
        "usage": { "inputTokens": run.input_tokens, "outputTokens": run.output_tokens, "totalTokens": run.total_tokens },
        "mapAsset": Value::Null,
        "createdAt": run.created_at,
        "appliedAt": run.applied_at,
    })
}

#[cfg(test)]
mod tests {
    use serde_json::{Value, json};
    use uuid::Uuid;

    use super::{GenerateContentPlanRequest, serialize_run};
    use wicked_learning_persistence::admin_ai_content_authoring::ContentAuthoringRun;

    #[test]
    fn accepts_the_source_brief_shape_with_uuid_source_records() {
        let source_record_id = Uuid::new_v4();
        let request = serde_json::from_value::<GenerateContentPlanRequest>(json!({
            "template_id": Uuid::new_v4(), "goal": "Draft a route", "target_audience": null,
            "prior_knowledge": null, "route_length": 1, "activity_types": ["markdown"],
            "source_record_ids": [source_record_id]
        }))
        .expect("request");
        assert_eq!(request.source_record_ids, [source_record_id]);
    }

    #[test]
    fn serializes_only_reviewable_draft_state() {
        let id = Uuid::new_v4();
        let value = serialize_run(ContentAuthoringRun {
            id,
            status: "draft".into(),
            contract_version: "1.0:1.5".into(),
            plan: json!({}),
            source_records: vec![],
            warnings: vec![],
            provider: "openai".into(),
            model: "test".into(),
            input_tokens: Some(1),
            output_tokens: Some(2),
            total_tokens: Some(3),
            created_at: "2026-11-13T00:00:00.000000Z".into(),
            applied_at: None,
        });
        assert_eq!(value["id"], json!(id));
        assert_eq!(value["mapAsset"], Value::Null);
        assert!(value.get("prompt").is_none());
    }
}
