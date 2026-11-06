use sqlx::PgPool;
use uuid::Uuid;
use wicked_learning_application::identity_registration::{
    IdentityRegistration, IdentityRegistrationDraft, IdentityRegistrationError,
    IdentityRegistrationRepository as Port,
};

/// Creates the identity first as non-authenticating `provisioning`, then
/// creates its application principal, and only then activates it. A failure
/// attempts to remove both partial records and releases the one-use token.
/// This is intentionally a compensating workflow: PostgreSQL cannot transact
/// across the project's separate identity and application databases.
pub struct PostgresIdentityRegistrationRepository<'pool> {
    application_database: &'pool PgPool,
    identity_database: &'pool PgPool,
}

impl<'pool> PostgresIdentityRegistrationRepository<'pool> {
    pub fn new(application_database: &'pool PgPool, identity_database: &'pool PgPool) -> Self {
        Self {
            application_database,
            identity_database,
        }
    }
}

impl Port for PostgresIdentityRegistrationRepository<'_> {
    fn register(
        &self,
        draft: IdentityRegistrationDraft,
    ) -> impl std::future::Future<Output = Result<IdentityRegistration, IdentityRegistrationError>> + Send
    {
        async move {
            register(self.application_database, self.identity_database, draft)
                .await
                .map_err(|error| {
                    tracing::error!(?error, "could not register an identity subject");
                    error
                })
        }
    }
}

async fn register(
    application_database: &PgPool,
    identity_database: &PgPool,
    draft: IdentityRegistrationDraft,
) -> Result<IdentityRegistration, IdentityRegistrationError> {
    let subject_id = Uuid::new_v4();
    let mut identity_transaction = identity_database
        .begin()
        .await
        .map_err(|_| IdentityRegistrationError::Unavailable)?;

    let token_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM identity_registration_tokens \
         WHERE token_hash = $1 AND used_at IS NULL \
         AND (expires_at IS NULL OR expires_at > NOW()) FOR UPDATE",
    )
    .bind(&draft.registration_token_hash)
    .fetch_optional(&mut *identity_transaction)
    .await
    .map_err(|_| IdentityRegistrationError::Unavailable)?
    .ok_or(IdentityRegistrationError::InvalidRegistrationToken)?;

    let existing = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM identity_subjects WHERE normalized_email = $1 FOR UPDATE",
    )
    .bind(&draft.normalized_email)
    .fetch_optional(&mut *identity_transaction)
    .await
    .map_err(|_| IdentityRegistrationError::Unavailable)?;
    if existing.is_some() {
        return Err(IdentityRegistrationError::EmailUnavailable);
    }

    sqlx::query(
        "INSERT INTO identity_subjects (id, normalized_email, status, email_verified_at) \
         VALUES ($1, $2, 'provisioning', NOW())",
    )
    .bind(subject_id)
    .bind(&draft.normalized_email)
    .execute(&mut *identity_transaction)
    .await
    .map_err(|_| IdentityRegistrationError::Unavailable)?;
    sqlx::query("INSERT INTO identity_profiles (subject_id, display_name) VALUES ($1, $2)")
        .bind(subject_id)
        .bind(&draft.display_name)
        .execute(&mut *identity_transaction)
        .await
        .map_err(|_| IdentityRegistrationError::Unavailable)?;
    sqlx::query(
        "INSERT INTO identity_password_credentials (subject_id, password_hash) VALUES ($1, $2)",
    )
    .bind(subject_id)
    .bind(&draft.password_hash)
    .execute(&mut *identity_transaction)
    .await
    .map_err(|_| IdentityRegistrationError::Unavailable)?;
    sqlx::query(
        "UPDATE identity_registration_tokens SET used_by_subject_id = $2, used_at = NOW() WHERE id = $1",
    )
    .bind(token_id)
    .bind(subject_id)
    .execute(&mut *identity_transaction)
    .await
    .map_err(|_| IdentityRegistrationError::Unavailable)?;
    identity_transaction
        .commit()
        .await
        .map_err(|_| IdentityRegistrationError::Unavailable)?;

    let mut application_transaction = application_database
        .begin()
        .await
        .map_err(|_| IdentityRegistrationError::Unavailable)?;
    if let Err(error) =
        sqlx::query("INSERT INTO application_principals (id, identity_subject_id) VALUES ($1, $2)")
            .bind(Uuid::new_v4())
            .bind(subject_id)
            .execute(&mut *application_transaction)
            .await
    {
        tracing::error!(%error, %subject_id, "could not create application principal during registration");
        compensate_registration(application_database, identity_database, subject_id).await;
        return Err(IdentityRegistrationError::Unavailable);
    }
    if let Err(error) = sqlx::query(
        "INSERT INTO application_principal_roles (principal_id, role_key) \
         SELECT id, 'learner' FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(subject_id)
    .execute(&mut *application_transaction)
    .await
    {
        tracing::error!(%error, %subject_id, "could not assign the default learner role during registration");
        let _ = application_transaction.rollback().await;
        compensate_registration(application_database, identity_database, subject_id).await;
        return Err(IdentityRegistrationError::Unavailable);
    }
    if let Err(error) = sqlx::query(
        "INSERT INTO learner_appearance_preferences (principal_id, appearance) \
         SELECT id, $2 FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(subject_id)
    .bind(draft.appearance.as_str())
    .execute(&mut *application_transaction)
    .await
    {
        tracing::error!(%error, %subject_id, "could not save the initial learner appearance during registration");
        let _ = application_transaction.rollback().await;
        compensate_registration(application_database, identity_database, subject_id).await;
        return Err(IdentityRegistrationError::Unavailable);
    }
    if application_transaction.commit().await.is_err() {
        compensate_registration(application_database, identity_database, subject_id).await;
        return Err(IdentityRegistrationError::Unavailable);
    }

    let activation_result = sqlx::query(
        "UPDATE identity_subjects SET status = 'active', updated_at = NOW() WHERE id = $1 AND status = 'provisioning'",
    )
    .bind(subject_id)
    .execute(identity_database)
    .await;
    match activation_result {
        Ok(result) if result.rows_affected() == 1 => Ok(IdentityRegistration { subject_id }),
        _ => {
            compensate_registration(application_database, identity_database, subject_id).await;
            Err(IdentityRegistrationError::Unavailable)
        }
    }
}

async fn compensate_registration(
    application_database: &PgPool,
    identity_database: &PgPool,
    subject_id: Uuid,
) {
    if let Err(error) =
        sqlx::query("DELETE FROM application_principals WHERE identity_subject_id = $1")
            .bind(subject_id)
            .execute(application_database)
            .await
    {
        tracing::error!(%error, %subject_id, "could not remove a partially provisioned application principal");
    }

    let mut transaction = match identity_database.begin().await {
        Ok(transaction) => transaction,
        Err(error) => {
            tracing::error!(%error, %subject_id, "could not begin identity registration compensation");
            return;
        }
    };
    if let Err(error) = sqlx::query(
        "UPDATE identity_registration_tokens SET used_by_subject_id = NULL, used_at = NULL WHERE used_by_subject_id = $1",
    )
    .bind(subject_id)
    .execute(&mut *transaction)
    .await
    {
        tracing::error!(%error, %subject_id, "could not release a partially consumed registration token");
        return;
    }
    if let Err(error) = sqlx::query("DELETE FROM identity_subjects WHERE id = $1")
        .bind(subject_id)
        .execute(&mut *transaction)
        .await
    {
        tracing::error!(%error, %subject_id, "could not remove a partially provisioned identity subject");
        return;
    }
    if let Err(error) = transaction.commit().await {
        tracing::error!(%error, %subject_id, "could not commit identity registration compensation");
    }
}
