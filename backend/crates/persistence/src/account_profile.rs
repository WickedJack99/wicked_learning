use sqlx::PgPool;
use uuid::Uuid;
use wicked_learning_application::account_profile::{
    AccountProfile, AccountProfileDraft, AccountProfileError, AccountProfileRepository as Port,
};

pub struct PostgresAccountProfileRepository<'pool> {
    application_database: &'pool PgPool,
    identity_database: &'pool PgPool,
}

impl<'pool> PostgresAccountProfileRepository<'pool> {
    pub fn new(application_database: &'pool PgPool, identity_database: &'pool PgPool) -> Self {
        Self {
            application_database,
            identity_database,
        }
    }
}

impl Port for PostgresAccountProfileRepository<'_> {
    fn load(
        &self,
        subject_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<AccountProfile>, AccountProfileError>> + Send
    {
        async move {
            let identity = sqlx::query_as::<_, IdentityProfileRow>(
                "SELECT profiles.display_name, subjects.normalized_email FROM identity_subjects AS subjects INNER JOIN identity_profiles AS profiles ON profiles.subject_id = subjects.id WHERE subjects.id = $1 AND subjects.status = 'active'",
            )
            .bind(subject_id)
            .fetch_optional(self.identity_database)
            .await
            .map_err(|_| AccountProfileError::Unavailable)?;
            let Some(identity) = identity else {
                return Ok(None);
            };
            let application_profile = sqlx::query_as::<_, ApplicationProfileRow>(
                "SELECT profiles.public_username, profiles.profile_image_id FROM application_principals AS principals LEFT JOIN application_public_profiles AS profiles ON profiles.principal_id = principals.id WHERE principals.identity_subject_id = $1",
            )
            .bind(subject_id)
            .fetch_optional(self.application_database)
            .await
            .map_err(|_| AccountProfileError::Unavailable)?
            .unwrap_or(ApplicationProfileRow {
                public_username: None,
                profile_image_id: None,
            });
            Ok(Some(AccountProfile {
                display_name: identity.display_name,
                email: identity.normalized_email,
                public_username: application_profile.public_username,
                profile_image_id: application_profile.profile_image_id,
            }))
        }
    }

    fn update(
        &self,
        subject_id: Uuid,
        draft: AccountProfileDraft,
    ) -> impl std::future::Future<Output = Result<AccountProfile, AccountProfileError>> + Send {
        async move {
            let before = self
                .load(subject_id)
                .await?
                .ok_or(AccountProfileError::Missing)?;
            let principal_id = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM application_principals WHERE identity_subject_id = $1",
            )
            .bind(subject_id)
            .fetch_optional(self.application_database)
            .await
            .map_err(|_| AccountProfileError::Unavailable)?
            .ok_or(AccountProfileError::Missing)?;

            save_public_profile(
                self.application_database,
                principal_id,
                &draft.public_username,
                draft.profile_image_id,
            )
            .await?;
            let mut identity_transaction = self
                .identity_database
                .begin()
                .await
                .map_err(|_| AccountProfileError::Unavailable)?;
            let identity_result = sqlx::query(
                "UPDATE identity_subjects AS subjects SET normalized_email = $2, updated_at = NOW() FROM identity_profiles AS profiles WHERE subjects.id = $1 AND profiles.subject_id = subjects.id AND subjects.status = 'active'",
            )
            .bind(subject_id)
            .bind(&draft.email)
            .execute(&mut *identity_transaction)
            .await;
            if !matches!(identity_result, Ok(ref result) if result.rows_affected() == 1) {
                let _ = identity_transaction.rollback().await;
                let _ = save_public_profile(
                    self.application_database,
                    principal_id,
                    &before.public_username,
                    before.profile_image_id,
                )
                .await;
                return Err(identity_result
                    .err()
                    .map(database_error)
                    .unwrap_or(AccountProfileError::Missing));
            }
            let display_name_result = sqlx::query(
                "UPDATE identity_profiles SET display_name = $2, updated_at = NOW() WHERE subject_id = $1",
            )
            .bind(subject_id)
            .bind(&draft.display_name)
            .execute(&mut *identity_transaction)
            .await;
            if !matches!(display_name_result, Ok(ref result) if result.rows_affected() == 1) {
                let _ = identity_transaction.rollback().await;
                let _ = save_public_profile(
                    self.application_database,
                    principal_id,
                    &before.public_username,
                    before.profile_image_id,
                )
                .await;
                return Err(display_name_result
                    .err()
                    .map(database_error)
                    .unwrap_or(AccountProfileError::Missing));
            }
            if identity_transaction.commit().await.is_err() {
                let _ = save_public_profile(
                    self.application_database,
                    principal_id,
                    &before.public_username,
                    before.profile_image_id,
                )
                .await;
                return Err(AccountProfileError::Unavailable);
            }
            Ok(AccountProfile {
                display_name: draft.display_name,
                email: draft.email,
                public_username: draft.public_username,
                profile_image_id: draft.profile_image_id,
            })
        }
    }
}

async fn save_public_profile(
    application_database: &PgPool,
    principal_id: Uuid,
    public_username: &Option<String>,
    profile_image_id: Option<Uuid>,
) -> Result<(), AccountProfileError> {
    sqlx::query(
        "INSERT INTO application_public_profiles (principal_id, public_username, profile_image_id) \
         SELECT $1, $2, $3 WHERE $3 IS NULL OR EXISTS (SELECT 1 FROM application_profile_images WHERE id = $3 AND principal_id = $1) \
         ON CONFLICT (principal_id) DO UPDATE SET public_username = EXCLUDED.public_username, profile_image_id = EXCLUDED.profile_image_id, updated_at = NOW()",
    )
    .bind(principal_id)
    .bind(public_username)
    .bind(profile_image_id)
    .execute(application_database)
    .await
    .map_err(database_error)?
    .rows_affected()
    .eq(&1)
    .then_some(())
    .ok_or(AccountProfileError::Conflict)?;
    Ok(())
}

fn database_error(error: sqlx::Error) -> AccountProfileError {
    match error
        .as_database_error()
        .and_then(|database| database.code())
        .as_deref()
    {
        Some("23505") => AccountProfileError::Conflict,
        _ => AccountProfileError::Unavailable,
    }
}

#[derive(sqlx::FromRow)]
struct IdentityProfileRow {
    display_name: String,
    normalized_email: String,
}

#[derive(sqlx::FromRow)]
struct ApplicationProfileRow {
    public_username: Option<String>,
    profile_image_id: Option<Uuid>,
}
