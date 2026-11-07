use aes_gcm::{
    Aes256Gcm, KeyInit,
    aead::{Aead, AeadCore, OsRng},
};
use thiserror::Error;

#[derive(Clone)]
pub struct TotpSecretCipher {
    key: [u8; 32],
}

pub struct EncryptedTotpSecret {
    pub ciphertext: Vec<u8>,
    pub nonce: [u8; 12],
}

#[derive(Debug, Error)]
pub enum TotpSecretCipherError {
    #[error("could not encrypt the TOTP secret")]
    Encryption,
    #[error("could not decrypt the TOTP secret")]
    Decryption,
}

impl TotpSecretCipher {
    pub fn new(key: [u8; 32]) -> Self {
        Self { key }
    }

    pub fn encrypt(&self, secret: &[u8]) -> Result<EncryptedTotpSecret, TotpSecretCipherError> {
        let cipher = Aes256Gcm::new_from_slice(&self.key)
            .expect("a 32-byte key is always valid for AES-256-GCM");
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let ciphertext = cipher
            .encrypt(&nonce, secret)
            .map_err(|_| TotpSecretCipherError::Encryption)?;

        Ok(EncryptedTotpSecret {
            ciphertext,
            nonce: nonce.into(),
        })
    }

    pub fn decrypt(
        &self,
        ciphertext: &[u8],
        nonce: [u8; 12],
    ) -> Result<Vec<u8>, TotpSecretCipherError> {
        let cipher = Aes256Gcm::new_from_slice(&self.key)
            .expect("a 32-byte key is always valid for AES-256-GCM");

        cipher
            .decrypt((&nonce).into(), ciphertext)
            .map_err(|_| TotpSecretCipherError::Decryption)
    }
}

#[cfg(test)]
mod tests {
    use super::{TotpSecretCipher, TotpSecretCipherError};

    #[test]
    fn encrypts_with_a_fresh_nonce_and_decrypts_only_with_the_same_key() {
        let cipher = TotpSecretCipher::new(*b"test-totp-encryption-key-0000000");
        let first = cipher.encrypt(b"an authenticator secret").expect("encrypt");
        let second = cipher.encrypt(b"an authenticator secret").expect("encrypt");

        assert_ne!(first.nonce, second.nonce);
        assert_ne!(first.ciphertext, b"an authenticator secret");
        assert_eq!(
            cipher
                .decrypt(&first.ciphertext, first.nonce)
                .expect("decrypt"),
            b"an authenticator secret"
        );

        let other_cipher = TotpSecretCipher::new(*b"other-totp-encryption-key-000000");
        assert!(matches!(
            other_cipher.decrypt(&first.ciphertext, first.nonce),
            Err(TotpSecretCipherError::Decryption)
        ));
    }
}
