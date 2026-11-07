use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    access_link::{
        AccessLinkAdminData, AccessLinkPreview, AccessLinkPurpose, AccessLinkSummary,
        AccessLinkUsagePolicy,
    },
    identity_access::{ApplicationCapability, AuthorizedPrincipal},
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AccessLinkItemGrant {
    pub item_id: Uuid,
    pub quantity: i32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AccessLinkForm {
    pub expires_at: String,
    pub item_grants: Vec<AccessLinkItemGrant>,
    pub note: Option<String>,
    pub purpose: AccessLinkPurpose,
    pub tool_id: Option<Uuid>,
    pub usage_policy: AccessLinkUsagePolicy,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AccessLinkError;

pub trait AccessLinkRepository {
    fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &AccessLinkForm,
        token_hash: &str,
    ) -> impl Future<Output = Result<Option<AccessLinkSummary>, AccessLinkError>> + Send;
    fn list(&self) -> impl Future<Output = Result<AccessLinkAdminData, AccessLinkError>> + Send;
    fn redeem(
        &self,
        principal: &AuthorizedPrincipal,
        token_hash: &str,
    ) -> impl Future<Output = Result<bool, AccessLinkError>> + Send;
    fn preview(
        &self,
        token_hash: &str,
    ) -> impl Future<Output = Result<Option<AccessLinkPreview>, AccessLinkError>> + Send;
    fn set_enabled(
        &self,
        link_id: Uuid,
        enabled: bool,
    ) -> impl Future<Output = Result<Option<AccessLinkSummary>, AccessLinkError>> + Send;
}

pub struct AccessLinksQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct AccessLinksCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AccessLinksQuery<'repository, Repository>
where
    Repository: AccessLinkRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn list(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<AccessLinkAdminData>, AccessLinkError> {
        if !principal.has_capability(ApplicationCapability::ManageAccessLinks) {
            return Ok(None);
        }
        self.repository.list().await.map(Some)
    }
}

impl<'repository, Repository> AccessLinksCommand<'repository, Repository>
where
    Repository: AccessLinkRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &AccessLinkForm,
        token_hash: &str,
    ) -> Result<Option<AccessLinkSummary>, AccessLinkError> {
        if !principal.has_capability(ApplicationCapability::ManageAccessLinks) {
            return Ok(None);
        }
        self.repository.create(principal, form, token_hash).await
    }

    pub async fn set_enabled(
        &self,
        principal: &AuthorizedPrincipal,
        link_id: Uuid,
        enabled: bool,
    ) -> Result<Option<AccessLinkSummary>, AccessLinkError> {
        if !principal.has_capability(ApplicationCapability::ManageAccessLinks) {
            return Ok(None);
        }
        self.repository.set_enabled(link_id, enabled).await
    }

    pub async fn redeem(
        &self,
        principal: &AuthorizedPrincipal,
        token_hash: &str,
    ) -> Result<bool, AccessLinkError> {
        self.repository.redeem(principal, token_hash).await
    }

    pub async fn preview(
        &self,
        token_hash: &str,
    ) -> Result<Option<AccessLinkPreview>, AccessLinkError> {
        self.repository.preview(token_hash).await
    }
}
