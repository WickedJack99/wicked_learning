use axum_login::{AuthUser, AuthnBackend, UserId};
use sqlx::{FromRow, PgPool};
use thiserror::Error;
use uuid::Uuid;

use crate::passwords;

#[derive(Clone)]
pub struct IdentityBackend {
    identity_database: PgPool,
}

#[derive(Clone)]
pub struct PasswordCredentials {
    pub normalized_email: String,
    pub password: String,
}

#[derive(Clone, Debug)]
pub struct IdentitySubject {
    id: Uuid,
    normalized_email: String,
    session_auth_hash: String,
}

#[derive(Error, Debug)]
pub enum IdentityError {
    #[error("identity database query failed")]
    Database(#[from] sqlx::Error),
    #[error("stored password verifier is invalid")]
    InvalidStoredPassword(#[from] passwords::PasswordError),
}

#[derive(FromRow)]
struct IdentityRow {
    id: Uuid,
    normalized_email: String,
    password_hash: String,
}

impl IdentityBackend {
    pub fn new(identity_database: PgPool) -> Self {
        Self { identity_database }
    }

    async fn active_subject_for_email(
        &self,
        normalized_email: String,
    ) -> Result<Option<IdentitySubject>, IdentityError> {
        let row = sqlx::query_as::<_, IdentityRow>(
            r#"
                SELECT subjects.id, subjects.normalized_email, credentials.password_hash
                FROM identity_subjects AS subjects
                INNER JOIN identity_password_credentials AS credentials
                    ON credentials.subject_id = subjects.id
                WHERE subjects.normalized_email = $1
                    AND subjects.status = 'active'
                    AND subjects.email_verified_at IS NOT NULL
                    AND subjects.login_disabled_at IS NULL
                    AND (subjects.banned_until IS NULL OR subjects.banned_until <= NOW())
                LIMIT 1
            "#,
        )
        .bind(normalized_email)
        .fetch_optional(&self.identity_database)
        .await?;

        Ok(row.map(subject_from_row))
    }

    pub async fn active_subject_for_id(
        &self,
        subject_id: Uuid,
    ) -> Result<Option<IdentitySubject>, IdentityError> {
        let row = sqlx::query_as::<_, IdentityRow>(
            r#"
                SELECT subjects.id, subjects.normalized_email, credentials.password_hash
                FROM identity_subjects AS subjects
                INNER JOIN identity_password_credentials AS credentials
                    ON credentials.subject_id = subjects.id
                WHERE subjects.id = $1
                    AND subjects.status = 'active'
                    AND subjects.email_verified_at IS NOT NULL
                    AND subjects.login_disabled_at IS NULL
                    AND (subjects.banned_until IS NULL OR subjects.banned_until <= NOW())
                LIMIT 1
            "#,
        )
        .bind(subject_id)
        .fetch_optional(&self.identity_database)
        .await?;

        Ok(row.map(subject_from_row))
    }

    pub async fn requires_two_factor(&self, subject_id: Uuid) -> Result<bool, IdentityError> {
        sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM identity_totp_factors WHERE subject_id = $1 AND confirmed_at IS NOT NULL)",
        )
        .bind(subject_id)
        .fetch_one(&self.identity_database)
        .await
        .map_err(IdentityError::from)
    }
}

impl IdentitySubject {
    pub fn subject_id(&self) -> Uuid {
        self.id
    }

    pub fn normalized_email(&self) -> &str {
        &self.normalized_email
    }

    pub fn verifies_password(&self, password: &str) -> Result<bool, passwords::PasswordError> {
        passwords::verify(password, &self.session_auth_hash)
    }

    pub fn password_verifier(&self) -> &str {
        &self.session_auth_hash
    }

    pub fn with_replaced_password_hash(&self, password_hash: String) -> Self {
        Self {
            id: self.id,
            normalized_email: self.normalized_email.clone(),
            session_auth_hash: password_hash,
        }
    }

    pub fn with_normalized_email(&self, normalized_email: String) -> Self {
        Self {
            id: self.id,
            normalized_email,
            session_auth_hash: self.session_auth_hash.clone(),
        }
    }
}

fn subject_from_row(row: IdentityRow) -> IdentitySubject {
    IdentitySubject {
        id: row.id,
        normalized_email: row.normalized_email,
        session_auth_hash: row.password_hash,
    }
}

impl AuthUser for IdentitySubject {
    type Id = Uuid;

    fn id(&self) -> Self::Id {
        self.id
    }

    fn session_auth_hash(&self) -> &[u8] {
        self.session_auth_hash.as_bytes()
    }
}

impl AuthnBackend for IdentityBackend {
    type User = IdentitySubject;
    type Credentials = PasswordCredentials;
    type Error = IdentityError;

    async fn authenticate(
        &self,
        credentials: Self::Credentials,
    ) -> Result<Option<Self::User>, Self::Error> {
        let Some(subject) = self
            .active_subject_for_email(credentials.normalized_email)
            .await?
        else {
            return Ok(None);
        };

        if passwords::verify(&credentials.password, &subject.session_auth_hash)? {
            Ok(Some(subject))
        } else {
            Ok(None)
        }
    }

    async fn get_user(&self, user_id: &UserId<Self>) -> Result<Option<Self::User>, Self::Error> {
        self.active_subject_for_id(*user_id).await
    }
}

#[cfg(test)]
mod tests {
    use axum_login::AuthUser;
    use uuid::Uuid;

    use super::IdentitySubject;

    #[test]
    fn session_validity_is_bound_to_the_password_verifier() {
        let password_hash = "$argon2id$v=19$m=19456,t=2,p=1$test$test".to_owned();
        let subject = IdentitySubject {
            id: Uuid::nil(),
            normalized_email: "learner@example.test".to_owned(),
            session_auth_hash: password_hash.clone(),
        };

        assert_eq!(subject.id(), Uuid::nil());
        assert_eq!(subject.normalized_email(), "learner@example.test");
        assert_eq!(subject.session_auth_hash(), password_hash.as_bytes());
    }
}
