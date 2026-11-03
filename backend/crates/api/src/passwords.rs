use argon2::{
    Argon2,
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString, rand_core::OsRng},
};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PasswordError {
    #[error("the password does not meet the minimum length")]
    TooShort,
    #[error("password hashing failed")]
    Hashing,
    #[error("the stored password hash is invalid")]
    InvalidStoredHash,
}

pub fn hash(password: &str) -> Result<String, PasswordError> {
    if password.chars().count() < 12 {
        return Err(PasswordError::TooShort);
    }

    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|_| PasswordError::Hashing)
}

pub fn verify(password: &str, stored_hash: &str) -> Result<bool, PasswordError> {
    let parsed_hash =
        PasswordHash::new(stored_hash).map_err(|_| PasswordError::InvalidStoredHash)?;

    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

#[cfg(test)]
mod tests {
    use super::{PasswordError, hash, verify};

    #[test]
    fn hashes_and_verifies_a_credential_without_reusing_the_plaintext() {
        let password = "a secure test password";
        let hash = hash(password).expect("a valid password can be hashed");

        assert!(hash.starts_with("$argon2id$"));
        assert_ne!(hash, password);
        assert!(verify(password, &hash).expect("a generated hash is valid"));
        assert!(!verify("a different password", &hash).expect("a generated hash is valid"));
    }

    #[test]
    fn rejects_passwords_shorter_than_twelve_characters() {
        assert!(matches!(hash("too-short"), Err(PasswordError::TooShort)));
    }
}
