use std::{
    fs::{self, OpenOptions},
    io::{self, Write},
    path::Path,
};

#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;

use sha2::{Digest, Sha256};
use sqlx::PgPool;
use thiserror::Error;
use uuid::Uuid;

use crate::config::RegistrationTokenConfig;

#[derive(Debug, Error)]
pub enum RegistrationTokenError {
    #[error("database operation failed")]
    Database(#[from] sqlx::Error),
    #[error("could not safely write the registration token output file")]
    OutputFile(#[source] io::Error),
}

/// Creates a high-entropy, one-use invitation. The raw token is written once
/// to an explicitly selected private file; only its SHA-256 digest is stored
/// in the identity database.
pub async fn issue(
    identity_database: PgPool,
    configuration: RegistrationTokenConfig,
) -> Result<(), RegistrationTokenError> {
    let token = format!(
        "wlrt_{}{}",
        Uuid::new_v4().simple(),
        Uuid::new_v4().simple()
    );
    let token_hash = hex_sha256(&token);
    let mut transaction = identity_database.begin().await?;

    sqlx::query(
        "INSERT INTO identity_registration_tokens (id, token_hash, note) VALUES ($1, $2, $3)",
    )
    .bind(Uuid::new_v4())
    .bind(token_hash)
    .bind(configuration.note)
    .execute(&mut *transaction)
    .await?;

    write_token_file(&configuration.output_file, &token)
        .map_err(RegistrationTokenError::OutputFile)?;
    if let Err(error) = transaction.commit().await {
        let _ = fs::remove_file(&configuration.output_file);
        return Err(RegistrationTokenError::Database(error));
    }

    Ok(())
}

/// Issues a browser-created default-learner invitation. Unlike the CLI path,
/// the opaque token is returned to the caller exactly once.
pub async fn issue_for_subject(
    identity_database: &PgPool,
    created_by_subject_id: Uuid,
    expires_at: Option<String>,
    note: Option<String>,
) -> Result<String, RegistrationTokenError> {
    let token = format!(
        "wlrt_{}{}",
        Uuid::new_v4().simple(),
        Uuid::new_v4().simple()
    );
    sqlx::query(
        "INSERT INTO identity_registration_tokens (id, token_hash, created_by_subject_id, expires_at, note) VALUES ($1, $2, $3, $4::timestamptz, $5)",
    )
    .bind(Uuid::new_v4())
    .bind(hex_sha256(&token))
    .bind(created_by_subject_id)
    .bind(expires_at)
    .bind(note)
    .execute(identity_database)
    .await?;
    Ok(token)
}

fn write_token_file(path: &Path, token: &str) -> io::Result<()> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    options.mode(0o600);

    let mut file = options.open(path)?;
    if let Err(error) = writeln!(file, "{token}") {
        let _ = fs::remove_file(path);
        return Err(error);
    }

    Ok(())
}

fn hex_sha256(value: &str) -> String {
    Sha256::digest(value.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::{hex_sha256, write_token_file};

    #[test]
    fn invitation_digest_never_equals_the_raw_value() {
        let token = "wlrt_this-is-only-a-test-token";

        assert_ne!(hex_sha256(token), token);
        assert_eq!(hex_sha256(token).len(), 64);
    }

    #[test]
    fn token_file_is_created_once_without_replacing_an_existing_file() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let output_file = directory.path().join("registration-token");

        write_token_file(&output_file, "test-token").expect("first token write");
        assert_eq!(
            fs::read_to_string(&output_file).expect("token contents"),
            "test-token\n"
        );
        assert!(write_token_file(&output_file, "replacement").is_err());
        assert_eq!(
            fs::read_to_string(&output_file).expect("original contents"),
            "test-token\n"
        );
    }
}
