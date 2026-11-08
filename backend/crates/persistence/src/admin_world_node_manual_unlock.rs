use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::admin_world_node_manual_unlock::{
    AdminWorldNodeManualUnlockError, AdminWorldNodeManualUnlockRepository as Port,
    SetWorldNodeManualUnlockForm,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

pub struct PostgresAdminWorldNodeManualUnlockRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldNodeManualUnlockRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldNodeManualUnlockRepository<'_> {
    fn set_manual_unlock(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: SetWorldNodeManualUnlockForm,
    ) -> impl std::future::Future<Output = Result<bool, AdminWorldNodeManualUnlockError>> + Send
    {
        async move {
            set_manual_unlock(self.pool, principal, node_id, form)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not set learner node manual unlock");
                    AdminWorldNodeManualUnlockError::Unavailable
                })
        }
    }
}

async fn set_manual_unlock(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    form: SetWorldNodeManualUnlockForm,
) -> Result<bool, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(actor_principal_id) = principal_id(&mut transaction, principal.subject_id).await?
    else {
        return Ok(false);
    };
    let node_map_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT map_id FROM learning_nodes WHERE id = $1 AND state = 'locked' FOR UPDATE",
    )
    .bind(node_id)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(node_map_id) = node_map_id else {
        return Ok(false);
    };
    if !can_edit_map(&mut transaction, principal, actor_principal_id, node_map_id).await? {
        return Ok(false);
    }
    let Some(learner_principal_id) =
        principal_id(&mut transaction, form.learner_subject_id).await?
    else {
        return Ok(false);
    };
    if !can_view_learner(
        &mut transaction,
        principal,
        actor_principal_id,
        learner_principal_id,
    )
    .await?
    {
        return Ok(false);
    }

    if form.enabled {
        sqlx::query(
            "INSERT INTO learner_node_manual_unlocks (principal_id, node_id, granted_at, revoked_at) VALUES ($1, $2, NOW(), NULL) ON CONFLICT (principal_id, node_id) DO UPDATE SET granted_at = NOW(), revoked_at = NULL",
        )
        .bind(learner_principal_id)
        .bind(node_id)
        .execute(&mut *transaction)
        .await?;
    } else {
        sqlx::query(
            "UPDATE learner_node_manual_unlocks SET revoked_at = NOW() WHERE principal_id = $1 AND node_id = $2 AND revoked_at IS NULL",
        )
        .bind(learner_principal_id)
        .bind(node_id)
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await?;
    Ok(true)
}

async fn principal_id(
    transaction: &mut Transaction<'_, Postgres>,
    subject_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(subject_id)
        .fetch_optional(&mut **transaction)
        .await
}

async fn can_edit_map(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let creator = sqlx::query_scalar::<_, Option<Uuid>>(
        "SELECT created_by_principal_id FROM learning_maps WHERE id = $1",
    )
    .bind(map_id)
    .fetch_optional(&mut **transaction)
    .await?
    .flatten();
    let direct_assignment = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id = $1 AND memberships.principal_id = $2)",
    )
    .bind(map_id)
    .bind(principal_id)
    .fetch_one(&mut **transaction)
    .await?;
    let Some(scope) = principal.permission_scope("world_maps", "ru") else {
        return Ok(false);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && creator == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct_assignment)
        || direct_assignment)
}

async fn can_view_learner(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    viewer_principal_id: Uuid,
    learner_principal_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let Some(scope) = principal.permission_scope("learner_support_signals", "ro") else {
        return Ok(false);
    };
    if scope == "all" {
        return sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM application_principals WHERE id = $1)",
        )
        .bind(learner_principal_id)
        .fetch_one(&mut **transaction)
        .await;
    }
    if permission_scope_allows(scope, "group") {
        return sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM learning_group_memberships AS viewer_memberships INNER JOIN learning_group_memberships AS learner_memberships ON learner_memberships.group_id = viewer_memberships.group_id WHERE viewer_memberships.principal_id = $1 AND learner_memberships.principal_id = $2)",
        )
        .bind(viewer_principal_id)
        .bind(learner_principal_id)
        .fetch_one(&mut **transaction)
        .await;
    }
    Ok(permission_scope_allows(scope, "own") && viewer_principal_id == learner_principal_id)
}
