use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction, types::Json};
use uuid::Uuid;
use wicked_learning_application::admin_activity_ai_review::activity_review_schema;
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

const REVIEW_CONTRACT_VERSION: &str = "1.2";

/// Server-only material required to invoke a configured review helper. This
/// type is never serialized and its encrypted API key is only decrypted by the
/// API's provider adapter immediately before an outbound request.
pub struct ActivityReviewExecution {
    pub activity_id: Uuid,
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
}

pub struct ActivityReviewUsage {
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub total_tokens: Option<i64>,
}

pub struct SavedActivityReview {
    pub activity_id: Uuid,
    pub ai_review_status: String,
    pub ai_reviewed_at: String,
    pub ai_review: Value,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ActivityReviewPersistenceError;

pub struct PostgresAdminActivityAiReviewRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminActivityAiReviewRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }

    pub async fn prepare(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        template_id: Uuid,
    ) -> Result<Option<ActivityReviewExecution>, ActivityReviewPersistenceError> {
        prepare(self.pool, principal, activity_id, template_id)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not prepare activity AI review");
                ActivityReviewPersistenceError
            })
    }

    pub async fn save(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        template_id: Uuid,
        provider: &str,
        model: &str,
        review: Value,
        usage: ActivityReviewUsage,
    ) -> Result<Option<SavedActivityReview>, ActivityReviewPersistenceError> {
        save(
            self.pool,
            principal,
            activity_id,
            template_id,
            provider,
            model,
            review,
            usage,
        )
        .await
        .map_err(|error| {
            tracing::error!(%error, "could not save activity AI review");
            ActivityReviewPersistenceError
        })
    }
}

#[derive(FromRow)]
struct ActivityRow {
    id: Uuid,
    activity_type: String,
    title: String,
    introduction: Option<String>,
    config: Value,
    node_title: String,
    node_description: String,
    map_title: String,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
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
struct NeighborRow {
    title: String,
    activity_type: String,
    config: Value,
}
#[derive(FromRow)]
struct DialogueRow {
    node_type: String,
    title: String,
    body: Option<String>,
}
#[derive(FromRow)]
struct SavedRow {
    id: Uuid,
    status: String,
    reviewed_at: String,
    review: Value,
}

async fn prepare(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    template_id: Uuid,
) -> Result<Option<ActivityReviewExecution>, sqlx::Error> {
    if !principal.has_permission("ai", "ru") || !principal.has_permission("world_activities", "ru")
    {
        return Ok(None);
    }
    let Some(principal_id) = principal_id(pool, principal).await? else {
        return Ok(None);
    };
    let Some(activity) = sqlx::query_as::<_, ActivityRow>("SELECT activities.id, activities.activity_type, activities.title, activities.introduction, activities.activity_config AS config, nodes.title AS node_title, nodes.description AS node_description, maps.title AS map_title, maps.id AS map_id, maps.created_by_principal_id AS map_creator_id FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE activities.id = $1")
        .bind(activity_id).fetch_optional(pool).await? else { return Ok(None); };
    if !can_edit_activity(
        pool,
        principal,
        principal_id,
        activity.map_id,
        activity.map_creator_id,
    )
    .await?
    {
        return Ok(None);
    }
    let Some(template) = sqlx::query_as::<_, TemplateRow>("SELECT templates.id, providers.provider, providers.base_url, providers.organization, providers.api_key_ciphertext, providers.api_key_nonce, templates.model, templates.system_prompt, templates.task_prompt, templates.temperature::DOUBLE PRECISION AS temperature, templates.reasoning_effort, templates.max_output_tokens FROM ai_agent_templates AS templates INNER JOIN ai_provider_credentials AS providers ON providers.id = templates.ai_provider_credential_id WHERE templates.id = $1 AND templates.purpose = 'activity_review' AND templates.enabled AND providers.enabled AND providers.api_key_ciphertext IS NOT NULL AND providers.api_key_nonce IS NOT NULL AND NULLIF(BTRIM(templates.model), '') IS NOT NULL")
        .bind(template_id).fetch_optional(pool).await? else { return Ok(None); };
    if template.provider != "openai" && template.provider != "compatible" {
        return Ok(None);
    }
    if template.provider == "compatible"
        && template
            .base_url
            .as_deref()
            .is_none_or(|url| url.trim().is_empty())
    {
        return Ok(None);
    }
    let context = review_context(pool, &activity).await?;
    Ok(Some(ActivityReviewExecution {
        activity_id: activity.id,
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
        prompt: review_prompt(context),
    }))
}

async fn save(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    template_id: Uuid,
    provider: &str,
    model: &str,
    review: Value,
    usage: ActivityReviewUsage,
) -> Result<Option<SavedActivityReview>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = principal_id_tx(&mut transaction, principal).await? else {
        return Ok(None);
    };
    let Some(activity) = sqlx::query_as::<_, ActivityRow>("SELECT activities.id, activities.activity_type, activities.title, activities.introduction, activities.activity_config AS config, nodes.title AS node_title, nodes.description AS node_description, maps.title AS map_title, maps.id AS map_id, maps.created_by_principal_id AS map_creator_id FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE activities.id = $1 FOR UPDATE OF activities, nodes")
        .bind(activity_id).fetch_optional(&mut *transaction).await? else { return Ok(None); };
    if !can_edit_activity_tx(
        &mut transaction,
        principal,
        principal_id,
        activity.map_id,
        activity.map_creator_id,
    )
    .await?
    {
        return Ok(None);
    }
    let review_record = json!({"contractVersion": REVIEW_CONTRACT_VERSION, "review": review, "provider": provider, "model": model, "reviewedByPrincipalId": principal_id, "usage": {"inputTokens": usage.input_tokens, "outputTokens": usage.output_tokens, "totalTokens": usage.total_tokens}});
    let saved = sqlx::query_as::<_, SavedRow>("UPDATE learning_activities SET ai_review_status = 'reviewed', ai_reviewed_at = NOW(), ai_review = $2, updated_at = NOW() WHERE id = $1 RETURNING id, ai_review_status AS status, to_char(ai_reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS reviewed_at, ai_review")
        .bind(activity.id).bind(Json(&review_record)).fetch_one(&mut *transaction).await?;
    sqlx::query("INSERT INTO learning_activity_review_runs (activity_id, agent_template_id, reviewed_by_principal_id, contract_version, provider, model, review, input_tokens, output_tokens, total_tokens) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)")
        .bind(activity.id).bind(template_id).bind(principal_id).bind(REVIEW_CONTRACT_VERSION).bind(provider).bind(model).bind(Json(&review_record)).bind(usage.input_tokens).bind(usage.output_tokens).bind(usage.total_tokens).execute(&mut *transaction).await?;
    transaction.commit().await?;
    Ok(Some(SavedActivityReview {
        activity_id: saved.id,
        ai_review_status: saved.status,
        ai_reviewed_at: saved.reviewed_at,
        ai_review: saved.review,
    }))
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
async fn can_edit_activity(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map_id: Uuid,
    creator: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    let direct: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id = $1 AND memberships.principal_id = $2)").bind(map_id).bind(principal_id).fetch_one(pool).await?;
    Ok(permission_allows(principal, principal_id, creator, direct))
}
async fn can_edit_activity_tx(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map_id: Uuid,
    creator: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    let direct: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id = $1 AND memberships.principal_id = $2)").bind(map_id).bind(principal_id).fetch_one(&mut **transaction).await?;
    Ok(permission_allows(principal, principal_id, creator, direct))
}
fn permission_allows(
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    creator: Option<Uuid>,
    direct: bool,
) -> bool {
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return false;
    };
    scope == "all"
        || (permission_scope_allows(scope, "own") && creator == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct)
        || direct
}

async fn review_context(pool: &PgPool, activity: &ActivityRow) -> Result<Value, sqlx::Error> {
    let topics = sqlx::query_scalar::<_, String>(
        "SELECT name FROM competence_topic_definitions WHERE is_active ORDER BY name ASC",
    )
    .fetch_all(pool)
    .await?;
    let neighbors = sqlx::query_as::<_, NeighborRow>("SELECT DISTINCT activities.title, activities.activity_type, activities.activity_config AS config FROM learning_activities AS activities INNER JOIN learning_activity_transitions AS transitions ON transitions.from_activity_id = activities.id OR transitions.to_activity_id = activities.id WHERE (transitions.from_activity_id = $1 OR transitions.to_activity_id = $1) AND activities.id <> $1 ORDER BY activities.title ASC LIMIT 6").bind(activity.id).fetch_all(pool).await?;
    let dialogue = if activity.activity_type == "npc_dialogue" {
        sqlx::query_as::<_, DialogueRow>("SELECT node_type, title, body FROM learning_npc_dialogue_nodes WHERE activity_id = $1 ORDER BY sort_order ASC, id ASC LIMIT 12").bind(activity.id).fetch_all(pool).await?
    } else {
        vec![]
    };
    let config = &activity.config;
    Ok(
        json!({"map":{"title":activity.map_title},"node":{"title":activity.node_title,"description":activity.node_description},"activity":{"title":activity.title,"type":activity.activity_type,"introduction":activity.introduction,"learningIntent":learning_intent(&activity.activity_type, config),"competenceTopics":config.get("competenceTopics").cloned().unwrap_or_else(|| json!([])),"feedbackGuidance":config.get("feedbackGuidance").cloned().unwrap_or(Value::Null),"sources":config.get("sourceReferences").cloned().unwrap_or_else(|| json!([])),"completionChoicePrompt":config.get("completionChoicePrompt").cloned().unwrap_or(Value::Null),"content":bounded_content(&activity.activity_type, config, dialogue)},"availableCompetenceTopics":topics,"nearbyActivities":neighbors.into_iter().map(|neighbor| json!({"title":neighbor.title,"type":neighbor.activity_type,"learningIntent":learning_intent(&neighbor.activity_type, &neighbor.config)})).collect::<Vec<_>>() }),
    )
}

fn learning_intent(activity_type: &str, config: &Value) -> String {
    config
        .get("learningIntent")
        .and_then(Value::as_str)
        .filter(|intent| {
            matches!(
                *intent,
                "apply"
                    | "explain"
                    | "participate"
                    | "reflect"
                    | "retrieve"
                    | "review"
                    | "transfer"
            )
        })
        .unwrap_or(match activity_type {
            "question" => "retrieve",
            "reflection" => "reflect",
            "review" => "review",
            "shared_task" | "message_prompt" | "message_wall" => "explain",
            "obstacle" | "item_obstacle" | "tool_obstacle" => "apply",
            _ => "participate",
        })
        .to_owned()
}
fn limited(value: Option<&Value>, maximum: usize) -> String {
    value
        .and_then(Value::as_str)
        .unwrap_or_default()
        .chars()
        .take(maximum)
        .collect()
}
fn bounded_content(activity_type: &str, config: &Value, dialogue: Vec<DialogueRow>) -> Value {
    match activity_type {
        "markdown" => {
            json!({"pages":config.get("markdownPages").and_then(Value::as_array).map(|pages| pages.iter().map(|page| json!({"title":page.get("title").and_then(Value::as_str).unwrap_or_default(),"body":limited(page.get("body"),5000)})).collect::<Vec<_>>()).unwrap_or_default()})
        }
        "reflection" => {
            json!({"prompt":limited(config.get("prompt"),2000),"note":limited(config.get("note"),1200),"topic":config.get("topic").and_then(Value::as_str).unwrap_or_default()})
        }
        "message_prompt" | "message_wall" => {
            json!({"prompt":limited(config.get("messagePrompt"),2000),"inputLabel":config.get("messageInputLabel").and_then(Value::as_str).unwrap_or_default()})
        }
        "obstacle" | "item_obstacle" | "tool_obstacle" => {
            json!({"prompt":limited(config.get("promptText"),2000),"successText":limited(config.get("successText"),1200),"revisitText":limited(config.get("revisitText"),1200)})
        }
        "shared_task" => {
            json!({"prompt":limited(config.get("prompt"),2000),"instructions":limited(config.get("instructions"),2000),"inputLabel":config.get("inputLabel").and_then(Value::as_str).unwrap_or_default()})
        }
        "npc_dialogue" => {
            json!({"nodes":dialogue.into_iter().map(|node| json!({"type":node.node_type,"title":node.title,"body":node.body.unwrap_or_default().chars().take(2500).collect::<String>()})).collect::<Vec<_>>() })
        }
        _ => json!({}),
    }
}
fn review_prompt(context: Value) -> String {
    format!(
        "Review exactly one Wicked Learning activity for learning usefulness and a supportive learning environment.\n\nThis is an authoring aid, not a learner grade and not a claim about learner performance.\n\nCompare the declared learning purpose and competence topics with the actual activity content. Flag alignment as unclear or mismatch when the metadata asks for something the activity does not visibly provide. Also inspect autonomy, competence and relatedness support.\n\nInspect the optional feedback guidance. Assess whether its purpose is concrete, whether the evidence can be noticed in the learner response or action, and whether the next action is a single useful step. If guidance is absent or too vague, mark that dimension unclear and suggest a concrete authoring improvement. Do not invent learner evidence.\n\nInspect the optional completion choice context. If it is present, assess whether it gives a clear reason to choose among the three bounded directions after completion. Do not recommend more choices or pressure to choose one.\n\nMention strengths before suggestions. Suggestions must be concrete, optional adjustments for the tutor. If either learning-design alignment signal is unclear or mismatch, provide a concise replacement learning intent and/or topic list; otherwise use null and an empty list. Reuse an available competence topic label exactly when one fits; only suggest a new concise label when none fits. Do not output weights or thresholds. Do not rewrite or apply the activity.\n\nUse only the scoped activity context below. Do not infer learner data or invent missing content.\n\nActivity review context:\n{}\n\nActivityReview contract:\n{}",
        serde_json::to_string_pretty(&context).expect("review context is serializable"),
        serde_json::to_string_pretty(&activity_review_schema())
            .expect("review schema is serializable")
    )
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::review_prompt;

    #[test]
    fn source_prompt_carries_only_the_supplied_context_and_named_contract() {
        let prompt = review_prompt(json!({
            "activity": {"title": "Observe the changing system"},
            "nearbyActivities": [{"title": "Next reflection"}],
            "availableCompetenceTopics": ["Systems Thinking"]
        }));
        assert!(prompt.contains("Activity review context"));
        assert!(prompt.contains("ActivityReview contract"));
        assert!(prompt.contains("Observe the changing system"));
        assert!(prompt.contains("Next reflection"));
        assert!(prompt.contains("Systems Thinking"));
        assert!(!prompt.contains("Unrelated private draft"));
    }
}
