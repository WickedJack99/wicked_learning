use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction, types::Json};
use uuid::Uuid;
use wicked_learning_application::admin_ai_content_authoring::{
    CONTENT_PLAN_CONTRACT_VERSION, ContentPlanBrief, ContentPlanValidationError,
    validate_content_plan,
};
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
    pub created_at: String,
    pub applied_at: Option<String>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct EditableContentAuthoringRun {
    pub run: ContentAuthoringRun,
    pub allowed_activity_types: Vec<String>,
    pub selected_source_record_ids: Vec<Uuid>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ContentAuthoringPersistenceError;

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

    use super::{context_limits, prompt};
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
}
