use std::{fs, io};

use sqlx::PgPool;
use thiserror::Error;
use uuid::Uuid;

use crate::{config::BootstrapAdminConfig, passwords};

#[derive(Debug, Error)]
pub enum BootstrapError {
    #[error("could not read the administrator password file")]
    PasswordFile(#[source] io::Error),
    #[error("administrator password is empty")]
    EmptyPassword,
    #[error("administrator password could not be hashed")]
    Password(#[source] passwords::PasswordError),
    #[error("database operation failed")]
    Database(#[from] sqlx::Error),
}

pub async fn create_administrator(
    application_database: PgPool,
    identity_database: PgPool,
    bootstrap: BootstrapAdminConfig,
) -> Result<(), BootstrapError> {
    let password = password_from_file(&bootstrap.password_file)?;

    let mut identity_transaction = identity_database.begin().await?;
    let existing_subject_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM identity_subjects WHERE normalized_email = $1",
    )
    .bind(&bootstrap.normalized_email)
    .fetch_optional(&mut *identity_transaction)
    .await?;
    let subject_id = match existing_subject_id {
        Some(subject_id) => subject_id,
        None => {
            let subject_id = Uuid::new_v4();
            let password_hash = passwords::hash(&password).map_err(BootstrapError::Password)?;

            sqlx::query(
                "INSERT INTO identity_subjects (id, normalized_email, email_verified_at)\
                 VALUES ($1, $2, NOW())",
            )
            .bind(subject_id)
            .bind(&bootstrap.normalized_email)
            .execute(&mut *identity_transaction)
            .await?;
            sqlx::query(
                "INSERT INTO identity_password_credentials (subject_id, password_hash)\
                 VALUES ($1, $2)",
            )
            .bind(subject_id)
            .bind(password_hash)
            .execute(&mut *identity_transaction)
            .await?;

            subject_id
        }
    };
    // Bootstrap identities predate invitation registration but must still own
    // the same identity-profile record as every other signed-in subject.
    sqlx::query(
        "INSERT INTO identity_profiles (subject_id, display_name) VALUES ($1, 'Administrator') ON CONFLICT (subject_id) DO NOTHING",
    )
    .bind(subject_id)
    .execute(&mut *identity_transaction)
    .await?;
    identity_transaction.commit().await?;

    let mut application_transaction = application_database.begin().await?;
    let principal_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO application_principals (id, identity_subject_id)\
         VALUES ($1, $2)\
         ON CONFLICT (identity_subject_id)\
         DO UPDATE SET updated_at = NOW()\
         RETURNING id",
    )
    .bind(Uuid::new_v4())
    .bind(subject_id)
    .fetch_one(&mut *application_transaction)
    .await?;
    sqlx::query(
        "INSERT INTO application_principal_roles (principal_id, role_key)\
         VALUES ($1, 'platform_administrator')\
         ON CONFLICT DO NOTHING",
    )
    .bind(principal_id)
    .execute(&mut *application_transaction)
    .await?;
    application_transaction.commit().await?;

    Ok(())
}

fn password_from_file(password_file: &std::path::Path) -> Result<String, BootstrapError> {
    let password = fs::read_to_string(password_file).map_err(BootstrapError::PasswordFile)?;
    let password = password.trim_end_matches(['\r', '\n']);
    if password.is_empty() {
        return Err(BootstrapError::EmptyPassword);
    }

    Ok(password.to_owned())
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{BootstrapError, password_from_file};

    #[test]
    fn bootstrap_errors_do_not_include_password_content() {
        assert!(
            !BootstrapError::EmptyPassword
                .to_string()
                .contains("password-content")
        );
    }

    #[test]
    fn missing_password_file_is_reported_without_a_path_or_secret() {
        let result = password_from_file(Path::new("/not-a-real-bootstrap-password-file"));

        assert!(matches!(result, Err(BootstrapError::PasswordFile(_))));
        assert!(
            !result
                .expect_err("missing file must fail")
                .to_string()
                .contains("/not-a-real")
        );
    }
}
