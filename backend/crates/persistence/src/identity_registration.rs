use serde_json::Value;
use sqlx::{PgPool, Postgres, Transaction, types::Json};
use uuid::Uuid;
use wicked_learning_application::identity_registration::{
    IdentityRegistration, IdentityRegistrationDraft, IdentityRegistrationError,
    IdentityRegistrationRepository as Port,
};

/// Creates the identity first as non-authenticating `provisioning`, then
/// creates its application principal, and only then activates it. A failure
/// compensates both partial records. This is intentionally a compensating
/// workflow: PostgreSQL cannot transact across the separate identity and
/// application databases.
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

#[derive(Clone, Copy)]
enum RegistrationReservation {
    AccessLink(Uuid),
    IdentityToken,
}

async fn register(
    application_database: &PgPool,
    identity_database: &PgPool,
    draft: IdentityRegistrationDraft,
) -> Result<IdentityRegistration, IdentityRegistrationError> {
    // Registration access links live with application data. Locking the link
    // before identity provisioning makes one-time use atomic with respect to
    // other registrations, while the existing identity-token path remains
    // available for locally issued invitations.
    let mut application_transaction = application_database
        .begin()
        .await
        .map_err(|_| IdentityRegistrationError::Unavailable)?;
    let access_link_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM access_links \
         WHERE token_hash = $1 AND purpose = 'registration' AND is_enabled \
           AND expires_at > NOW() \
           AND (usage_policy <> 'one_time' OR redeemed_at IS NULL) FOR UPDATE",
    )
    .bind(&draft.registration_token_hash)
    .fetch_optional(&mut *application_transaction)
    .await
    .map_err(|_| IdentityRegistrationError::Unavailable)?;

    if let Some(access_link_id) = access_link_id {
        return register_with_access_link(
            application_database,
            identity_database,
            draft,
            application_transaction,
            access_link_id,
        )
        .await;
    }
    drop(application_transaction);
    register_with_identity_token(application_database, identity_database, draft).await
}

async fn register_with_identity_token(
    application_database: &PgPool,
    identity_database: &PgPool,
    draft: IdentityRegistrationDraft,
) -> Result<IdentityRegistration, IdentityRegistrationError> {
    let subject_id = Uuid::new_v4();
    let mut identity_transaction = identity_database
        .begin()
        .await
        .map_err(|_| IdentityRegistrationError::Unavailable)?;
    let token = sqlx::query_as::<_, RegistrationTokenRow>(
        "SELECT id, roles FROM identity_registration_tokens \
         WHERE token_hash = $1 AND used_at IS NULL \
         AND (expires_at IS NULL OR expires_at > NOW()) FOR UPDATE",
    )
    .bind(&draft.registration_token_hash)
    .fetch_optional(&mut *identity_transaction)
    .await
    .map_err(|_| IdentityRegistrationError::Unavailable)?
    .ok_or(IdentityRegistrationError::InvalidRegistrationToken)?;
    let roles = registration_token_roles(&token.roles.0)
        .ok_or(IdentityRegistrationError::InvalidRegistrationToken)?;

    provision_identity(
        &mut identity_transaction,
        subject_id,
        &draft,
        Some(token.id),
    )
    .await?;
    identity_transaction
        .commit()
        .await
        .map_err(|_| IdentityRegistrationError::Unavailable)?;

    let mut application_transaction = application_database
        .begin()
        .await
        .map_err(|_| IdentityRegistrationError::Unavailable)?;
    if let Err(error) =
        create_application_principal(&mut application_transaction, subject_id, &draft, &roles).await
    {
        tracing::error!(%error, %subject_id, "could not create application data during registration");
        let _ = application_transaction.rollback().await;
        compensate_registration(
            application_database,
            identity_database,
            subject_id,
            RegistrationReservation::IdentityToken,
        )
        .await;
        return Err(IdentityRegistrationError::Unavailable);
    }
    if application_transaction.commit().await.is_err() {
        compensate_registration(
            application_database,
            identity_database,
            subject_id,
            RegistrationReservation::IdentityToken,
        )
        .await;
        return Err(IdentityRegistrationError::Unavailable);
    }
    activate_or_compensate(
        application_database,
        identity_database,
        subject_id,
        RegistrationReservation::IdentityToken,
    )
    .await
}

async fn register_with_access_link(
    application_database: &PgPool,
    identity_database: &PgPool,
    draft: IdentityRegistrationDraft,
    mut application_transaction: Transaction<'_, Postgres>,
    access_link_id: Uuid,
) -> Result<IdentityRegistration, IdentityRegistrationError> {
    let subject_id = Uuid::new_v4();
    let mut identity_transaction = identity_database
        .begin()
        .await
        .map_err(|_| IdentityRegistrationError::Unavailable)?;
    provision_identity(&mut identity_transaction, subject_id, &draft, None).await?;
    identity_transaction
        .commit()
        .await
        .map_err(|_| IdentityRegistrationError::Unavailable)?;

    let access_link_roles = vec!["learner".to_owned()];
    let principal_id = match create_application_principal(
        &mut application_transaction,
        subject_id,
        &draft,
        &access_link_roles,
    )
    .await
    {
        Ok(principal_id) => principal_id,
        Err(error) => {
            tracing::error!(%error, %subject_id, "could not create application data for registration access link");
            let _ = application_transaction.rollback().await;
            compensate_registration(
                application_database,
                identity_database,
                subject_id,
                RegistrationReservation::AccessLink(access_link_id),
            )
            .await;
            return Err(IdentityRegistrationError::Unavailable);
        }
    };
    if let Err(error) = sqlx::query(
        "INSERT INTO access_link_redemptions (id, access_link_id, redeemed_by_principal_id) \
         VALUES ($1, $2, $3)",
    )
    .bind(Uuid::new_v4())
    .bind(access_link_id)
    .bind(principal_id)
    .execute(&mut *application_transaction)
    .await
    {
        tracing::error!(%error, %access_link_id, "could not record registration access-link redemption");
        let _ = application_transaction.rollback().await;
        compensate_registration(
            application_database,
            identity_database,
            subject_id,
            RegistrationReservation::AccessLink(access_link_id),
        )
        .await;
        return Err(IdentityRegistrationError::Unavailable);
    }
    if let Err(error) = sqlx::query(
        "UPDATE access_links SET redeemed_by_principal_id = COALESCE(redeemed_by_principal_id, $2), \
         redeemed_at = COALESCE(redeemed_at, NOW()), updated_at = NOW() WHERE id = $1",
    )
    .bind(access_link_id)
    .bind(principal_id)
    .execute(&mut *application_transaction)
    .await
    {
        tracing::error!(%error, %access_link_id, "could not mark registration access link as redeemed");
        let _ = application_transaction.rollback().await;
        compensate_registration(
            application_database,
            identity_database,
            subject_id,
            RegistrationReservation::AccessLink(access_link_id),
        )
        .await;
        return Err(IdentityRegistrationError::Unavailable);
    }
    if application_transaction.commit().await.is_err() {
        compensate_registration(
            application_database,
            identity_database,
            subject_id,
            RegistrationReservation::AccessLink(access_link_id),
        )
        .await;
        return Err(IdentityRegistrationError::Unavailable);
    }
    activate_or_compensate(
        application_database,
        identity_database,
        subject_id,
        RegistrationReservation::AccessLink(access_link_id),
    )
    .await
}

async fn provision_identity(
    transaction: &mut Transaction<'_, Postgres>,
    subject_id: Uuid,
    draft: &IdentityRegistrationDraft,
    identity_token_id: Option<Uuid>,
) -> Result<(), IdentityRegistrationError> {
    let existing = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM identity_subjects WHERE normalized_email = $1 FOR UPDATE",
    )
    .bind(&draft.normalized_email)
    .fetch_optional(&mut **transaction)
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
    .execute(&mut **transaction)
    .await
    .map_err(|_| IdentityRegistrationError::Unavailable)?;
    sqlx::query("INSERT INTO identity_profiles (subject_id, display_name) VALUES ($1, $2)")
        .bind(subject_id)
        .bind(&draft.display_name)
        .execute(&mut **transaction)
        .await
        .map_err(|_| IdentityRegistrationError::Unavailable)?;
    sqlx::query(
        "INSERT INTO identity_password_credentials (subject_id, password_hash) VALUES ($1, $2)",
    )
    .bind(subject_id)
    .bind(&draft.password_hash)
    .execute(&mut **transaction)
    .await
    .map_err(|_| IdentityRegistrationError::Unavailable)?;
    if let Some(token_id) = identity_token_id {
        sqlx::query(
            "UPDATE identity_registration_tokens SET used_by_subject_id = $2, used_at = NOW() WHERE id = $1",
        )
        .bind(token_id)
        .bind(subject_id)
        .execute(&mut **transaction)
        .await
        .map_err(|_| IdentityRegistrationError::Unavailable)?;
    }
    Ok(())
}

async fn create_application_principal(
    transaction: &mut Transaction<'_, Postgres>,
    subject_id: Uuid,
    draft: &IdentityRegistrationDraft,
    roles: &[String],
) -> Result<Uuid, sqlx::Error> {
    let principal_id = Uuid::new_v4();
    sqlx::query("INSERT INTO application_principals (id, identity_subject_id) VALUES ($1, $2)")
        .bind(principal_id)
        .bind(subject_id)
        .execute(&mut **transaction)
        .await?;
    for role_key in roles {
        sqlx::query(
            "INSERT INTO application_principal_roles (principal_id, role_key) VALUES ($1, $2)",
        )
        .bind(principal_id)
        .bind(role_key)
        .execute(&mut **transaction)
        .await?;
    }
    sqlx::query(
        "INSERT INTO learner_appearance_preferences (principal_id, appearance) VALUES ($1, $2)",
    )
    .bind(principal_id)
    .bind(draft.appearance.as_str())
    .execute(&mut **transaction)
    .await?;
    Ok(principal_id)
}

#[derive(sqlx::FromRow)]
struct RegistrationTokenRow {
    id: Uuid,
    roles: Json<Value>,
}

fn registration_token_roles(value: &Value) -> Option<Vec<String>> {
    let roles = value
        .as_array()?
        .iter()
        .map(Value::as_str)
        .collect::<Option<Vec<_>>>()?
        .into_iter()
        .map(str::to_owned)
        .collect::<Vec<_>>();
    (!roles.is_empty() && roles.iter().all(|role| !role.is_empty())).then_some(roles)
}

async fn activate_or_compensate(
    application_database: &PgPool,
    identity_database: &PgPool,
    subject_id: Uuid,
    reservation: RegistrationReservation,
) -> Result<IdentityRegistration, IdentityRegistrationError> {
    let activation_result = sqlx::query(
        "UPDATE identity_subjects SET status = 'active', updated_at = NOW() \
         WHERE id = $1 AND status = 'provisioning'",
    )
    .bind(subject_id)
    .execute(identity_database)
    .await;
    match activation_result {
        Ok(result) if result.rows_affected() == 1 => Ok(IdentityRegistration { subject_id }),
        _ => {
            compensate_registration(
                application_database,
                identity_database,
                subject_id,
                reservation,
            )
            .await;
            Err(IdentityRegistrationError::Unavailable)
        }
    }
}

async fn compensate_registration(
    application_database: &PgPool,
    identity_database: &PgPool,
    subject_id: Uuid,
    reservation: RegistrationReservation,
) {
    if let Err(error) =
        sqlx::query("DELETE FROM application_principals WHERE identity_subject_id = $1")
            .bind(subject_id)
            .execute(application_database)
            .await
    {
        tracing::error!(%error, %subject_id, "could not remove a partially provisioned application principal");
    }
    if let RegistrationReservation::AccessLink(access_link_id) = reservation {
        if let Err(error) = sqlx::query(
            "UPDATE access_links SET redeemed_by_principal_id = NULL, redeemed_at = NULL, updated_at = NOW() \
             WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM access_link_redemptions WHERE access_link_id = $1)",
        )
        .bind(access_link_id)
        .execute(application_database)
        .await
        {
            tracing::error!(%error, %access_link_id, "could not release a partially consumed registration access link");
        }
    }

    let mut transaction = match identity_database.begin().await {
        Ok(transaction) => transaction,
        Err(error) => {
            tracing::error!(%error, %subject_id, "could not begin identity registration compensation");
            return;
        }
    };
    if matches!(reservation, RegistrationReservation::IdentityToken) {
        if let Err(error) = sqlx::query(
            "UPDATE identity_registration_tokens SET used_by_subject_id = NULL, used_at = NULL \
             WHERE used_by_subject_id = $1",
        )
        .bind(subject_id)
        .execute(&mut *transaction)
        .await
        {
            tracing::error!(%error, %subject_id, "could not release a partially consumed registration token");
            return;
        }
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
