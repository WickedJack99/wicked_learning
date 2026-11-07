use serde_json::json;
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::access_link::{
    AccessLinkError, AccessLinkForm, AccessLinkRepository as Port,
};
use wicked_learning_domain::{
    access_link::{
        AccessLinkAdminData, AccessLinkGrantOption, AccessLinkPreview, AccessLinkPurpose,
        AccessLinkSummary, AccessLinkUsagePolicy,
    },
    identity_access::AuthorizedPrincipal,
};

pub struct PostgresAccessLinkRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAccessLinkRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct LinkRow {
    created_at: String,
    expires_at: String,
    id: Uuid,
    is_enabled: bool,
    is_expired: bool,
    is_redeemed: bool,
    note: Option<String>,
    purpose: String,
    usage_policy: String,
}

#[derive(FromRow)]
struct RedeemableLinkRow {
    id: Uuid,
    payload: serde_json::Value,
    purpose: String,
    usage_policy: String,
}

#[derive(FromRow)]
struct GrantOptionRow {
    id: Uuid,
    title: String,
}

impl GrantOptionRow {
    fn into_domain(self) -> AccessLinkGrantOption {
        AccessLinkGrantOption {
            id: self.id,
            title: self.title,
        }
    }
}

impl Port for PostgresAccessLinkRepository<'_> {
    fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &AccessLinkForm,
        token_hash: &str,
    ) -> impl std::future::Future<Output = Result<Option<AccessLinkSummary>, AccessLinkError>> + Send
    {
        async move {
            let mut transaction = self.pool.begin().await.map_err(|error| {
                tracing::error!(%error, "could not begin access-link creation");
                AccessLinkError
            })?;
            let Some(creator_id) = principal_id(&mut transaction, principal.subject_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not resolve access-link creator");
                    AccessLinkError
                })?
            else {
                return Ok(None);
            };
            let payload = match form.purpose {
                AccessLinkPurpose::GrantTool => {
                    let Some(tool_id) = form.tool_id else {
                        return Ok(None);
                    };
                    if !tool_exists(&mut transaction, tool_id)
                        .await
                        .map_err(log_error)?
                    {
                        return Ok(None);
                    }
                    json!({ "tool_id": tool_id })
                }
                AccessLinkPurpose::GrantItems => {
                    if form.item_grants.is_empty()
                        || form.item_grants.len() > 20
                        || form
                            .item_grants
                            .iter()
                            .any(|grant| !(1..=99).contains(&grant.quantity))
                    {
                        return Ok(None);
                    }
                    for grant in &form.item_grants {
                        if !item_exists(&mut transaction, grant.item_id)
                            .await
                            .map_err(log_error)?
                        {
                            return Ok(None);
                        }
                    }
                    json!({ "items": form.item_grants.iter().map(|grant| json!({
                        "item_id": grant.item_id,
                        "quantity": grant.quantity,
                    })).collect::<Vec<_>>() })
                }
                AccessLinkPurpose::Registration => {
                    if form.tool_id.is_some() || !form.item_grants.is_empty() {
                        return Ok(None);
                    }
                    json!({})
                }
            };

            let link = sqlx::query_as::<_, LinkRow>(
                "INSERT INTO access_links (id, token_hash, purpose, usage_policy, payload, note, created_by_principal_id, expires_at) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz) \
                 RETURNING \
                   to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, \
                   to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS expires_at, \
                   id, is_enabled, FALSE AS is_expired, FALSE AS is_redeemed, note, purpose, usage_policy",
            )
            .bind(Uuid::new_v4())
            .bind(token_hash)
            .bind(form.purpose.as_str())
            .bind(form.usage_policy.as_str())
            .bind(payload)
            .bind(&form.note)
            .bind(creator_id)
            .bind(&form.expires_at)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not create access link");
                AccessLinkError
            })?;
            transaction.commit().await.map_err(|error| {
                tracing::error!(%error, "could not commit access-link creation");
                AccessLinkError
            })?;
            Ok(link.and_then(summary_from_row))
        }
    }

    fn list(
        &self,
    ) -> impl std::future::Future<Output = Result<AccessLinkAdminData, AccessLinkError>> + Send
    {
        async move {
            let rows = sqlx::query_as::<_, LinkRow>(
                "SELECT \
                    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, \
                    to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS expires_at, \
                    id, is_enabled, expires_at <= NOW() AS is_expired, redeemed_at IS NOT NULL AS is_redeemed, \
                    note, purpose, usage_policy \
                 FROM access_links ORDER BY created_at DESC, id DESC LIMIT 100",
            )
            .fetch_all(self.pool)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not list access links");
                AccessLinkError
            })?;
            let tools = sqlx::query_as::<_, GrantOptionRow>(
                "SELECT id, title FROM learning_tools ORDER BY title ASC, id ASC LIMIT 100",
            )
            .fetch_all(self.pool)
            .await
            .map_err(log_error)?;
            let items = sqlx::query_as::<_, GrantOptionRow>(
                "SELECT id, title FROM learning_items ORDER BY title ASC, id ASC LIMIT 100",
            )
            .fetch_all(self.pool)
            .await
            .map_err(log_error)?;
            Ok(AccessLinkAdminData {
                items: items.into_iter().map(GrantOptionRow::into_domain).collect(),
                links: rows.into_iter().filter_map(summary_from_row).collect(),
                tools: tools.into_iter().map(GrantOptionRow::into_domain).collect(),
            })
        }
    }

    fn redeem(
        &self,
        principal: &AuthorizedPrincipal,
        token_hash: &str,
    ) -> impl std::future::Future<Output = Result<bool, AccessLinkError>> + Send {
        async move {
            let mut transaction = self.pool.begin().await.map_err(|error| {
                tracing::error!(%error, "could not begin access-link redemption");
                AccessLinkError
            })?;
            let Some(redeemer_id) = principal_id(&mut transaction, principal.subject_id)
                .await
                .map_err(log_error)?
            else {
                return Ok(false);
            };
            let link = sqlx::query_as::<_, RedeemableLinkRow>(
                "SELECT id, payload, purpose, usage_policy FROM access_links \
                 WHERE token_hash = $1 AND is_enabled AND expires_at > NOW() \
                   AND (usage_policy <> 'one_time' OR redeemed_at IS NULL) \
                 FOR UPDATE",
            )
            .bind(token_hash)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(log_error)?;
            let Some(link) = link else {
                return Ok(false);
            };
            let Some(purpose) = AccessLinkPurpose::parse(&link.purpose) else {
                return Ok(false);
            };
            let Some(usage_policy) = AccessLinkUsagePolicy::parse(&link.usage_policy) else {
                return Ok(false);
            };
            if usage_policy == AccessLinkUsagePolicy::PerUser {
                let already_redeemed = sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS (SELECT 1 FROM access_link_redemptions WHERE access_link_id = $1 AND redeemed_by_principal_id = $2)",
                )
                .bind(link.id)
                .bind(redeemer_id)
                .fetch_one(&mut *transaction)
                .await
                .map_err(log_error)?;
                if already_redeemed {
                    return Ok(false);
                }
            }
            match purpose {
                AccessLinkPurpose::GrantTool => {
                    grant_tool(&mut transaction, redeemer_id, &link.payload).await?
                }
                AccessLinkPurpose::GrantItems => {
                    grant_items(&mut transaction, redeemer_id, &link.payload).await?
                }
                AccessLinkPurpose::Registration => return Ok(false),
            }
            sqlx::query(
                "INSERT INTO access_link_redemptions (id, access_link_id, redeemed_by_principal_id) VALUES ($1, $2, $3)",
            )
            .bind(Uuid::new_v4())
            .bind(link.id)
            .bind(redeemer_id)
            .execute(&mut *transaction)
            .await
            .map_err(log_error)?;
            sqlx::query(
                "UPDATE access_links SET redeemed_by_principal_id = COALESCE(redeemed_by_principal_id, $2), redeemed_at = COALESCE(redeemed_at, NOW()), updated_at = NOW() WHERE id = $1",
            )
            .bind(link.id)
            .bind(redeemer_id)
            .execute(&mut *transaction)
            .await
            .map_err(log_error)?;
            transaction.commit().await.map_err(log_error)?;
            Ok(true)
        }
    }

    fn preview(
        &self,
        token_hash: &str,
    ) -> impl std::future::Future<Output = Result<Option<AccessLinkPreview>, AccessLinkError>> + Send
    {
        async move {
            let row = sqlx::query_as::<_, PreviewRow>(
                "SELECT note, purpose FROM access_links WHERE token_hash = $1 AND is_enabled AND expires_at > NOW() AND (usage_policy <> 'one_time' OR redeemed_at IS NULL)",
            )
            .bind(token_hash)
            .fetch_optional(self.pool)
            .await
            .map_err(log_error)?;
            Ok(row.and_then(|row| {
                AccessLinkPurpose::parse(&row.purpose).map(|purpose| AccessLinkPreview {
                    note: row.note,
                    purpose,
                })
            }))
        }
    }

    fn set_enabled(
        &self,
        link_id: Uuid,
        enabled: bool,
    ) -> impl std::future::Future<Output = Result<Option<AccessLinkSummary>, AccessLinkError>> + Send
    {
        async move {
            let row = sqlx::query_as::<_, LinkRow>(
                "UPDATE access_links SET is_enabled = $2, updated_at = NOW() WHERE id = $1 \
                 RETURNING to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, \
                    to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS expires_at, \
                    id, is_enabled, expires_at <= NOW() AS is_expired, redeemed_at IS NOT NULL AS is_redeemed, note, purpose, usage_policy",
            )
            .bind(link_id)
            .bind(enabled)
            .fetch_optional(self.pool)
            .await
            .map_err(log_error)?;
            Ok(row.and_then(summary_from_row))
        }
    }
}

#[derive(FromRow)]
struct PreviewRow {
    note: Option<String>,
    purpose: String,
}

fn summary_from_row(row: LinkRow) -> Option<AccessLinkSummary> {
    Some(AccessLinkSummary {
        created_at: row.created_at,
        expires_at: row.expires_at,
        id: row.id,
        is_enabled: row.is_enabled,
        is_expired: row.is_expired,
        is_redeemed: row.is_redeemed,
        note: row.note,
        purpose: AccessLinkPurpose::parse(&row.purpose)?,
        usage_policy: AccessLinkUsagePolicy::parse(&row.usage_policy)?,
    })
}

async fn principal_id(
    transaction: &mut Transaction<'_, Postgres>,
    subject_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1 FOR UPDATE",
    )
    .bind(subject_id)
    .fetch_optional(&mut **transaction)
    .await
}

async fn tool_exists(
    transaction: &mut Transaction<'_, Postgres>,
    tool_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_tools WHERE id = $1)")
        .bind(tool_id)
        .fetch_one(&mut **transaction)
        .await
}

async fn item_exists(
    transaction: &mut Transaction<'_, Postgres>,
    item_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_items WHERE id = $1)")
        .bind(item_id)
        .fetch_one(&mut **transaction)
        .await
}

async fn grant_tool(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    payload: &serde_json::Value,
) -> Result<(), AccessLinkError> {
    let Some(tool_id) = payload
        .get("tool_id")
        .and_then(serde_json::Value::as_str)
        .and_then(|value| Uuid::parse_str(value).ok())
    else {
        return Err(AccessLinkError);
    };
    if !tool_exists(transaction, tool_id).await.map_err(log_error)? {
        return Err(AccessLinkError);
    }
    sqlx::query(
        "INSERT INTO learner_tools (principal_id, tool_id) VALUES ($1, $2) ON CONFLICT (principal_id, tool_id) DO NOTHING",
    )
    .bind(principal_id)
    .bind(tool_id)
    .execute(&mut **transaction)
    .await
    .map_err(log_error)?;
    Ok(())
}

async fn grant_items(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    payload: &serde_json::Value,
) -> Result<(), AccessLinkError> {
    let Some(items) = payload.get("items").and_then(serde_json::Value::as_array) else {
        return Err(AccessLinkError);
    };
    if items.is_empty() || items.len() > 20 {
        return Err(AccessLinkError);
    }
    for item in items {
        let Some(item_id) = item
            .get("item_id")
            .and_then(serde_json::Value::as_str)
            .and_then(|value| Uuid::parse_str(value).ok())
        else {
            return Err(AccessLinkError);
        };
        let Some(quantity) = item
            .get("quantity")
            .and_then(serde_json::Value::as_i64)
            .and_then(|value| i32::try_from(value).ok())
            .filter(|quantity| (1..=99).contains(quantity))
        else {
            return Err(AccessLinkError);
        };
        if !item_exists(transaction, item_id).await.map_err(log_error)? {
            return Err(AccessLinkError);
        }
        sqlx::query(
            "INSERT INTO learner_item_holdings (principal_id, item_id, quantity, acquired_at) VALUES ($1, $2, $3, NOW()) \
             ON CONFLICT (principal_id, item_id) DO UPDATE SET quantity = learner_item_holdings.quantity + EXCLUDED.quantity, updated_at = NOW()",
        )
        .bind(principal_id)
        .bind(item_id)
        .bind(quantity)
        .execute(&mut **transaction)
        .await
        .map_err(log_error)?;
    }
    Ok(())
}

fn log_error(error: sqlx::Error) -> AccessLinkError {
    tracing::error!(%error, "access-link database operation failed");
    AccessLinkError
}
