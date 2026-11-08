use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::admin_learning_companion_dialogue::{
    AdminLearningCompanionDialogueError, AdminLearningCompanionDialogueRepository,
    CompanionDialogueAssignmentForm, CompanionDialogueForm, CompanionDialoguePageRequest,
};
use wicked_learning_domain::{
    identity_access::{AuthorizedPrincipal, permission_scope_allows},
    learning_companion::{
        LearningCompanionAssignment, LearningCompanionAssignmentPage,
        LearningCompanionAssignmentTarget, LearningCompanionDialogue,
        LearningCompanionDialoguePage, LearningCompanionDialogueSummary,
        LearningCompanionPagination,
    },
};

pub struct PostgresAdminLearningCompanionDialogueRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminLearningCompanionDialogueRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct DialogueRow {
    assignments_count: i64,
    dialogue_graph: serde_json::Value,
    id: Uuid,
    name: String,
    updated_at: String,
}

#[derive(FromRow)]
struct DialogueSummaryRow {
    assignments_count: i64,
    id: Uuid,
    name: String,
    updated_at: String,
}

#[derive(FromRow)]
struct AssignmentRow {
    scope_id: Uuid,
    scope_type: String,
}

#[derive(FromRow)]
struct TargetRow {
    context: String,
    id: Uuid,
    label: String,
    scope_type: String,
}

impl AdminLearningCompanionDialogueRepository
    for PostgresAdminLearningCompanionDialogueRepository<'_>
{
    fn list(
        &self,
        page: &CompanionDialoguePageRequest,
    ) -> impl std::future::Future<
        Output = Result<LearningCompanionDialoguePage, AdminLearningCompanionDialogueError>,
    > + Send {
        async move { list(self.pool, page).await }
    }

    fn show(
        &self,
        dialogue_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<LearningCompanionDialogue>, AdminLearningCompanionDialogueError>,
    > + Send {
        async move { dialogue(self.pool, dialogue_id).await }
    }

    fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &CompanionDialogueForm,
    ) -> impl std::future::Future<
        Output = Result<LearningCompanionDialogue, AdminLearningCompanionDialogueError>,
    > + Send {
        async move { create(self.pool, principal, form).await }
    }

    fn update(
        &self,
        principal: &AuthorizedPrincipal,
        dialogue_id: Uuid,
        form: &CompanionDialogueForm,
    ) -> impl std::future::Future<
        Output = Result<Option<LearningCompanionDialogue>, AdminLearningCompanionDialogueError>,
    > + Send {
        async move { update(self.pool, principal, dialogue_id, form).await }
    }

    fn delete(
        &self,
        dialogue_id: Uuid,
    ) -> impl std::future::Future<Output = Result<bool, AdminLearningCompanionDialogueError>> + Send
    {
        async move {
            let result = sqlx::query("DELETE FROM learning_companion_dialogues WHERE id = $1")
                .bind(dialogue_id)
                .execute(self.pool)
                .await
                .map_err(unavailable)?;
            Ok(result.rows_affected() == 1)
        }
    }

    fn assignments(
        &self,
        principal: &AuthorizedPrincipal,
        dialogue_id: Uuid,
        page: &CompanionDialoguePageRequest,
    ) -> impl std::future::Future<
        Output = Result<
            Option<LearningCompanionAssignmentPage>,
            AdminLearningCompanionDialogueError,
        >,
    > + Send {
        async move { assignments(self.pool, principal, dialogue_id, page).await }
    }

    fn sync_assignments(
        &self,
        principal: &AuthorizedPrincipal,
        dialogue_id: Uuid,
        form: &CompanionDialogueAssignmentForm,
    ) -> impl std::future::Future<Output = Result<Option<i64>, AdminLearningCompanionDialogueError>> + Send
    {
        async move { sync_assignments(self.pool, principal, dialogue_id, form).await }
    }
}

async fn list(
    pool: &PgPool,
    page: &CompanionDialoguePageRequest,
) -> Result<LearningCompanionDialoguePage, AdminLearningCompanionDialogueError> {
    let total = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*)::BIGINT FROM learning_companion_dialogues WHERE name ILIKE '%' || $1 || '%'",
    )
    .bind(&page.search)
    .fetch_one(pool)
    .await
    .map_err(unavailable)?;
    let offset = (page.page - 1) * page.per_page;
    let rows = sqlx::query_as::<_, DialogueSummaryRow>(
        "SELECT dialogues.id, dialogues.name, COUNT(assignments.id)::BIGINT AS assignments_count, to_char(dialogues.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_companion_dialogues AS dialogues LEFT JOIN learning_companion_dialogue_assignments AS assignments ON assignments.dialogue_id = dialogues.id WHERE dialogues.name ILIKE '%' || $1 || '%' GROUP BY dialogues.id ORDER BY dialogues.name ASC, dialogues.id ASC LIMIT $2 OFFSET $3",
    )
    .bind(&page.search)
    .bind(page.per_page)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(unavailable)?;
    Ok(LearningCompanionDialoguePage {
        items: rows.into_iter().map(summary).collect(),
        pagination: pagination(page, total),
    })
}

async fn dialogue(
    pool: &PgPool,
    dialogue_id: Uuid,
) -> Result<Option<LearningCompanionDialogue>, AdminLearningCompanionDialogueError> {
    sqlx::query_as::<_, DialogueRow>(
        "SELECT dialogues.id, dialogues.name, dialogues.dialogue_graph, COUNT(assignments.id)::BIGINT AS assignments_count, to_char(dialogues.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_companion_dialogues AS dialogues LEFT JOIN learning_companion_dialogue_assignments AS assignments ON assignments.dialogue_id = dialogues.id WHERE dialogues.id = $1 GROUP BY dialogues.id",
    )
    .bind(dialogue_id)
    .fetch_optional(pool)
    .await
    .map_err(unavailable)
    .map(|row| row.map(dialogue_row))
}

async fn create(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    form: &CompanionDialogueForm,
) -> Result<LearningCompanionDialogue, AdminLearningCompanionDialogueError> {
    let mut transaction = pool.begin().await.map_err(unavailable)?;
    let principal_id = application_principal_id(&mut transaction, principal)
        .await?
        .ok_or(AdminLearningCompanionDialogueError::Unavailable)?;
    let dialogue_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO learning_companion_dialogues (id, name, dialogue_graph, created_by_principal_id, updated_by_principal_id) VALUES ($1, $2, $3, $4, $4)",
    )
    .bind(dialogue_id)
    .bind(&form.name)
    .bind(&form.dialogue_graph)
    .bind(principal_id)
    .execute(&mut *transaction)
    .await
    .map_err(unavailable)?;
    transaction.commit().await.map_err(unavailable)?;
    dialogue(pool, dialogue_id)
        .await?
        .ok_or(AdminLearningCompanionDialogueError::Unavailable)
}

async fn update(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    dialogue_id: Uuid,
    form: &CompanionDialogueForm,
) -> Result<Option<LearningCompanionDialogue>, AdminLearningCompanionDialogueError> {
    let mut transaction = pool.begin().await.map_err(unavailable)?;
    let Some(principal_id) = application_principal_id(&mut transaction, principal).await? else {
        return Ok(None);
    };
    let exists = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM learning_companion_dialogues WHERE id = $1 FOR UPDATE",
    )
    .bind(dialogue_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(unavailable)?
    .is_some();
    if !exists {
        return Ok(None);
    }
    sqlx::query(
        "UPDATE learning_companion_dialogues SET name = $2, dialogue_graph = $3, updated_by_principal_id = $4, updated_at = NOW() WHERE id = $1",
    )
    .bind(dialogue_id)
    .bind(&form.name)
    .bind(&form.dialogue_graph)
    .bind(principal_id)
    .execute(&mut *transaction)
    .await
    .map_err(unavailable)?;
    transaction.commit().await.map_err(unavailable)?;
    dialogue(pool, dialogue_id).await
}

async fn assignments(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    dialogue_id: Uuid,
    page: &CompanionDialoguePageRequest,
) -> Result<Option<LearningCompanionAssignmentPage>, AdminLearningCompanionDialogueError> {
    let Some(actor_id) = application_principal_id_pool(pool, principal).await? else {
        return Ok(None);
    };
    if dialogue(pool, dialogue_id).await?.is_none() {
        return Ok(None);
    }
    let targets = assignment_targets(pool, principal, actor_id, page).await?;
    let selected = sqlx::query_as::<_, AssignmentRow>(
        "SELECT scope_type, scope_id FROM learning_companion_dialogue_assignments WHERE dialogue_id = $1 ORDER BY created_at ASC, id ASC LIMIT 100",
    )
    .bind(dialogue_id)
    .fetch_all(pool)
    .await
    .map_err(unavailable)?
    .into_iter()
    .map(assignment)
    .collect::<Vec<_>>();
    let selected_keys = selected
        .iter()
        .map(|assignment| (assignment.scope_type.as_str(), assignment.scope_id))
        .collect::<std::collections::HashSet<_>>();
    let items = targets
        .items
        .into_iter()
        .map(|target| LearningCompanionAssignmentTarget {
            selected: selected_keys.contains(&(target.scope_type.as_str(), target.scope_id)),
            ..target
        })
        .collect();
    Ok(Some(LearningCompanionAssignmentPage {
        items,
        pagination: targets.pagination,
        selected,
    }))
}

async fn sync_assignments(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    dialogue_id: Uuid,
    form: &CompanionDialogueAssignmentForm,
) -> Result<Option<i64>, AdminLearningCompanionDialogueError> {
    let mut transaction = pool.begin().await.map_err(unavailable)?;
    let Some(actor_id) = application_principal_id(&mut transaction, principal).await? else {
        return Ok(None);
    };
    let exists = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM learning_companion_dialogues WHERE id = $1 FOR UPDATE",
    )
    .bind(dialogue_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(unavailable)?
    .is_some();
    if !exists {
        return Ok(None);
    }
    for target in &form.assignments {
        if !target_is_editable(&mut transaction, principal, actor_id, target).await? {
            return Err(AdminLearningCompanionDialogueError::Invalid);
        }
    }
    sqlx::query("DELETE FROM learning_companion_dialogue_assignments WHERE dialogue_id = $1")
        .bind(dialogue_id)
        .execute(&mut *transaction)
        .await
        .map_err(unavailable)?;
    for target in &form.assignments {
        sqlx::query(
            "INSERT INTO learning_companion_dialogue_assignments (id, dialogue_id, scope_type, scope_id) VALUES ($1, $2, $3, $4)",
        )
        .bind(Uuid::new_v4())
        .bind(dialogue_id)
        .bind(&target.scope_type)
        .bind(target.scope_id)
        .execute(&mut *transaction)
        .await
        .map_err(unavailable)?;
    }
    transaction.commit().await.map_err(unavailable)?;
    Ok(Some(form.assignments.len() as i64))
}

struct TargetPage {
    items: Vec<LearningCompanionAssignmentTarget>,
    pagination: LearningCompanionPagination,
}

async fn assignment_targets(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    actor_id: Uuid,
    page: &CompanionDialoguePageRequest,
) -> Result<TargetPage, AdminLearningCompanionDialogueError> {
    let direct_maps = sqlx::query_scalar::<_, Uuid>(
        "SELECT editing_groups.map_id FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE memberships.principal_id = $1",
    )
    .bind(actor_id)
    .fetch_all(pool)
    .await
    .map_err(unavailable)?;
    let target_sql = target_union_sql();
    let all_maps = has_all_scope(principal, "world_maps");
    let own_maps = has_own_scope(principal, "world_maps");
    let all_nodes = has_all_scope(principal, "world_nodes");
    let own_nodes = has_own_scope(principal, "world_nodes");
    let all_activities = has_all_scope(principal, "world_activities");
    let own_activities = has_own_scope(principal, "world_activities");
    let all_worlds = all_maps;
    let count_sql = format!("SELECT COUNT(*)::BIGINT FROM ({target_sql}) AS targets");
    let total = sqlx::query_scalar::<_, i64>(&count_sql)
        .bind(&page.search)
        .bind(all_worlds)
        .bind(all_maps)
        .bind(own_maps)
        .bind(all_nodes)
        .bind(own_nodes)
        .bind(all_activities)
        .bind(own_activities)
        .bind(&direct_maps)
        .bind(actor_id)
        .fetch_one(pool)
        .await
        .map_err(unavailable)?;
    let offset = (page.page - 1) * page.per_page;
    let query_sql = format!(
        "SELECT * FROM ({target_sql}) AS targets ORDER BY label ASC, scope_type ASC, id ASC LIMIT $11 OFFSET $12"
    );
    let rows = sqlx::query_as::<_, TargetRow>(&query_sql)
        .bind(&page.search)
        .bind(all_worlds)
        .bind(all_maps)
        .bind(own_maps)
        .bind(all_nodes)
        .bind(own_nodes)
        .bind(all_activities)
        .bind(own_activities)
        .bind(&direct_maps)
        .bind(actor_id)
        .bind(page.per_page)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(unavailable)?;
    Ok(TargetPage {
        items: rows
            .into_iter()
            .map(|row| LearningCompanionAssignmentTarget {
                context: row.context,
                label: row.label,
                scope_id: row.id,
                scope_type: row.scope_type,
                selected: false,
            })
            .collect(),
        pagination: pagination(page, total),
    })
}

fn target_union_sql() -> &'static str {
    "SELECT 'world'::TEXT AS scope_type, worlds.id, worlds.title AS label, worlds.title AS context FROM learning_worlds AS worlds WHERE $2 AND (worlds.title ILIKE '%' || $1 || '%' OR worlds.slug ILIKE '%' || $1 || '%') UNION ALL SELECT 'map'::TEXT, maps.id, maps.title, worlds.title FROM learning_maps AS maps INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id WHERE ($3 OR ($4 AND maps.created_by_principal_id = $10) OR maps.id = ANY($9)) AND (maps.title ILIKE '%' || $1 || '%' OR maps.slug ILIKE '%' || $1 || '%') UNION ALL SELECT 'node'::TEXT, nodes.id, nodes.title, worlds.title || ' / ' || maps.title FROM learning_nodes AS nodes INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id WHERE ($5 OR ($6 AND maps.created_by_principal_id = $10) OR maps.id = ANY($9)) AND (nodes.title ILIKE '%' || $1 || '%' OR nodes.slug ILIKE '%' || $1 || '%') UNION ALL SELECT 'activity'::TEXT, activities.id, activities.title, worlds.title || ' / ' || maps.title || ' / ' || nodes.title FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id WHERE ($7 OR ($8 AND maps.created_by_principal_id = $10) OR maps.id = ANY($9)) AND (activities.title ILIKE '%' || $1 || '%' OR activities.slug ILIKE '%' || $1 || '%')"
}

async fn target_is_editable(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    actor_id: Uuid,
    target: &LearningCompanionAssignment,
) -> Result<bool, AdminLearningCompanionDialogueError> {
    match target.scope_type.as_str() {
        "world" => {
            if !has_all_scope(principal, "world_maps") {
                return Ok(false);
            }
            sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS (SELECT 1 FROM learning_worlds WHERE id = $1)",
            )
            .bind(target.scope_id)
            .fetch_one(&mut **transaction)
            .await
            .map_err(unavailable)
        }
        "map" => {
            map_target_editable(
                transaction,
                principal,
                actor_id,
                target.scope_id,
                "world_maps",
            )
            .await
        }
        "node" => {
            node_target_editable(
                transaction,
                principal,
                actor_id,
                target.scope_id,
                "world_nodes",
            )
            .await
        }
        "activity" => {
            activity_target_editable(
                transaction,
                principal,
                actor_id,
                target.scope_id,
                "world_activities",
            )
            .await
        }
        _ => Ok(false),
    }
}

async fn map_target_editable(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    actor_id: Uuid,
    map_id: Uuid,
    resource: &str,
) -> Result<bool, AdminLearningCompanionDialogueError> {
    let creator = sqlx::query_scalar::<_, Option<Uuid>>(
        "SELECT created_by_principal_id FROM learning_maps WHERE id = $1",
    )
    .bind(map_id)
    .fetch_optional(&mut **transaction)
    .await
    .map_err(unavailable)?;
    match creator {
        Some(creator) => {
            can_edit_map(transaction, principal, actor_id, map_id, creator, resource).await
        }
        None => Ok(false),
    }
}

async fn node_target_editable(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    actor_id: Uuid,
    node_id: Uuid,
    resource: &str,
) -> Result<bool, AdminLearningCompanionDialogueError> {
    let row = sqlx::query_as::<_, (Uuid, Option<Uuid>)>("SELECT maps.id, maps.created_by_principal_id FROM learning_nodes AS nodes INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE nodes.id = $1")
        .bind(node_id).fetch_optional(&mut **transaction).await.map_err(unavailable)?;
    match row {
        Some((map_id, creator)) => {
            can_edit_map(transaction, principal, actor_id, map_id, creator, resource).await
        }
        None => Ok(false),
    }
}

async fn activity_target_editable(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    actor_id: Uuid,
    activity_id: Uuid,
    resource: &str,
) -> Result<bool, AdminLearningCompanionDialogueError> {
    let row = sqlx::query_as::<_, (Uuid, Option<Uuid>)>("SELECT maps.id, maps.created_by_principal_id FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE activities.id = $1")
        .bind(activity_id).fetch_optional(&mut **transaction).await.map_err(unavailable)?;
    match row {
        Some((map_id, creator)) => {
            can_edit_map(transaction, principal, actor_id, map_id, creator, resource).await
        }
        None => Ok(false),
    }
}

async fn can_edit_map(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    actor_id: Uuid,
    map_id: Uuid,
    creator: Option<Uuid>,
    resource: &str,
) -> Result<bool, AdminLearningCompanionDialogueError> {
    let Some(scope) = principal.permission_scope(resource, "ru") else {
        return direct_editor(transaction, map_id, actor_id).await;
    };
    if scope == "all" || (permission_scope_allows(scope, "own") && creator == Some(actor_id)) {
        return Ok(true);
    }
    direct_editor(transaction, map_id, actor_id).await
}

async fn direct_editor(
    transaction: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
    actor_id: Uuid,
) -> Result<bool, AdminLearningCompanionDialogueError> {
    sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE editing_groups.map_id = $1 AND memberships.principal_id = $2)")
        .bind(map_id).bind(actor_id).fetch_one(&mut **transaction).await.map_err(unavailable)
}

fn has_all_scope(principal: &AuthorizedPrincipal, resource: &str) -> bool {
    principal.permission_scope(resource, "ru") == Some("all")
}
fn has_own_scope(principal: &AuthorizedPrincipal, resource: &str) -> bool {
    principal
        .permission_scope(resource, "ru")
        .is_some_and(|scope| permission_scope_allows(scope, "own"))
}

async fn application_principal_id_pool(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, AdminLearningCompanionDialogueError> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(pool)
    .await
    .map_err(unavailable)
}
async fn application_principal_id(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, AdminLearningCompanionDialogueError> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(&mut **transaction)
    .await
    .map_err(unavailable)
}

fn pagination(page: &CompanionDialoguePageRequest, total: i64) -> LearningCompanionPagination {
    LearningCompanionPagination {
        current_page: page.page,
        last_page: ((total + page.per_page - 1) / page.per_page.max(1)).max(1),
        per_page: page.per_page,
        total,
    }
}
fn summary(row: DialogueSummaryRow) -> LearningCompanionDialogueSummary {
    LearningCompanionDialogueSummary {
        assignments_count: row.assignments_count,
        id: row.id,
        name: row.name,
        updated_at: row.updated_at,
    }
}
fn dialogue_row(row: DialogueRow) -> LearningCompanionDialogue {
    LearningCompanionDialogue {
        assignments_count: row.assignments_count,
        dialogue_graph: row.dialogue_graph,
        id: row.id,
        name: row.name,
        updated_at: row.updated_at,
    }
}
fn assignment(row: AssignmentRow) -> LearningCompanionAssignment {
    LearningCompanionAssignment {
        scope_id: row.scope_id,
        scope_type: row.scope_type,
    }
}
fn unavailable(error: sqlx::Error) -> AdminLearningCompanionDialogueError {
    tracing::error!(%error, "could not load or mutate Learning Companion dialogues");
    AdminLearningCompanionDialogueError::Unavailable
}
