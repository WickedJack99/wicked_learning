use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ItemGrantItem {
    pub item_id: Uuid,
    pub quantity: u16,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ItemGrantActivityForm {
    pub title: String,
    pub slug: Option<String>,
    pub introduction: Option<String>,
    pub background_dark: String,
    pub background_light: String,
    pub background_mirrored: bool,
    pub items: Vec<ItemGrantItem>,
    pub probability_percent: f64,
}

impl ItemGrantActivityForm {
    pub fn parse(
        title: &str,
        slug: Option<&str>,
        introduction: Option<&str>,
        background_dark: Option<&str>,
        background_light: Option<&str>,
        background_mirrored: bool,
        items: Vec<ItemGrantItem>,
        probability_percent: f64,
    ) -> Option<Self> {
        let title = title.trim();
        let slug = slug.map(str::trim).filter(|value| !value.is_empty());
        if title.is_empty()
            || title.chars().count() > 120
            || slug.is_some_and(|value| value.chars().count() > 140 || !valid_slug(value))
            || introduction.is_some_and(|value| value.chars().count() > 1_000)
            || background_dark.is_some_and(|value| value.chars().count() > 2_048)
            || background_light.is_some_and(|value| value.chars().count() > 2_048)
            || items
                .iter()
                .any(|item| item.quantity == 0 || item.quantity > 999)
            || !probability_percent.is_finite()
            || !(0.01..=100.0).contains(&probability_percent)
        {
            return None;
        }
        Some(Self {
            title: title.to_owned(),
            slug: slug.map(str::to_owned),
            introduction: introduction.map(str::to_owned),
            background_dark: background_dark.unwrap_or_default().to_owned(),
            background_light: background_light.unwrap_or_default().to_owned(),
            background_mirrored,
            items,
            probability_percent,
        })
    }
}

fn valid_slug(value: &str) -> bool {
    value
        .bytes()
        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}

/// Generates the same safe fallback identifier used by the other migrated
/// World Builder activity forms when the author leaves the slug blank.
pub fn generated_slug(title: &str) -> String {
    let mut slug = String::new();
    let mut previous_was_separator = true;
    for character in deunicode::deunicode(title).chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character.to_ascii_lowercase());
            previous_was_separator = false;
        } else if !previous_was_separator {
            slug.push('-');
            previous_was_separator = true;
        }
    }
    let slug = slug.trim_matches('-');
    if slug.is_empty() {
        "activity".to_owned()
    } else {
        slug.to_owned()
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldItemGrantError {
    InvalidActivity,
    Conflict,
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdatedItemGrantActivity {
    pub activity_id: Uuid,
    pub updated_at: String,
}

pub trait AdminWorldItemGrantRepository {
    fn create_item_grant(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &ItemGrantActivityForm,
    ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldItemGrantError>> + Send;
    fn update_item_grant(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &ItemGrantActivityForm,
        expected_updated_at: &str,
    ) -> impl Future<Output = Result<Option<UpdatedItemGrantActivity>, AdminWorldItemGrantError>> + Send;
}

pub struct AdminWorldItemGrantCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldItemGrantCommand<'repository, Repository>
where
    Repository: AdminWorldItemGrantRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }
    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &ItemGrantActivityForm,
    ) -> Result<Option<Uuid>, AdminWorldItemGrantError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .create_item_grant(principal, node_id, form)
            .await
    }
    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &ItemGrantActivityForm,
        expected_updated_at: &str,
    ) -> Result<Option<UpdatedItemGrantActivity>, AdminWorldItemGrantError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .update_item_grant(principal, activity_id, form, expected_updated_at)
            .await
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
        AdminWorldItemGrantCommand, AdminWorldItemGrantError, AdminWorldItemGrantRepository,
        ItemGrantActivityForm, ItemGrantItem, UpdatedItemGrantActivity, generated_slug,
    };

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldItemGrantRepository for RecordingRepository {
        fn create_item_grant(
            &self,
            _principal: &AuthorizedPrincipal,
            _node_id: Uuid,
            _form: &ItemGrantActivityForm,
        ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldItemGrantError>> + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn update_item_grant(
            &self,
            _principal: &AuthorizedPrincipal,
            _activity_id: Uuid,
            _form: &ItemGrantActivityForm,
            _expected_updated_at: &str,
        ) -> impl Future<
            Output = Result<Option<UpdatedItemGrantActivity>, AdminWorldItemGrantError>,
        > + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[test]
    fn retains_source_item_grant_bounds() {
        let item = ItemGrantItem {
            item_id: Uuid::new_v4(),
            quantity: 1,
        };
        assert!(
            ItemGrantActivityForm::parse("Grant", None, None, None, None, false, vec![item], 100.0)
                .is_some()
        );
        assert!(
            ItemGrantActivityForm::parse("Grant", None, None, None, None, false, vec![], 0.0)
                .is_none()
        );
        assert_eq!(generated_slug("Über a grant"), "uber-a-grant");
        assert!(
            ItemGrantActivityForm::parse(
                "Grant",
                None,
                None,
                Some(&"x".repeat(2_049)),
                None,
                false,
                vec![],
                100.0,
            )
            .is_none()
        );
    }

    #[tokio::test]
    async fn requires_source_world_activity_update_before_catalog_resolution_or_writing() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_nodes:rud:all".to_owned()],
        };
        let form =
            ItemGrantActivityForm::parse("Grant", None, None, None, None, false, vec![], 100.0)
                .expect("a bounded source form is valid");

        let result = AdminWorldItemGrantCommand::new(&repository)
            .create(&principal, Uuid::new_v4(), &form)
            .await
            .expect("authorization check succeeds");

        assert_eq!(result, None);
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
