use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::{
    organization::OrganizationError,
    organization_leadership_rotation::OrganizationLeadershipRotationRepository,
};

pub struct PostgresOrganizationLeadershipRotationRepository<'pool> {
    application_pool: &'pool PgPool,
}

impl<'pool> PostgresOrganizationLeadershipRotationRepository<'pool> {
    pub fn new(application_pool: &'pool PgPool) -> Self {
        Self { application_pool }
    }
}

impl OrganizationLeadershipRotationRepository
    for PostgresOrganizationLeadershipRotationRepository<'_>
{
    async fn rotate_due_random_leaders(&self) -> Result<u64, OrganizationError> {
        let mut transaction = self
            .application_pool
            .begin()
            .await
            .map_err(|_| OrganizationError)?;
        let organizations = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM organizations WHERE governance_type = 'random' AND (leadership_rotated_at IS NULL OR leadership_rotated_at < date_trunc('month', CURRENT_TIMESTAMP) OR (SELECT COUNT(*) FROM organization_memberships WHERE organization_id = organizations.id AND role = 'leader') <> 1) FOR UPDATE SKIP LOCKED",
        )
        .fetch_all(&mut *transaction)
        .await
        .map_err(|_| OrganizationError)?;
        let mut rotated = 0;
        for organization_id in organizations {
            if rotate_one(&mut transaction, organization_id).await? {
                rotated += 1;
            }
        }
        transaction.commit().await.map_err(|_| OrganizationError)?;
        Ok(rotated)
    }
}

async fn rotate_one(
    transaction: &mut Transaction<'_, Postgres>,
    organization_id: Uuid,
) -> Result<bool, OrganizationError> {
    // Prefer a member who is not currently a leader, exactly as the source
    // does; the random fallback handles a one-member organization.
    let next_leader = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM organization_memberships WHERE organization_id = $1 ORDER BY CASE WHEN role = 'leader' THEN 1 ELSE 0 END, random() LIMIT 1",
    )
    .bind(organization_id)
    .fetch_optional(&mut **transaction)
    .await
    .map_err(|_| OrganizationError)?;
    let Some(next_leader) = next_leader else {
        return Ok(false);
    };
    sqlx::query("UPDATE organization_memberships SET role = 'member' WHERE organization_id = $1")
        .bind(organization_id)
        .execute(&mut **transaction)
        .await
        .map_err(|_| OrganizationError)?;
    sqlx::query("UPDATE organization_memberships SET role = 'leader' WHERE id = $1")
        .bind(next_leader)
        .execute(&mut **transaction)
        .await
        .map_err(|_| OrganizationError)?;
    sqlx::query("UPDATE organizations SET leadership_rotated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1")
        .bind(organization_id)
        .execute(&mut **transaction)
        .await
        .map_err(|_| OrganizationError)?;
    Ok(true)
}
