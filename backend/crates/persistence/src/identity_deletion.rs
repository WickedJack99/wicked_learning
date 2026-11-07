use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum IdentityDeletion {
    Deleted,
    Missing,
}

/// Deletes an application principal and its identity in a resumable sequence.
///
/// The two PostgreSQL databases cannot share a transaction. The durable
/// application job and the identity `deleting` state make an interrupted final
/// identity cleanup observable and safe to retry.
pub(crate) async fn deprovision(
    application_pool: &PgPool,
    identity_pool: &PgPool,
    requested_by_subject_id: Uuid,
    target_subject_id: Uuid,
) -> Result<IdentityDeletion, sqlx::Error> {
    let mut application_transaction = application_pool.begin().await?;
    let target_principal_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1 FOR UPDATE",
    )
    .bind(target_subject_id)
    .fetch_optional(&mut *application_transaction)
    .await?;
    let deletion_job_exists = sqlx::query_scalar::<_, Uuid>(
        "SELECT subject_id FROM application_identity_deletion_jobs WHERE subject_id = $1 FOR UPDATE",
    )
    .bind(target_subject_id)
    .fetch_optional(&mut *application_transaction)
    .await?;

    let Some(_) = target_principal_id else {
        if deletion_job_exists.is_none() {
            return Ok(IdentityDeletion::Missing);
        }
        application_transaction.commit().await?;
        return finalize(application_pool, identity_pool, target_subject_id).await;
    };

    // Commit the recovery record before touching the identity database. If the
    // second database becomes unavailable, reconciliation can resume from
    // durable intent instead of leaving an untracked disabled identity.
    sqlx::query(
        "INSERT INTO application_identity_deletion_jobs (subject_id, requested_by_subject_id) \
         VALUES ($1, $2) ON CONFLICT (subject_id) DO NOTHING",
    )
    .bind(target_subject_id)
    .bind(requested_by_subject_id)
    .execute(&mut *application_transaction)
    .await?;
    application_transaction.commit().await?;

    mark_identity_deleting(identity_pool, target_subject_id).await?;

    let mut application_transaction = application_pool.begin().await?;
    let target_principal_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1 FOR UPDATE",
    )
    .bind(target_subject_id)
    .fetch_optional(&mut *application_transaction)
    .await?;
    let Some(target_principal_id) = target_principal_id else {
        application_transaction.commit().await?;
        return finalize(application_pool, identity_pool, target_subject_id).await;
    };
    // The source uses nullable audit foreign keys. Preserve that outcome even
    // though the Rust databases cannot hold cross-database foreign keys.
    sqlx::query(
        "UPDATE application_access_change_events SET target_subject_id = NULL WHERE target_subject_id = $1",
    )
    .bind(target_subject_id)
    .execute(&mut *application_transaction)
    .await?;
    sqlx::query(
        "UPDATE application_access_change_events SET actor_subject_id = NULL WHERE actor_subject_id = $1",
    )
    .bind(target_subject_id)
    .execute(&mut *application_transaction)
    .await?;
    let deleted = sqlx::query_scalar::<_, Uuid>(
        "DELETE FROM application_principals WHERE id = $1 RETURNING id",
    )
    .bind(target_principal_id)
    .fetch_optional(&mut *application_transaction)
    .await?;
    if deleted.is_none() {
        return Ok(IdentityDeletion::Missing);
    }
    application_transaction.commit().await?;
    finalize(application_pool, identity_pool, target_subject_id).await
}

async fn mark_identity_deleting(
    identity_pool: &PgPool,
    subject_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut transaction = identity_pool.begin().await?;
    let status = sqlx::query_scalar::<_, String>(
        "SELECT status FROM identity_subjects WHERE id = $1 FOR UPDATE",
    )
    .bind(subject_id)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(status) = status else {
        return Err(sqlx::Error::RowNotFound);
    };
    if status != "deleting" {
        sqlx::query(
            "UPDATE identity_subjects SET status = 'deleting', login_disabled_at = COALESCE(login_disabled_at, NOW()), updated_at = NOW() WHERE id = $1",
        )
        .bind(subject_id)
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await
}

/// Resolves durable jobs after an interrupted cross-database deletion. This is
/// deliberately an operator/worker entry point rather than a browser action:
/// an account in `deleting` state must not regain access merely to retry its
/// own destructive request.
pub async fn reconcile(
    application_pool: &PgPool,
    identity_pool: &PgPool,
) -> Result<u64, sqlx::Error> {
    let subjects = sqlx::query_scalar::<_, Uuid>(
        "SELECT subject_id FROM application_identity_deletion_jobs ORDER BY created_at, subject_id",
    )
    .fetch_all(application_pool)
    .await?;
    let mut reconciled = 0;
    for subject_id in subjects {
        let identity_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM identity_subjects WHERE id = $1)",
        )
        .bind(subject_id)
        .fetch_one(identity_pool)
        .await?;
        if !identity_exists {
            sqlx::query("DELETE FROM application_identity_deletion_jobs WHERE subject_id = $1")
                .bind(subject_id)
                .execute(application_pool)
                .await?;
            reconciled += 1;
            continue;
        }
        mark_identity_deleting(identity_pool, subject_id).await?;
        if matches!(
            deprovision(application_pool, identity_pool, subject_id, subject_id,).await?,
            IdentityDeletion::Deleted
        ) {
            reconciled += 1;
        }
    }
    Ok(reconciled)
}

async fn finalize(
    application_pool: &PgPool,
    identity_pool: &PgPool,
    subject_id: Uuid,
) -> Result<IdentityDeletion, sqlx::Error> {
    let deleted = sqlx::query_scalar::<_, Uuid>(
        "DELETE FROM identity_subjects WHERE id = $1 AND status = 'deleting' RETURNING id",
    )
    .bind(subject_id)
    .fetch_optional(identity_pool)
    .await?;
    if deleted.is_none() {
        let identity_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM identity_subjects WHERE id = $1)",
        )
        .bind(subject_id)
        .fetch_one(identity_pool)
        .await?;
        if identity_exists {
            return Err(sqlx::Error::RowNotFound);
        }
    }
    sqlx::query("DELETE FROM application_identity_deletion_jobs WHERE subject_id = $1")
        .bind(subject_id)
        .execute(application_pool)
        .await?;
    Ok(IdentityDeletion::Deleted)
}
