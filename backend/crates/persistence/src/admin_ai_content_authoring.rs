use serde_json::{Map, Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction, types::Json};
use uuid::Uuid;
use wicked_learning_application::admin_ai_content_authoring::{
    CONTENT_PLAN_CONTRACT_VERSION, ContentPlanBrief, ContentPlanValidationError,
    validate_content_plan,
};
use wicked_learning_application::admin_world_reflection::generated_slug;
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

const CONTENT_API_CONTRACT_VERSION: &str = "1.0";

/// Server-only execution material. Its credential fields never leave the
/// provider adapter and must not be serialized into a draft or API response.
pub struct ContentAuthoringExecution {
    pub map_id: Uuid,
    pub template_id: Uuid,
    pub provider: String,
    pub base_url: Option<String>,
    pub organization: Option<String>,
    pub encrypted_api_key: Vec<u8>,
    pub api_key_nonce: Vec<u8>,
    pub model: String,
    pub system_prompt: Option<String>,
    pub task_prompt: Option<String>,
    pub temperature: Option<f64>,
    pub reasoning_effort: Option<String>,
    pub max_output_tokens: Option<i32>,
    pub prompt: String,
    pub context: Value,
    pub brief: ContentPlanBrief,
}

pub struct ContentAuthoringProviderOutput {
    pub plan: Value,
    pub provider_response_id: Option<String>,
    pub provider_request_id: Option<String>,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub total_tokens: Option<i64>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ContentAuthoringRun {
    pub id: Uuid,
    pub status: String,
    pub contract_version: String,
    pub plan: Value,
    pub source_records: Vec<Value>,
    pub warnings: Vec<String>,
    pub provider: String,
    pub model: String,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub total_tokens: Option<i64>,
    pub map_asset: Option<AppliedContentPlanMapAsset>,
    pub created_at: String,
    pub applied_at: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AppliedContentPlanMapAsset {
    pub id: Uuid,
    pub title: String,
    pub activity_count: usize,
}

#[derive(Clone, Debug, PartialEq)]
pub struct EditableContentAuthoringRun {
    pub run: ContentAuthoringRun,
    pub allowed_activity_types: Vec<String>,
    pub selected_source_record_ids: Vec<Uuid>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ContentAuthoringPersistenceError;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ContentAuthoringApplyError {
    Conflict,
    Rejected,
    Unavailable,
}

pub struct PostgresContentAuthoringRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresContentAuthoringRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }

    pub async fn prepare(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        brief: ContentPlanBrief,
    ) -> Result<Option<ContentAuthoringExecution>, ContentAuthoringPersistenceError> {
        prepare(self.pool, principal, map_id, brief)
            .await
            .map_err(unavailable)
    }

    pub async fn save_draft(
        &self,
        principal: &AuthorizedPrincipal,
        execution: &ContentAuthoringExecution,
        output: ContentAuthoringProviderOutput,
    ) -> Result<Option<ContentAuthoringRun>, ContentAuthoringPersistenceError> {
        save_draft(self.pool, principal, execution, output)
            .await
            .map_err(unavailable)
    }

    pub async fn load_editable_draft(
        &self,
        principal: &AuthorizedPrincipal,
        run_id: Uuid,
    ) -> Result<Option<EditableContentAuthoringRun>, ContentAuthoringPersistenceError> {
        load_editable_draft(self.pool, principal, run_id)
            .await
            .map_err(unavailable)
    }

    pub async fn update_draft(
        &self,
        principal: &AuthorizedPrincipal,
        run_id: Uuid,
        plan: Value,
    ) -> Result<Option<ContentAuthoringRun>, ContentAuthoringPersistenceError> {
        update_draft(self.pool, principal, run_id, plan)
            .await
            .map_err(unavailable)
    }

    /// Applies a human-reviewed draft in one transaction. This deliberately
    /// composes the established MapAsset/node/route and typed-activity storage
    /// invariants instead of issuing several independently committed commands.
    pub async fn apply_draft(
        &self,
        principal: &AuthorizedPrincipal,
        run_id: Uuid,
    ) -> Result<Option<ContentAuthoringRun>, ContentAuthoringApplyError> {
        apply_draft(self.pool, principal, run_id).await
    }
}

fn unavailable(error: sqlx::Error) -> ContentAuthoringPersistenceError {
    tracing::error!(%error, "could not process a scoped ContentPlan draft");
    ContentAuthoringPersistenceError
}

#[derive(FromRow)]
struct MapRow {
    id: Uuid,
    title: String,
    description: String,
    creator_id: Option<Uuid>,
}

#[derive(FromRow)]
struct TemplateRow {
    id: Uuid,
    provider: String,
    base_url: Option<String>,
    organization: Option<String>,
    api_key_ciphertext: Vec<u8>,
    api_key_nonce: Vec<u8>,
    model: String,
    system_prompt: Option<String>,
    task_prompt: Option<String>,
    temperature: Option<f64>,
    reasoning_effort: Option<String>,
    max_output_tokens: Option<i32>,
}

#[derive(FromRow)]
struct ExistingAssetRow {
    title: String,
    description: String,
    position_x: f64,
    position_y: f64,
}

#[derive(FromRow)]
struct SourceRow {
    id: Uuid,
    anchor: Option<String>,
    concepts: Json<Vec<String>>,
    excerpt: Option<String>,
    published_at: Option<String>,
    publisher: Option<String>,
    rights: Option<String>,
    title: String,
    url: String,
}

#[derive(FromRow)]
struct RunRow {
    id: Uuid,
    learning_map_id: Uuid,
    created_by_principal_id: Uuid,
    status: String,
    contract_version: String,
    context: Value,
    plan: Value,
    warnings: Json<Vec<String>>,
    provider: String,
    model: String,
    input_tokens: Option<i64>,
    output_tokens: Option<i64>,
    total_tokens: Option<i64>,
    created_at: String,
    applied_at: Option<String>,
}

const RUN_COLUMNS: &str = "id, learning_map_id, created_by_principal_id, status, contract_version, context, plan, warnings, provider, model, input_tokens, output_tokens, total_tokens, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, CASE WHEN applied_at IS NULL THEN NULL ELSE to_char(applied_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') END AS applied_at";

async fn prepare(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_id: Uuid,
    brief: ContentPlanBrief,
) -> Result<Option<ContentAuthoringExecution>, sqlx::Error> {
    if !principal.has_permission("ai", "ru")
        || !principal.has_permission("world_maps", "ru")
        || !principal.has_permission("world_activities", "ru")
    {
        return Ok(None);
    }
    let Some(principal_id) = principal_id(pool, principal).await? else {
        return Ok(None);
    };
    let Some(map) = map(pool, map_id).await? else {
        return Ok(None);
    };
    if !can_edit_map(pool, principal, principal_id, &map).await?
        || !can_edit_activity(pool, principal, principal_id, &map).await?
    {
        return Ok(None);
    }
    let Some(template) = template(pool, brief.template_id).await? else {
        return Ok(None);
    };
    let selected_source_records = selected_source_records(pool, &brief.source_record_ids).await?;
    if selected_source_records.len() != brief.source_record_ids.len() {
        return Ok(None);
    }
    let context = context(pool, &map, &brief, selected_source_records).await?;
    let prompt = prompt(&context, &brief);
    Ok(Some(ContentAuthoringExecution {
        map_id,
        template_id: template.id,
        provider: template.provider,
        base_url: template.base_url,
        organization: template.organization,
        encrypted_api_key: template.api_key_ciphertext,
        api_key_nonce: template.api_key_nonce,
        model: template.model,
        system_prompt: template.system_prompt,
        task_prompt: template.task_prompt,
        temperature: template.temperature,
        reasoning_effort: template.reasoning_effort,
        max_output_tokens: template.max_output_tokens,
        prompt,
        context,
        brief,
    }))
}

async fn save_draft(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    execution: &ContentAuthoringExecution,
    output: ContentAuthoringProviderOutput,
) -> Result<Option<ContentAuthoringRun>, sqlx::Error> {
    validate_content_plan(
        output.plan.clone(),
        &execution.brief.activity_types,
        Some(&execution.brief.source_record_ids),
    )
    .map_err(validation_error)?;
    if output.plan["activities"].as_array().map_or(0, Vec::len) != execution.brief.route_length {
        return Err(validation_error(ContentPlanValidationError));
    }
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = principal_id_tx(&mut transaction, principal).await? else {
        return Ok(None);
    };
    let Some(map) = map_tx(&mut transaction, execution.map_id).await? else {
        return Ok(None);
    };
    if !can_edit_map_tx(&mut transaction, principal, principal_id, &map).await?
        || !can_edit_activity_tx(&mut transaction, principal, principal_id, &map).await?
    {
        return Ok(None);
    }
    let warnings = warnings(&mut transaction, &map, &output.plan).await?;
    let contract_version =
        format!("{CONTENT_API_CONTRACT_VERSION}:{CONTENT_PLAN_CONTRACT_VERSION}");
    let row = sqlx::query_as::<_, RunRow>(&format!(
        "INSERT INTO ai_content_authoring_runs (learning_map_id, ai_agent_template_id, created_by_principal_id, contract_version, prompt, context, plan, warnings, provider, model, provider_response_id, provider_request_id, input_tokens, output_tokens, total_tokens) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING {RUN_COLUMNS}"
    ))
    .bind(execution.map_id)
    .bind(execution.template_id)
    .bind(principal_id)
    .bind(contract_version)
    .bind(&execution.prompt)
    .bind(Json(&execution.context))
    .bind(Json(&output.plan))
    .bind(Json(&warnings))
    .bind(&execution.provider)
    .bind(&execution.model)
    .bind(output.provider_response_id)
    .bind(output.provider_request_id)
    .bind(output.input_tokens)
    .bind(output.output_tokens)
    .bind(output.total_tokens)
    .fetch_one(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Some(run(row)))
}

async fn load_editable_draft(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    run_id: Uuid,
) -> Result<Option<EditableContentAuthoringRun>, sqlx::Error> {
    let Some(principal_id) = principal_id(pool, principal).await? else {
        return Ok(None);
    };
    let Some(row) = sqlx::query_as::<_, RunRow>(&format!(
        "SELECT {RUN_COLUMNS} FROM ai_content_authoring_runs WHERE id = $1"
    ))
    .bind(run_id)
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };
    if row.status != "draft" || row.created_by_principal_id != principal_id {
        return Ok(None);
    }
    let Some(map) = map(pool, row.learning_map_id).await? else {
        return Ok(None);
    };
    if !can_edit_map(pool, principal, principal_id, &map).await?
        || !can_edit_activity(pool, principal, principal_id, &map).await?
    {
        return Ok(None);
    }
    let (allowed_activity_types, selected_source_record_ids) = context_limits(&row.context)?;
    Ok(Some(EditableContentAuthoringRun {
        run: run(row),
        allowed_activity_types,
        selected_source_record_ids,
    }))
}

async fn update_draft(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    run_id: Uuid,
    plan: Value,
) -> Result<Option<ContentAuthoringRun>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = principal_id_tx(&mut transaction, principal).await? else {
        return Ok(None);
    };
    let Some(current) = sqlx::query_as::<_, RunRow>(&format!(
        "SELECT {RUN_COLUMNS} FROM ai_content_authoring_runs WHERE id = $1 FOR UPDATE"
    ))
    .bind(run_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    if current.status != "draft" || current.created_by_principal_id != principal_id {
        return Ok(None);
    }
    let Some(map) = map_tx(&mut transaction, current.learning_map_id).await? else {
        return Ok(None);
    };
    if !can_edit_map_tx(&mut transaction, principal, principal_id, &map).await?
        || !can_edit_activity_tx(&mut transaction, principal, principal_id, &map).await?
    {
        return Ok(None);
    }
    let (allowed_activity_types, selected_source_record_ids) = context_limits(&current.context)?;
    validate_content_plan(
        plan.clone(),
        &allowed_activity_types,
        Some(&selected_source_record_ids),
    )
    .map_err(validation_error)?;
    let draft_warnings = warnings(&mut transaction, &map, &plan).await?;
    let row = sqlx::query_as::<_, RunRow>(&format!(
        "UPDATE ai_content_authoring_runs SET plan = $2, warnings = $3, updated_at = NOW() WHERE id = $1 RETURNING {RUN_COLUMNS}"
    ))
    .bind(run_id)
    .bind(Json(&plan))
    .bind(Json(&draft_warnings))
    .fetch_one(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Some(run(row)))
}

async fn apply_draft(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    run_id: Uuid,
) -> Result<Option<ContentAuthoringRun>, ContentAuthoringApplyError> {
    if !principal.has_permission("ai", "ru")
        || !principal.has_permission("world_maps", "ru")
        || !principal.has_permission("world_activities", "ru")
    {
        return Ok(None);
    }
    let mut transaction = pool
        .begin()
        .await
        .map_err(|_| ContentAuthoringApplyError::Unavailable)?;
    let Some(principal_id) = principal_id_tx(&mut transaction, principal)
        .await
        .map_err(|_| ContentAuthoringApplyError::Unavailable)?
    else {
        return Ok(None);
    };
    let Some(current) = sqlx::query_as::<_, RunRow>(&format!(
        "SELECT {RUN_COLUMNS} FROM ai_content_authoring_runs WHERE id = $1 FOR UPDATE"
    ))
    .bind(run_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| ContentAuthoringApplyError::Unavailable)?
    else {
        return Ok(None);
    };
    if current.created_by_principal_id != principal_id {
        return Ok(None);
    }
    if current.status != "draft" {
        return Err(ContentAuthoringApplyError::Conflict);
    }
    let Some(map) = map_tx(&mut transaction, current.learning_map_id)
        .await
        .map_err(|_| ContentAuthoringApplyError::Unavailable)?
    else {
        return Ok(None);
    };
    if !can_edit_map_tx(&mut transaction, principal, principal_id, &map)
        .await
        .map_err(|_| ContentAuthoringApplyError::Unavailable)?
        || !can_edit_activity_tx(&mut transaction, principal, principal_id, &map)
            .await
            .map_err(|_| ContentAuthoringApplyError::Unavailable)?
    {
        return Ok(None);
    }
    let (allowed_activity_types, selected_source_record_ids) =
        context_limits(&current.context).map_err(|_| ContentAuthoringApplyError::Rejected)?;
    validate_content_plan(
        current.plan.clone(),
        &allowed_activity_types,
        Some(&selected_source_record_ids),
    )
    .map_err(|_| ContentAuthoringApplyError::Rejected)?;
    let route_length = current
        .context
        .pointer("/brief/routeLength")
        .and_then(Value::as_u64)
        .and_then(|length| usize::try_from(length).ok())
        .ok_or(ContentAuthoringApplyError::Rejected)?;
    let activities = current
        .plan
        .get("activities")
        .and_then(Value::as_array)
        .filter(|activities| activities.len() == route_length)
        .ok_or(ContentAuthoringApplyError::Rejected)?;
    let asset_plan = current
        .plan
        .get("mapAsset")
        .and_then(Value::as_object)
        .ok_or(ContentAuthoringApplyError::Rejected)?;
    let asset_title = required_plan_text(asset_plan, "title")?;
    let asset_description = nullable_plan_text(asset_plan, "description").unwrap_or_default();
    let asset_text = nullable_plan_text(asset_plan, "label").unwrap_or(asset_title);
    let position_q: i32 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(position_q), -1) + 1 FROM learning_nodes WHERE map_id = $1 AND position_r = 0",
    )
    .bind(map.id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|_| ContentAuthoringApplyError::Unavailable)?;
    let asset_id = Uuid::new_v4();
    let node_id = Uuid::new_v4();
    let route_id = Uuid::new_v4();
    let asset_slug = unique_map_slug(&mut transaction, map.id, "map-asset", "learning_map_assets")
        .await
        .map_err(|_| ContentAuthoringApplyError::Unavailable)?;
    let node_slug = unique_map_slug(&mut transaction, map.id, "map-asset", "learning_nodes")
        .await
        .map_err(|_| ContentAuthoringApplyError::Unavailable)?;
    sqlx::query("INSERT INTO learning_map_assets (id, map_id, slug, title, description, image_url, text, position_x, position_y, position_z, interaction_mode, published_at, width, opacity, locked, visual_config, interaction_config, sound_config) VALUES ($1, $2, $3, $4, $5, NULL, $6, 50, 50, 0, 'focusable', NULL, 14, 1, FALSE, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)")
        .bind(asset_id).bind(map.id).bind(asset_slug).bind(asset_title).bind(asset_description).bind(asset_text)
        .execute(&mut *transaction).await.map_err(|_| ContentAuthoringApplyError::Unavailable)?;
    sqlx::query("INSERT INTO learning_nodes (id, map_id, map_asset_id, slug, title, description, position_q, position_r, state, visual_config, published_at) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'available', '{}'::jsonb, NULL)")
        .bind(node_id).bind(map.id).bind(asset_id).bind(node_slug).bind(asset_title).bind(asset_description).bind(position_q)
        .execute(&mut *transaction).await.map_err(|_| ContentAuthoringApplyError::Unavailable)?;
    sqlx::query("INSERT INTO learning_routes (id, map_asset_id, slug, title, description, position, published_at) VALUES ($1, $2, 'map-asset', $3, $4, 0, NULL)")
        .bind(route_id).bind(asset_id).bind(asset_title).bind(asset_description)
        .execute(&mut *transaction).await.map_err(|_| ContentAuthoringApplyError::Unavailable)?;

    let source_records = current
        .context
        .get("selectedSourceRecords")
        .and_then(Value::as_array)
        .cloned()
        .ok_or(ContentAuthoringApplyError::Rejected)?;
    let mut activity_ids = Vec::with_capacity(activities.len());
    for (index, activity) in activities.iter().enumerate() {
        let activity = activity
            .as_object()
            .ok_or(ContentAuthoringApplyError::Rejected)?;
        let activity_type = required_plan_text(activity, "type")?;
        let title = required_plan_text(activity, "title")?;
        let introduction = nullable_plan_text(activity, "introduction");
        let activity_config =
            applied_activity_config(activity, &source_records, asset_id, &mut transaction).await?;
        let activity_id = Uuid::new_v4();
        let slug = unique_activity_slug(&mut transaction, asset_id, generated_slug(title))
            .await
            .map_err(|_| ContentAuthoringApplyError::Unavailable)?;
        sqlx::query("INSERT INTO learning_activities (id, route_id, slug, title, description, position, published_at, activity_type, activity_config, introduction, graph_position_x, graph_position_y, ai_review_status) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10, 80, 'needs_review')")
            .bind(activity_id).bind(route_id).bind(slug).bind(title).bind(introduction.unwrap_or_default()).bind(index as i16).bind(activity_type).bind(Json(&activity_config)).bind(introduction).bind(120 + (index as i32 * 260))
            .execute(&mut *transaction).await.map_err(|_| ContentAuthoringApplyError::Unavailable)?;
        if activity_type == "markdown" {
            synchronize_markdown_media_references(&mut transaction, activity_id, &activity_config)
                .await
                .map_err(|_| ContentAuthoringApplyError::Unavailable)?;
        }
        activity_ids.push(activity_id);
    }
    let Some(first_activity_id) = activity_ids.first() else {
        return Err(ContentAuthoringApplyError::Rejected);
    };
    sqlx::query("INSERT INTO learning_activity_starts (node_id, activity_id, sort_order) VALUES ($1, $2, 0)")
        .bind(node_id).bind(first_activity_id).execute(&mut *transaction).await.map_err(|_| ContentAuthoringApplyError::Unavailable)?;
    for (index, activity_id) in activity_ids.iter().enumerate() {
        sqlx::query("INSERT INTO learning_activity_transitions (from_activity_id, to_activity_id, from_connector, to_connector, trigger) VALUES ($1, $2, 'completed', 'in', 'completed')")
            .bind(activity_id).bind(activity_ids.get(index + 1).copied()).execute(&mut *transaction).await.map_err(|_| ContentAuthoringApplyError::Unavailable)?;
    }
    let row = sqlx::query_as::<_, RunRow>(&format!(
        "UPDATE ai_content_authoring_runs SET status = 'applied', applied_by_principal_id = $2, learning_map_asset_id = $3, applied_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING {RUN_COLUMNS}"
    ))
    .bind(run_id).bind(principal_id).bind(asset_id).fetch_one(&mut *transaction).await
    .map_err(|_| ContentAuthoringApplyError::Unavailable)?;
    transaction
        .commit()
        .await
        .map_err(|_| ContentAuthoringApplyError::Unavailable)?;
    let mut run = run(row);
    run.map_asset = Some(AppliedContentPlanMapAsset {
        id: asset_id,
        title: asset_title.to_owned(),
        activity_count: activity_ids.len(),
    });
    Ok(Some(run))
}

fn required_plan_text<'value>(
    value: &'value Map<String, Value>,
    key: &str,
) -> Result<&'value str, ContentAuthoringApplyError> {
    value
        .get(key)
        .and_then(Value::as_str)
        .filter(|text| !text.trim().is_empty())
        .ok_or(ContentAuthoringApplyError::Rejected)
}

fn nullable_plan_text<'value>(value: &'value Map<String, Value>, key: &str) -> Option<&'value str> {
    value
        .get(key)
        .and_then(Value::as_str)
        .filter(|text| !text.is_empty())
}

async fn applied_activity_config(
    activity: &Map<String, Value>,
    source_records: &[Value],
    map_asset_id: Uuid,
    transaction: &mut Transaction<'_, Postgres>,
) -> Result<Value, ContentAuthoringApplyError> {
    let activity_type = required_plan_text(activity, "type")?;
    let topics = activity
        .get("competenceTopics")
        .and_then(Value::as_array)
        .ok_or(ContentAuthoringApplyError::Rejected)?;
    let topic_values = topics
        .iter()
        .map(|topic| {
            let topic = topic
                .as_str()
                .filter(|topic| !topic.trim().is_empty())
                .ok_or(ContentAuthoringApplyError::Rejected)?;
            Ok((topic, generated_slug(topic)))
        })
        .collect::<Result<Vec<_>, ContentAuthoringApplyError>>()?;
    for (topic, slug) in &topic_values {
        sqlx::query("INSERT INTO competence_topic_definitions (slug, name, description, growth_threshold, emittance_threshold, aura_threshold, is_active) VALUES ($1, $2, NULL, 20, 20, 10, TRUE) ON CONFLICT (slug) DO NOTHING")
            .bind(slug).bind(topic).execute(&mut **transaction).await
            .map_err(|_| ContentAuthoringApplyError::Unavailable)?;
    }
    let mut config = Map::new();
    config.insert(
        "competenceTopics".to_owned(),
        json!(
            topic_values
                .iter()
                .map(|(topic, slug)| json!({ "topic": topic, "slug": slug, "weight": 1 }))
                .collect::<Vec<_>>()
        ),
    );
    config.insert(
        "learningIntent".to_owned(),
        activity
            .get("learningIntent")
            .cloned()
            .ok_or(ContentAuthoringApplyError::Rejected)?,
    );
    let references = source_references(activity, source_records)?;
    if !references.is_empty() {
        config.insert("sourceReferences".to_owned(), Value::Array(references));
    }
    match activity_type {
        "markdown" => {
            let title = required_plan_text(activity, "title")?;
            let body = nullable_plan_text(activity, "body")
                .filter(|body| !body.trim().is_empty())
                .ok_or(ContentAuthoringApplyError::Rejected)?;
            config.insert(
                "markdownGraphLayout".to_owned(),
                json!({
                    "start": { "x": -160, "y": 80 },
                    "end": { "x": 520, "y": 80 },
                }),
            );
            config.insert(
                "markdownPages".to_owned(),
                json!([{
                    "id": "page-1", "title": title, "body": body,
                    "position": { "x": 120, "y": 80 },
                    "visual": markdown_visual(),
                }]),
            );
            config.insert(
                "markdownTransitions".to_owned(),
                json!([
                    { "id": "edge-start", "from": "start", "to": "page-1" },
                    { "id": "edge-end", "from": "page-1", "to": "end" },
                ]),
            );
        }
        "reflection" => {
            config.insert(
                "prompt".to_owned(),
                json!(required_plan_text(activity, "prompt")?),
            );
            config.insert(
                "note".to_owned(),
                json!(nullable_plan_text(activity, "note").unwrap_or_default()),
            );
            config.insert("topic".to_owned(), json!(""));
            config.insert("subtopic".to_owned(), json!(""));
        }
        "message_prompt" => {
            let topic_title = required_plan_text(activity, "topic")?;
            let topic_id: Uuid = sqlx::query_scalar("INSERT INTO learning_message_topics (id, map_asset_id, slug, title) VALUES ($1, $2, $3, $4) ON CONFLICT (map_asset_id, slug) DO UPDATE SET updated_at = NOW() RETURNING id")
                .bind(Uuid::new_v4()).bind(map_asset_id).bind(generated_slug(topic_title)).bind(topic_title)
                .fetch_one(&mut **transaction).await.map_err(|_| ContentAuthoringApplyError::Unavailable)?;
            config.insert("messageTopicId".to_owned(), json!(topic_id));
            config.insert("messageAudience".to_owned(), json!("peers"));
            config.insert("messageAllowResponses".to_owned(), json!(false));
            config.insert("messageResponsePrompt".to_owned(), json!(""));
            config.insert(
                "messagePrompt".to_owned(),
                json!(required_plan_text(activity, "prompt")?),
            );
            config.insert(
                "messageInputLabel".to_owned(),
                json!(nullable_plan_text(activity, "inputLabel").unwrap_or("Your message")),
            );
            config.insert("messageUi".to_owned(), message_ui());
        }
        "shared_task" => {
            config.insert("taskKind".to_owned(), json!("text"));
            config.insert("showContributions".to_owned(), json!(false));
            config.insert(
                "prompt".to_owned(),
                json!(required_plan_text(activity, "prompt")?),
            );
            config.insert(
                "instructions".to_owned(),
                json!(nullable_plan_text(activity, "note").unwrap_or_default()),
            );
            config.insert(
                "inputLabel".to_owned(),
                json!(nullable_plan_text(activity, "inputLabel").unwrap_or("Your contribution")),
            );
            config.insert("projectGoal".to_owned(), json!(""));
            config.insert("projectDeliverable".to_owned(), json!(""));
            config.insert("projectSteps".to_owned(), json!([]));
            config.insert("peerReviewEnabled".to_owned(), json!(false));
            config.insert(
                "peerReviewPrompt".to_owned(),
                json!("What does this contribution help you notice, question, or extend?"),
            );
            config.insert("threshold".to_owned(), json!(3));
            config.insert("minimumLength".to_owned(), json!(20));
            config.insert("repeatPolicy".to_owned(), json!("once_per_user"));
            config.insert("validationMode".to_owned(), json!("minimum_length"));
            config.insert("cycleMode".to_owned(), json!("none"));
        }
        "open_practice" => {
            config.insert(
                "nextStep".to_owned(),
                json!(required_plan_text(activity, "prompt")?),
            );
        }
        _ => return Err(ContentAuthoringApplyError::Rejected),
    }
    Ok(Value::Object(config))
}

fn source_references(
    activity: &Map<String, Value>,
    source_records: &[Value],
) -> Result<Vec<Value>, ContentAuthoringApplyError> {
    let selected_ids = activity
        .get("sourceRecordIds")
        .and_then(Value::as_array)
        .ok_or(ContentAuthoringApplyError::Rejected)?;
    selected_ids
        .iter()
        .map(|id| {
            let id = id.as_str().ok_or(ContentAuthoringApplyError::Rejected)?;
            let record = source_records
                .iter()
                .find(|record| record.get("id").and_then(Value::as_str) == Some(id))
                .and_then(Value::as_object)
                .ok_or(ContentAuthoringApplyError::Rejected)?;
            let mut snapshot = record.clone();
            snapshot.remove("id");
            Ok(Value::Object(snapshot))
        })
        .collect()
}

fn markdown_visual() -> Value {
    json!({
        "pageColorDark": "#0f172a", "pageColorLight": "#ffffff",
        "borderColorDark": "#2dd4bf", "borderColorLight": "#0891b2",
        "headingColorDark": "#67e8f9", "headingColorLight": "#0e7490",
        "textColorDark": "#f8fafc", "textColorLight": "#0f172a",
    })
}

fn message_ui() -> Value {
    json!({
        "surfaceColorDark": "#071018", "surfaceColorLight": "#e6f5f2",
        "cardColorDark": "#13262d", "cardColorLight": "#ffffff",
        "cardBorderColorDark": "#2dd4bf", "cardBorderColorLight": "#0f766e",
        "textColorDark": "#f1f5f9", "textColorLight": "#0f172a",
        "accentColorDark": "#5eead4", "accentColorLight": "#0f766e",
    })
}

async fn synchronize_markdown_media_references(
    transaction: &mut Transaction<'_, Postgres>,
    activity_id: Uuid,
    config: &Value,
) -> Result<(), sqlx::Error> {
    const PREFIX: &str = "/api/v1/admin/media-assets/";
    const MAX_REFERENCES: usize = 24;
    let Some(pages) = config.get("markdownPages").and_then(Value::as_array) else {
        return Ok(());
    };
    let mut references = Vec::new();
    for (index, page) in pages.iter().enumerate() {
        let Some(body) = page.get("body").and_then(Value::as_str) else {
            continue;
        };
        let mut remaining = body;
        while let Some(prefix_index) = remaining.find(PREFIX) {
            let after_prefix = &remaining[prefix_index + PREFIX.len()..];
            let Some(asset_id) = after_prefix
                .get(..36)
                .and_then(|value| Uuid::parse_str(value).ok())
            else {
                remaining = &after_prefix[after_prefix.len().min(1)..];
                continue;
            };
            let suffix = &after_prefix[36..];
            if let Some(next) = suffix.strip_prefix("/content") {
                references.push((asset_id, format!("markdownPages[{index}].body")));
                if references.len() == MAX_REFERENCES {
                    break;
                }
                remaining = next;
            } else {
                remaining = suffix;
            }
        }
        if references.len() == MAX_REFERENCES {
            break;
        }
    }
    for (asset_id, field_key) in references {
        sqlx::query("INSERT INTO reusable_media_asset_references (asset_id, owner_kind, owner_id, field_key) SELECT id, 'activity', $2, $3 FROM reusable_media_assets WHERE id = $1 ON CONFLICT DO NOTHING")
            .bind(asset_id).bind(activity_id).bind(field_key).execute(&mut **transaction).await?;
    }
    Ok(())
}

async fn unique_map_slug(
    transaction: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
    base: &str,
    table: &str,
) -> Result<String, sqlx::Error> {
    let mut candidate = base.to_owned();
    for suffix in 2..=10_000 {
        let query =
            format!("SELECT EXISTS (SELECT 1 FROM {table} WHERE map_id = $1 AND slug = $2)");
        let exists: bool = sqlx::query_scalar(&query)
            .bind(map_id)
            .bind(&candidate)
            .fetch_one(&mut **transaction)
            .await?;
        if !exists {
            return Ok(candidate);
        }
        candidate = format!("{base}-{suffix}");
    }
    Err(sqlx::Error::Protocol(
        "could not allocate a unique ContentPlan map slug".into(),
    ))
}

async fn unique_activity_slug(
    transaction: &mut Transaction<'_, Postgres>,
    map_asset_id: Uuid,
    base: String,
) -> Result<String, sqlx::Error> {
    let mut candidate = base.clone();
    for suffix in 2..=10_000 {
        let exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id WHERE routes.map_asset_id = $1 AND activities.slug = $2)")
            .bind(map_asset_id).bind(&candidate).fetch_one(&mut **transaction).await?;
        if !exists {
            return Ok(candidate);
        }
        candidate = format!("{base}-{suffix}");
    }
    Err(sqlx::Error::Protocol(
        "could not allocate a unique ContentPlan activity slug".into(),
    ))
}

async fn principal_id(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(principal.subject_id)
        .fetch_optional(pool)
        .await
}

async fn principal_id_tx(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(principal.subject_id)
        .fetch_optional(&mut **transaction)
        .await
}

async fn map(pool: &PgPool, map_id: Uuid) -> Result<Option<MapRow>, sqlx::Error> {
    sqlx::query_as("SELECT id, title, description, created_by_principal_id AS creator_id FROM learning_maps WHERE id = $1")
        .bind(map_id)
        .fetch_optional(pool)
        .await
}

async fn map_tx(
    transaction: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
) -> Result<Option<MapRow>, sqlx::Error> {
    sqlx::query_as("SELECT id, title, description, created_by_principal_id AS creator_id FROM learning_maps WHERE id = $1 FOR UPDATE")
        .bind(map_id)
        .fetch_optional(&mut **transaction)
        .await
}

async fn can_edit_map(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map: &MapRow,
) -> Result<bool, sqlx::Error> {
    let direct: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id = $1 AND memberships.principal_id = $2)")
        .bind(map.id).bind(principal_id).fetch_one(pool).await?;
    Ok(permission_allows(
        principal,
        "world_maps",
        principal_id,
        map.creator_id,
        direct,
    ))
}

async fn can_edit_map_tx(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map: &MapRow,
) -> Result<bool, sqlx::Error> {
    let direct: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id = $1 AND memberships.principal_id = $2)")
        .bind(map.id).bind(principal_id).fetch_one(&mut **transaction).await?;
    Ok(permission_allows(
        principal,
        "world_maps",
        principal_id,
        map.creator_id,
        direct,
    ))
}

async fn can_edit_activity(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map: &MapRow,
) -> Result<bool, sqlx::Error> {
    let direct: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id = $1 AND memberships.principal_id = $2)")
        .bind(map.id).bind(principal_id).fetch_one(pool).await?;
    Ok(permission_allows(
        principal,
        "world_activities",
        principal_id,
        map.creator_id,
        direct,
    ))
}

async fn can_edit_activity_tx(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map: &MapRow,
) -> Result<bool, sqlx::Error> {
    let direct: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id = $1 AND memberships.principal_id = $2)")
        .bind(map.id).bind(principal_id).fetch_one(&mut **transaction).await?;
    Ok(permission_allows(
        principal,
        "world_activities",
        principal_id,
        map.creator_id,
        direct,
    ))
}

fn permission_allows(
    principal: &AuthorizedPrincipal,
    resource: &str,
    principal_id: Uuid,
    creator_id: Option<Uuid>,
    direct: bool,
) -> bool {
    let Some(scope) = principal.permission_scope(resource, "ru") else {
        return false;
    };
    scope == "all"
        || (permission_scope_allows(scope, "own") && creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct)
        || direct
}

async fn template(pool: &PgPool, template_id: Uuid) -> Result<Option<TemplateRow>, sqlx::Error> {
    let row = sqlx::query_as::<_, TemplateRow>("SELECT templates.id, providers.provider, providers.base_url, providers.organization, providers.api_key_ciphertext, providers.api_key_nonce, templates.model, templates.system_prompt, templates.task_prompt, templates.temperature::DOUBLE PRECISION AS temperature, templates.reasoning_effort, templates.max_output_tokens FROM ai_agent_templates AS templates INNER JOIN ai_provider_credentials AS providers ON providers.id = templates.ai_provider_credential_id WHERE templates.id = $1 AND templates.purpose = 'content_authoring' AND templates.enabled AND providers.enabled AND providers.api_key_ciphertext IS NOT NULL AND providers.api_key_nonce IS NOT NULL AND NULLIF(BTRIM(templates.model), '') IS NOT NULL")
        .bind(template_id).fetch_optional(pool).await?;
    Ok(row.filter(|template| {
        (template.provider == "openai" || template.provider == "compatible")
            && (template.provider != "compatible"
                || template
                    .base_url
                    .as_deref()
                    .is_some_and(|url| !url.trim().is_empty()))
    }))
}

async fn selected_source_records(
    pool: &PgPool,
    source_ids: &[Uuid],
) -> Result<Vec<Value>, sqlx::Error> {
    if source_ids.is_empty() {
        return Ok(vec![]);
    }
    let rows = sqlx::query_as::<_, SourceRow>("SELECT id, anchor, concepts, excerpt, to_char(published_at, 'YYYY-MM-DD') AS published_at, publisher, rights, title, url FROM learning_source_records WHERE id = ANY($1)")
        .bind(source_ids).fetch_all(pool).await?;
    Ok(source_ids
        .iter()
        .filter_map(|source_id| rows.iter().find(|row| row.id == *source_id))
        .map(source)
        .collect())
}

fn source(row: &SourceRow) -> Value {
    json!({"id":row.id,"anchor":row.anchor,"concepts":row.concepts.0,"excerpt":row.excerpt,"publishedAt":row.published_at,"publisher":row.publisher,"rights":row.rights,"title":row.title,"url":row.url})
}

async fn context(
    pool: &PgPool,
    map: &MapRow,
    brief: &ContentPlanBrief,
    selected_source_records: Vec<Value>,
) -> Result<Value, sqlx::Error> {
    let assets = sqlx::query_as::<_, ExistingAssetRow>("SELECT nodes.title, nodes.description, assets.position_x, assets.position_y FROM learning_map_assets AS assets INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id WHERE assets.map_id = $1 ORDER BY assets.position_z ASC, assets.id ASC")
        .bind(map.id).fetch_all(pool).await?;
    let topics = sqlx::query_scalar::<_, String>(
        "SELECT name FROM competence_topic_definitions WHERE is_active ORDER BY name ASC",
    )
    .fetch_all(pool)
    .await?;
    Ok(json!({
        "map":{"id":map.id,"title":map.title,"description":map.description},
        "existingMapAssets":assets.into_iter().map(|asset| json!({"title":asset.title,"description":asset.description,"positionX":asset.position_x,"positionY":asset.position_y})).collect::<Vec<_>>(),
        "availableCompetenceTopics":topics,
        "selectedSourceRecords":selected_source_records,
        "brief":{"goal":brief.goal,"targetAudience":brief.target_audience,"priorKnowledge":brief.prior_knowledge,"routeLength":brief.route_length,"activityTypes":brief.activity_types}
    }))
}

fn prompt(context: &Value, brief: &ContentPlanBrief) -> String {
    format!(
        "Draft one MapAsset and a short linear learning route for Wicked Learning.\n\nThis is a draft only. An administrator will review it before anything is created.\n\nUse exactly {} Activities and only these Activity types: {}.\n\nFor every Activity, provide one to three concise competenceTopics labels drawn from the learning goal, and choose one learningIntent from apply, explain, participate, reflect, retrieve, review or transfer. Reuse an available competence topic label exactly when it fits; propose a concise new label only when none fits. These are teaching design metadata, not learner scores, and you must not output topic weights or thresholds. For markdown Activities, set body and use null for prompt, note, topic and inputLabel. For reflection Activities, set prompt, optionally note, and use null for body, topic and inputLabel. For message_prompt Activities, set prompt, topic and optionally inputLabel, and use null for body and note. For shared_task Activities, set prompt, optionally note and inputLabel, use null for body and topic, and invite a concrete learner contribution without scores or rankings. For open_practice Activities, set prompt to a concrete invitation for a learner-owned next step, and use null for body, note, topic and inputLabel.\n\nDo not invent image paths, user data, IDs, scores, rewards, rankings, or claims about learner performance.\n\nIf selected source records are provided, use them as optional factual grounding. Preserve their titles, URLs, publishers, anchors and excerpts accurately; do not invent citations or imply that an unselected source supports the draft. For each Activity, put the UUIDs of only directly supporting selected records in sourceRecordIds; use an empty array when no selected record directly supports that Activity.\n\nKeep the route supportive, concrete, and appropriate for the stated audience and prior knowledge.\n\nMap and authoring context:\n{}\n\nContentPlan contract:\n{}",
        brief.route_length,
        brief.activity_types.join(", "),
        serde_json::to_string_pretty(context).expect("context is serializable"),
        serde_json::to_string_pretty(
            &wicked_learning_application::admin_ai_content_authoring::content_plan_document()
        )
        .expect("contract is serializable")
    )
}

async fn warnings(
    transaction: &mut Transaction<'_, Postgres>,
    map: &MapRow,
    plan: &Value,
) -> Result<Vec<String>, sqlx::Error> {
    let title = plan["mapAsset"]["title"]
        .as_str()
        .unwrap_or_default()
        .trim();
    let duplicate: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_nodes WHERE map_id = $1 AND LOWER(title) = LOWER($2))")
        .bind(map.id).bind(title).fetch_one(&mut **transaction).await?;
    let occupied: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_assets WHERE map_id = $1 AND position_x BETWEEN 45 AND 55 AND position_y BETWEEN 45 AND 55)")
        .bind(map.id).fetch_one(&mut **transaction).await?;
    let mut warnings = vec![];
    if duplicate {
        warnings.push("A MapAsset with the same title already exists on this map.".to_owned());
    }
    if occupied {
        warnings.push("The center of this map already contains a MapAsset. Move the new draft after applying it.".to_owned());
    }
    Ok(warnings)
}

fn context_limits(context: &Value) -> Result<(Vec<String>, Vec<Uuid>), sqlx::Error> {
    let activity_type_values = context
        .get("brief")
        .and_then(|brief| brief.get("activityTypes"))
        .and_then(Value::as_array)
        .ok_or_else(|| {
            sqlx::Error::Protocol(
                "ContentPlan draft context is missing activity type limits".into(),
            )
        })?;
    let activity_types = activity_type_values
        .iter()
        .map(|value| {
            value.as_str().map(str::to_owned).ok_or_else(|| {
                sqlx::Error::Protocol("ContentPlan draft has invalid activity type limits".into())
            })
        })
        .collect::<Result<Vec<_>, _>>()?;
    let source_record_values = context
        .get("selectedSourceRecords")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            sqlx::Error::Protocol("ContentPlan draft context is missing source records".into())
        })?;
    let source_ids = source_record_values
        .iter()
        .map(|value| {
            value
                .get("id")
                .and_then(Value::as_str)
                .and_then(|id| Uuid::parse_str(id).ok())
                .ok_or_else(|| {
                    sqlx::Error::Protocol("ContentPlan draft has invalid source records".into())
                })
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok((activity_types, source_ids))
}

fn run(row: RunRow) -> ContentAuthoringRun {
    let source_records = row
        .context
        .get("selectedSourceRecords")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    ContentAuthoringRun {
        id: row.id,
        status: row.status,
        contract_version: row.contract_version,
        plan: row.plan,
        source_records,
        warnings: row.warnings.0,
        provider: row.provider,
        model: row.model,
        input_tokens: row.input_tokens,
        output_tokens: row.output_tokens,
        total_tokens: row.total_tokens,
        map_asset: None,
        created_at: row.created_at,
        applied_at: row.applied_at,
    }
}

fn validation_error(_: ContentPlanValidationError) -> sqlx::Error {
    sqlx::Error::Protocol("ContentPlan validation failed before persistence".into())
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use uuid::Uuid;

    use super::{context_limits, prompt, source_references};
    use wicked_learning_application::admin_ai_content_authoring::ContentPlanBrief;

    #[test]
    fn prompt_exposes_only_scoped_context_and_named_contract() {
        let brief = ContentPlanBrief::parse(
            Uuid::new_v4(),
            "Draft energy learning",
            None,
            None,
            1,
            vec!["markdown".into()],
            vec![],
        )
        .expect("brief");
        let prompt = prompt(
            &json!({"map":{"title":"Energy map"},"selectedSourceRecords":[],"brief":{"activityTypes":["markdown"]}}),
            &brief,
        );
        assert!(prompt.contains("Energy map"));
        assert!(prompt.contains("ContentPlan contract"));
        assert!(!prompt.contains("private learner journal"));
    }

    #[test]
    fn stored_context_reconstructs_only_its_authorized_limits() {
        let source = Uuid::new_v4();
        let (types, sources) = context_limits(&json!({"brief":{"activityTypes":["markdown","reflection"]},"selectedSourceRecords":[{"id":source}]})).expect("limits");
        assert_eq!(types, ["markdown", "reflection"]);
        assert_eq!(sources, [source]);
    }

    #[test]
    fn applying_a_plan_copies_only_selected_source_snapshots_without_internal_ids() {
        let source = Uuid::new_v4();
        let references = source_references(
            json!({"sourceRecordIds":[source]})
                .as_object()
                .expect("activity object"),
            &[json!({
                "id": source, "title": "Energy field guide", "url": "https://example.test/energy",
                "publisher": "Example Press", "concepts": ["Energy"]
            })],
        )
        .expect("selected source snapshot");

        assert_eq!(references[0]["title"], "Energy field guide");
        assert!(references[0].get("id").is_none());
    }
}
