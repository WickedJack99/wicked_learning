use std::future::Future;

use serde_json::Value;
use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

use crate::{
    admin_world_map_create::CreateWorldMapForm, admin_world_map_export_preflight::validate_manifest,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldMapImportError {
    Invalid,
    Unavailable,
}

pub trait AdminWorldMapImportRepository {
    fn import_map(
        &self,
        principal: &AuthorizedPrincipal,
        form: &CreateWorldMapForm,
        manifest: &Value,
    ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldMapImportError>> + Send;
}

pub struct AdminWorldMapImportCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldMapImportCommand<'repository, Repository>
where
    Repository: AdminWorldMapImportRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        form: &CreateWorldMapForm,
        manifest: &[u8],
    ) -> Result<Option<Uuid>, AdminWorldMapImportError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(None);
        }
        let validation = validate_manifest(manifest);
        if !validation.valid {
            return Ok(None);
        }
        let payload =
            serde_json::from_slice(manifest).map_err(|_| AdminWorldMapImportError::Invalid)?;
        self.repository.import_map(principal, form, &payload).await
    }
}

#[cfg(test)]
mod tests {
    use std::{
        future::Future,
        sync::{
            Arc,
            atomic::{AtomicBool, Ordering},
        },
    };

    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::*;

    struct Repository(Arc<AtomicBool>);

    impl AdminWorldMapImportRepository for Repository {
        fn import_map(
            &self,
            _: &AuthorizedPrincipal,
            _: &CreateWorldMapForm,
            _: &Value,
        ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldMapImportError>> + Send {
            self.0.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn rejects_an_invalid_manifest_before_the_importer_is_called() {
        let called = Arc::new(AtomicBool::new(false));
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:ru:all".to_owned()],
        };
        let form = CreateWorldMapForm::parse("Imported map", None, None).expect("form");
        let imported = AdminWorldMapImportCommand::new(&Repository(called.clone()))
            .execute(&principal, &form, br#"{}"#)
            .await
            .expect("validation");
        assert_eq!(imported, None);
        assert!(!called.load(Ordering::SeqCst));
    }
}
