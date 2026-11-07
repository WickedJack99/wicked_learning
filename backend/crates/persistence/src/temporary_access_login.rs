use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::temporary_access_login::{
    TemporaryAccessLoginDraft, TemporaryAccessLoginError, TemporaryAccessLoginRepository as Port,
};

pub struct PostgresTemporaryAccessLoginRepository<'pool> {
    application_database: &'pool PgPool,
    identity_database: &'pool PgPool,
}

impl<'pool> PostgresTemporaryAccessLoginRepository<'pool> {
    pub fn new(application_database: &'pool PgPool, identity_database: &'pool PgPool) -> Self {
        Self {
            application_database,
            identity_database,
        }
    }
}

impl Port for PostgresTemporaryAccessLoginRepository<'_> {
    fn login(
        &self,
        draft: TemporaryAccessLoginDraft,
    ) -> impl std::future::Future<Output = Result<Option<Uuid>, TemporaryAccessLoginError>> + Send
    {
        async move { login(self.application_database, self.identity_database, draft).await }
    }
}

async fn login(
    application_database: &PgPool,
    identity_database: &PgPool,
    draft: TemporaryAccessLoginDraft,
) -> Result<Option<Uuid>, TemporaryAccessLoginError> {
    let mut application_transaction = application_database
        .begin()
        .await
        .map_err(|_| TemporaryAccessLoginError::Unavailable)?;
    let link_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM access_links WHERE token_hash = $1 AND purpose = 'temporary_login' \
         AND is_enabled AND expires_at > NOW() AND usage_policy <> 'per_user' \
         AND (usage_policy <> 'one_time' OR redeemed_at IS NULL) FOR UPDATE",
    )
    .bind(&draft.token_hash)
    .fetch_optional(&mut *application_transaction)
    .await
    .map_err(|_| TemporaryAccessLoginError::Unavailable)?;
    let Some(link_id) = link_id else {
        return Ok(None);
    };

    let subject_id = Uuid::new_v4();
    let normalized_email = format!("temporary-{}@invalid.local", Uuid::new_v4().simple());
    let mut identity_transaction = identity_database
        .begin()
        .await
        .map_err(|_| TemporaryAccessLoginError::Unavailable)?;
    if let Err(error) = sqlx::query(
        "INSERT INTO identity_subjects (id, normalized_email, status, email_verified_at) \
         VALUES ($1, $2, 'active', NOW())",
    )
    .bind(subject_id)
    .bind(&normalized_email)
    .execute(&mut *identity_transaction)
    .await
    {
        tracing::error!(%error, "could not provision temporary identity subject");
        return Err(TemporaryAccessLoginError::Unavailable);
    }
    if let Err(error) = sqlx::query(
        "INSERT INTO identity_profiles (subject_id, display_name) VALUES ($1, 'Temporary learner')",
    )
    .bind(subject_id)
    .execute(&mut *identity_transaction)
    .await
    {
        tracing::error!(%error, "could not provision temporary identity profile");
        return Err(TemporaryAccessLoginError::Unavailable);
    }
    if let Err(error) = sqlx::query(
        "INSERT INTO identity_password_credentials (subject_id, password_hash) VALUES ($1, $2)",
    )
    .bind(subject_id)
    .bind(&draft.password_hash)
    .execute(&mut *identity_transaction)
    .await
    {
        tracing::error!(%error, "could not provision temporary identity verifier");
        return Err(TemporaryAccessLoginError::Unavailable);
    }
    identity_transaction
        .commit()
        .await
        .map_err(|_| TemporaryAccessLoginError::Unavailable)?;

    if let Err(error) = create_principal(&mut application_transaction, subject_id, link_id).await {
        tracing::error!(%error, %subject_id, "could not provision temporary application principal");
        let _ = application_transaction.rollback().await;
        compensate(application_database, identity_database, subject_id, link_id).await;
        return Err(TemporaryAccessLoginError::Unavailable);
    }
    if application_transaction.commit().await.is_err() {
        compensate(application_database, identity_database, subject_id, link_id).await;
        return Err(TemporaryAccessLoginError::Unavailable);
    }
    Ok(Some(subject_id))
}

async fn create_principal(
    transaction: &mut Transaction<'_, Postgres>,
    subject_id: Uuid,
    link_id: Uuid,
) -> Result<(), sqlx::Error> {
    let principal_id = Uuid::new_v4();
    sqlx::query("INSERT INTO application_principals (id, identity_subject_id) VALUES ($1, $2)")
        .bind(principal_id)
        .bind(subject_id)
        .execute(&mut **transaction)
        .await?;
    sqlx::query(
        "INSERT INTO application_principal_roles (principal_id, role_key) VALUES ($1, 'learner'), ($1, 'temporary')",
    )
    .bind(principal_id)
    .execute(&mut **transaction)
    .await?;
    sqlx::query(
        "INSERT INTO learner_appearance_preferences (principal_id, appearance) VALUES ($1, 'light')",
    )
    .bind(principal_id)
    .execute(&mut **transaction)
    .await?;
    sqlx::query(
        "INSERT INTO access_link_redemptions (id, access_link_id, redeemed_by_principal_id) VALUES ($1, $2, $3)",
    )
    .bind(Uuid::new_v4())
    .bind(link_id)
    .bind(principal_id)
    .execute(&mut **transaction)
    .await?;
    sqlx::query(
        "UPDATE access_links SET redeemed_by_principal_id = COALESCE(redeemed_by_principal_id, $2), \
         redeemed_at = COALESCE(redeemed_at, NOW()), updated_at = NOW() WHERE id = $1",
    )
    .bind(link_id)
    .bind(principal_id)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

async fn compensate(
    application_database: &PgPool,
    identity_database: &PgPool,
    subject_id: Uuid,
    link_id: Uuid,
) {
    let _ = sqlx::query("DELETE FROM application_principals WHERE identity_subject_id = $1")
        .bind(subject_id)
        .execute(application_database)
        .await;
    let _ = sqlx::query(
        "UPDATE access_links SET redeemed_by_principal_id = NULL, redeemed_at = NULL, updated_at = NOW() \
         WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM access_link_redemptions WHERE access_link_id = $1)",
    )
    .bind(link_id)
    .execute(application_database)
    .await;
    let _ = sqlx::query("DELETE FROM identity_subjects WHERE id = $1")
        .bind(subject_id)
        .execute(identity_database)
        .await;
}
