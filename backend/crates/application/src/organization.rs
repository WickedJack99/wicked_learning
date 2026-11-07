use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    organization::{OrganizationDetail, OrganizationDirectory},
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct OrganizationError;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OrganizationForm {
    pub description: Option<String>,
    pub governance_type: String,
    pub name: String,
    pub slogan: Option<String>,
}

impl OrganizationForm {
    pub fn parse(
        name: &str,
        slogan: Option<&str>,
        description: Option<&str>,
        governance_type: &str,
    ) -> Option<Self> {
        let name = name.trim();
        let slogan = optional_trimmed(slogan);
        let description = optional_trimmed(description);
        if name.is_empty()
            || name.chars().count() > 120
            || slogan
                .as_ref()
                .is_some_and(|value| value.chars().count() > 180)
            || description
                .as_ref()
                .is_some_and(|value| value.chars().count() > 4_000)
            || !matches!(governance_type, "monarchy" | "anarchy" | "random")
        {
            return None;
        }
        Some(Self {
            description,
            governance_type: governance_type.to_owned(),
            name: name.to_owned(),
            slogan,
        })
    }
}

pub trait OrganizationRepository {
    fn list(
        &self,
        principal: &AuthorizedPrincipal,
        page: i64,
        search: Option<&str>,
    ) -> impl Future<Output = Result<OrganizationDirectory, OrganizationError>> + Send;

    fn show(
        &self,
        principal: &AuthorizedPrincipal,
        slug: &str,
        members_page: i64,
        messages_page: i64,
        join_requests_page: i64,
    ) -> impl Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send;

    fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &OrganizationForm,
    ) -> impl Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send;

    fn update(
        &self,
        principal: &AuthorizedPrincipal,
        slug: &str,
        form: &OrganizationForm,
    ) -> impl Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send;

    fn request_join(
        &self,
        principal: &AuthorizedPrincipal,
        slug: &str,
        message: Option<&str>,
    ) -> impl Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send;

    fn respond_to_join_request(
        &self,
        principal: &AuthorizedPrincipal,
        request_id: Uuid,
        approved: bool,
    ) -> impl Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send;

    fn leave(
        &self,
        principal: &AuthorizedPrincipal,
        slug: &str,
    ) -> impl Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send;

    fn promote_member(
        &self,
        principal: &AuthorizedPrincipal,
        membership_id: Uuid,
    ) -> impl Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send;

    fn remove_member(
        &self,
        principal: &AuthorizedPrincipal,
        membership_id: Uuid,
    ) -> impl Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send;

    fn send_message(
        &self,
        principal: &AuthorizedPrincipal,
        slug: &str,
        body: &str,
    ) -> impl Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send;

    fn delete_message(
        &self,
        principal: &AuthorizedPrincipal,
        message_id: Uuid,
    ) -> impl Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send;

    fn hide_message(
        &self,
        principal: &AuthorizedPrincipal,
        message_id: Uuid,
    ) -> impl Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send;
}

pub struct OrganizationsQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct OrganizationCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> OrganizationsQuery<'repository, Repository>
where
    Repository: OrganizationRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn list(
        &self,
        principal: &AuthorizedPrincipal,
        page: i64,
        search: Option<&str>,
    ) -> Result<OrganizationDirectory, OrganizationError> {
        self.repository
            .list(principal, page.clamp(1, 10_000), valid_search(search))
            .await
    }

    pub async fn show(
        &self,
        principal: &AuthorizedPrincipal,
        slug: &str,
        members_page: i64,
        messages_page: i64,
        join_requests_page: i64,
    ) -> Result<Option<OrganizationDetail>, OrganizationError> {
        self.repository
            .show(
                principal,
                slug,
                members_page.clamp(1, 10_000),
                messages_page.clamp(1, 10_000),
                join_requests_page.clamp(1, 10_000),
            )
            .await
    }
}

impl<'repository, Repository> OrganizationCommand<'repository, Repository>
where
    Repository: OrganizationRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &OrganizationForm,
    ) -> Result<Option<OrganizationDetail>, OrganizationError> {
        self.repository.create(principal, form).await
    }
    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        slug: &str,
        form: &OrganizationForm,
    ) -> Result<Option<OrganizationDetail>, OrganizationError> {
        self.repository.update(principal, slug, form).await
    }
    pub async fn request_join(
        &self,
        principal: &AuthorizedPrincipal,
        slug: &str,
        message: Option<&str>,
    ) -> Result<Option<OrganizationDetail>, OrganizationError> {
        self.repository
            .request_join(principal, slug, valid_join_message(message))
            .await
    }
    pub async fn respond_to_join_request(
        &self,
        principal: &AuthorizedPrincipal,
        request_id: Uuid,
        approved: bool,
    ) -> Result<Option<OrganizationDetail>, OrganizationError> {
        self.repository
            .respond_to_join_request(principal, request_id, approved)
            .await
    }
    pub async fn leave(
        &self,
        principal: &AuthorizedPrincipal,
        slug: &str,
    ) -> Result<Option<OrganizationDetail>, OrganizationError> {
        self.repository.leave(principal, slug).await
    }
    pub async fn promote_member(
        &self,
        principal: &AuthorizedPrincipal,
        membership_id: Uuid,
    ) -> Result<Option<OrganizationDetail>, OrganizationError> {
        self.repository
            .promote_member(principal, membership_id)
            .await
    }
    pub async fn remove_member(
        &self,
        principal: &AuthorizedPrincipal,
        membership_id: Uuid,
    ) -> Result<Option<OrganizationDetail>, OrganizationError> {
        self.repository
            .remove_member(principal, membership_id)
            .await
    }
    pub async fn send_message(
        &self,
        principal: &AuthorizedPrincipal,
        slug: &str,
        body: &str,
    ) -> Result<Option<OrganizationDetail>, OrganizationError> {
        let Some(body) = valid_message_body(body) else {
            return Ok(None);
        };
        self.repository.send_message(principal, slug, body).await
    }
    pub async fn delete_message(
        &self,
        principal: &AuthorizedPrincipal,
        message_id: Uuid,
    ) -> Result<Option<OrganizationDetail>, OrganizationError> {
        self.repository.delete_message(principal, message_id).await
    }
    pub async fn hide_message(
        &self,
        principal: &AuthorizedPrincipal,
        message_id: Uuid,
    ) -> Result<Option<OrganizationDetail>, OrganizationError> {
        self.repository.hide_message(principal, message_id).await
    }
}

fn optional_trimmed(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}
fn valid_search(value: Option<&str>) -> Option<&str> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty() && value.chars().count() <= 120)
}
fn valid_join_message(value: Option<&str>) -> Option<&str> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty() && value.chars().count() <= 1_000)
}
pub fn valid_message_body(body: &str) -> Option<&str> {
    let body = body.trim();
    (!body.is_empty() && body.chars().count() <= 4_000).then_some(body)
}

#[cfg(test)]
mod tests {
    use super::{OrganizationForm, valid_message_body};

    #[test]
    fn preserves_source_organization_field_bounds() {
        assert_eq!(
            OrganizationForm::parse(
                "  Learning guild ",
                Some("  A motto  "),
                Some("  "),
                "random"
            )
            .map(|form| (
                form.name,
                form.slogan,
                form.description,
                form.governance_type
            )),
            Some((
                "Learning guild".to_owned(),
                Some("A motto".to_owned()),
                None,
                "random".to_owned()
            ))
        );
        assert!(OrganizationForm::parse("", None, None, "monarchy").is_none());
        assert!(OrganizationForm::parse("Guild", None, None, "other").is_none());
        assert!(
            OrganizationForm::parse("Guild", Some(&"x".repeat(181)), None, "monarchy").is_none()
        );
        assert_eq!(valid_message_body(" hello "), Some("hello"));
        assert!(valid_message_body(&"x".repeat(4_001)).is_none());
    }
}
