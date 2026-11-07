use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminWorldMapCreateError;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreateWorldMapForm {
    pub title: String,
    pub slug: Option<String>,
    pub description: Option<String>,
}

impl CreateWorldMapForm {
    pub fn parse(title: &str, slug: Option<&str>, description: Option<&str>) -> Option<Self> {
        let title = title.trim();
        if title.is_empty() || title.len() > 120 {
            return None;
        }
        let slug = slug.map(str::trim).filter(|value| !value.is_empty());
        if slug.is_some_and(|value| value.len() > 140 || !valid_slug(value)) {
            return None;
        }
        let description = description.map(str::trim).filter(|value| !value.is_empty());
        if description.is_some_and(|value| value.len() > 1_000) {
            return None;
        }
        Some(Self {
            title: title.to_owned(),
            slug: slug.map(str::to_owned),
            description: description.map(str::to_owned),
        })
    }
}

pub fn generated_map_slug(title: &str) -> String {
    let mut slug = String::new();
    let mut separator = true;
    for character in deunicode::deunicode(title).chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character.to_ascii_lowercase());
            separator = false;
        } else if !separator {
            slug.push('-');
            separator = true;
        }
    }
    let slug = slug.trim_matches('-');
    if slug.is_empty() {
        "map".to_owned()
    } else {
        slug.to_owned()
    }
}

fn valid_slug(value: &str) -> bool {
    value
        .bytes()
        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}

pub trait AdminWorldMapCreateRepository {
    fn create_map(
        &self,
        principal: &AuthorizedPrincipal,
        form: &CreateWorldMapForm,
    ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldMapCreateError>> + Send;
}

pub struct AdminWorldMapCreateCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldMapCreateCommand<'repository, Repository>
where
    Repository: AdminWorldMapCreateRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        form: &CreateWorldMapForm,
    ) -> Result<Option<Uuid>, AdminWorldMapCreateError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(None);
        }
        self.repository.create_map(principal, form).await
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

    use super::{
        AdminWorldMapCreateCommand, AdminWorldMapCreateError, AdminWorldMapCreateRepository,
        CreateWorldMapForm, generated_map_slug,
    };

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldMapCreateRepository for RecordingRepository {
        fn create_map(
            &self,
            _: &AuthorizedPrincipal,
            _: &CreateWorldMapForm,
        ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldMapCreateError>> + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[test]
    fn retains_source_bounds_and_generates_safe_slug() {
        assert!(CreateWorldMapForm::parse("Astronomy Garden", None, Some("A map.")).is_some());
        assert!(CreateWorldMapForm::parse("", None, None).is_none());
        assert!(CreateWorldMapForm::parse("Map", Some("unsafe slug"), None).is_none());
        assert_eq!(
            generated_map_slug("Über den nächsten Schritt"),
            "uber-den-nachsten-schritt"
        );
    }

    #[tokio::test]
    async fn requires_world_map_update_before_creating() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_nodes:rud:all".to_owned()],
        };
        let form = CreateWorldMapForm::parse("A map", None, None).expect("valid map form");
        let result = AdminWorldMapCreateCommand::new(&repository)
            .execute(&principal, &form)
            .await
            .expect("authorization check");

        assert_eq!(result, None);
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
