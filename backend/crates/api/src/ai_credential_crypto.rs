use aes_gcm::{
    Aes256Gcm, KeyInit,
    aead::{Aead, AeadCore, OsRng},
};
use thiserror::Error;

/// A purpose-separated cipher for provider credentials. TOTP material and
/// provider API keys must never be encrypted under the same application key.
#[derive(Clone)]
pub struct AiCredentialCipher {
    key: [u8; 32],
}

pub struct EncryptedAiCredential {
    pub ciphertext: Vec<u8>,
    pub nonce: [u8; 12],
}

#[derive(Debug, Error)]
pub enum AiCredentialCipherError {
    #[error("could not encrypt the provider credential")]
    Encryption,
}

impl AiCredentialCipher {
    pub fn new(key: [u8; 32]) -> Self {
        Self { key }
    }

    pub fn encrypt(&self, secret: &[u8]) -> Result<EncryptedAiCredential, AiCredentialCipherError> {
        let cipher = Aes256Gcm::new_from_slice(&self.key)
            .expect("a 32-byte key is always valid for AES-256-GCM");
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let ciphertext = cipher
            .encrypt(&nonce, secret)
            .map_err(|_| AiCredentialCipherError::Encryption)?;
        Ok(EncryptedAiCredential {
            ciphertext,
            nonce: nonce.into(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::AiCredentialCipher;

    #[test]
    fn encrypts_api_keys_with_fresh_nonces() {
        let cipher = AiCredentialCipher::new(*b"test-ai-credential-key-000000000");
        let first = cipher.encrypt(b"not-serialized-key").expect("encrypt");
        let second = cipher.encrypt(b"not-serialized-key").expect("encrypt");
        assert_ne!(first.nonce, second.nonce);
        assert_ne!(first.ciphertext, b"not-serialized-key");
    }
}
