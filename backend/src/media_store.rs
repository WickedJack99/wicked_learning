use std::{path::Path as FileSystemPath, sync::Arc};

use object_store::{
    GetResult, ObjectStore, ObjectStoreExt, PutPayload, local::LocalFileSystem, path::Path,
};
use thiserror::Error;
use uuid::Uuid;

#[derive(Clone)]
pub struct MediaStore {
    object_store: Arc<dyn ObjectStore>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MediaObjectKey(Path);

#[derive(Debug, Error)]
pub enum MediaStoreError {
    #[error("could not initialize the mounted media store")]
    Initialize(#[source] object_store::Error),
    #[error("media object operation failed")]
    ObjectStore(#[source] object_store::Error),
}

impl MediaStore {
    pub fn from_mounted_volume(root: &FileSystemPath) -> Result<Self, MediaStoreError> {
        let object_store = LocalFileSystem::new_with_prefix(root)
            .map_err(MediaStoreError::Initialize)?
            .with_fsync(true);

        Ok(Self {
            object_store: Arc::new(object_store),
        })
    }

    pub async fn put(&self, payload: PutPayload) -> Result<MediaObjectKey, MediaStoreError> {
        let key = MediaObjectKey::new();
        self.object_store
            .put(key.path(), payload)
            .await
            .map_err(MediaStoreError::ObjectStore)?;

        Ok(key)
    }

    pub async fn get(&self, key: &MediaObjectKey) -> Result<GetResult, MediaStoreError> {
        self.object_store
            .get(key.path())
            .await
            .map_err(MediaStoreError::ObjectStore)
    }

    pub async fn delete(&self, key: &MediaObjectKey) -> Result<(), MediaStoreError> {
        self.object_store
            .delete(key.path())
            .await
            .map_err(MediaStoreError::ObjectStore)
    }

    pub async fn check_readiness(&self) -> Result<(), MediaStoreError> {
        let readiness_probe = Path::from("media/.wicked-learning-readiness-probe");

        match self.object_store.head(&readiness_probe).await {
            Ok(_) | Err(object_store::Error::NotFound { .. }) => Ok(()),
            Err(error) => Err(MediaStoreError::ObjectStore(error)),
        }
    }

    #[cfg(test)]
    pub fn in_memory() -> Self {
        Self {
            object_store: Arc::new(object_store::memory::InMemory::new()),
        }
    }
}

impl MediaObjectKey {
    fn new() -> Self {
        Self(Path::from(format!("media/{}", Uuid::new_v4())))
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

#[cfg(test)]
mod tests {
    use object_store::PutPayload;

    use super::MediaStore;

    #[tokio::test]
    async fn mounted_volume_store_uses_server_owned_opaque_object_keys() {
        let directory = tempfile::tempdir().expect("temporary mounted volume");
        let store = MediaStore::from_mounted_volume(directory.path()).expect("media store");

        let key = store
            .put(PutPayload::from_static(b"private media"))
            .await
            .expect("stored object");
        let bytes = store
            .get(&key)
            .await
            .expect("stored object")
            .bytes()
            .await
            .expect("stored bytes");

        assert_eq!(bytes.as_ref(), b"private media");
        assert!(key.path().as_ref().starts_with("media/"));

        store.delete(&key).await.expect("deleted object");
        assert!(store.get(&key).await.is_err());
    }
}
