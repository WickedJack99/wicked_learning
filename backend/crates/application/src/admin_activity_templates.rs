use std::future::Future;

use serde_json::Value;
use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    world_content::{
        AdminActivityTemplateDetails, AdminActivityTemplatePage,
        AdminActivityTemplateRevisionDetails, AdminActivityTemplateRevisionPage,
        AdminActivityTemplateSummary,
    },
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ActivityTemplateName(pub String);

impl ActivityTemplateName {
    pub fn parse(value: &str) -> Option<Self> {
        let value = value.trim();
        (!value.is_empty() && value.chars().count() <= 120).then(|| Self(value.to_owned()))
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ActivityTemplatePageRequest {
    pub page: i64,
    pub per_page: i64,
}
impl ActivityTemplatePageRequest {
    pub const DEFAULT_PER_PAGE: i64 = 8;
    pub const MAX_PER_PAGE: i64 = 24;
    pub fn parse(page: Option<i64>, per_page: Option<i64>) -> Option<Self> {
        let page = page.unwrap_or(1);
        let per_page = per_page.unwrap_or(Self::DEFAULT_PER_PAGE);
        (page >= 1 && (1..=Self::MAX_PER_PAGE).contains(&per_page))
            .then_some(Self { page, per_page })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ActivityTemplateRevisionPageRequest {
    pub page: i64,
    pub per_page: i64,
}
impl ActivityTemplateRevisionPageRequest {
    pub const DEFAULT_PER_PAGE: i64 = 6;
    pub const MAX_PER_PAGE: i64 = 24;
    pub fn parse(page: Option<i64>, per_page: Option<i64>) -> Option<Self> {
        let page = page.unwrap_or(1);
        let per_page = per_page.unwrap_or(Self::DEFAULT_PER_PAGE);
        (page >= 1 && (1..=Self::MAX_PER_PAGE).contains(&per_page))
            .then_some(Self { page, per_page })
    }
}

#[derive(Clone, Debug)]
pub struct ActivityTemplateSnapshot {
    pub activity_type: String,
    pub snapshot: Value,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminActivityTemplatesError {
    Invalid,
    Unavailable,
}

pub trait AdminActivityTemplatesRepository {
    fn list(
        &self,
        principal: &AuthorizedPrincipal,
        page: ActivityTemplatePageRequest,
        search: Option<&str>,
    ) -> impl Future<Output = Result<Option<AdminActivityTemplatePage>, AdminActivityTemplatesError>>
    + Send;
    fn create_from_activity(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        name: &ActivityTemplateName,
    ) -> impl Future<
        Output = Result<Option<AdminActivityTemplateSummary>, AdminActivityTemplatesError>,
    > + Send;
    fn details(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
    ) -> impl Future<
        Output = Result<Option<AdminActivityTemplateDetails>, AdminActivityTemplatesError>,
    > + Send;
    fn rename(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        name: &ActivityTemplateName,
    ) -> impl Future<
        Output = Result<Option<AdminActivityTemplateSummary>, AdminActivityTemplatesError>,
    > + Send;
    fn update_from_activity(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        activity_id: Uuid,
    ) -> impl Future<
        Output = Result<Option<AdminActivityTemplateSummary>, AdminActivityTemplatesError>,
    > + Send;
    fn share(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> impl Future<
        Output = Result<Option<AdminActivityTemplateSummary>, AdminActivityTemplatesError>,
    > + Send;
    fn revisions(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        page: ActivityTemplateRevisionPageRequest,
    ) -> impl Future<
        Output = Result<Option<AdminActivityTemplateRevisionPage>, AdminActivityTemplatesError>,
    > + Send;
    fn revision_details(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        revision_id: Uuid,
    ) -> impl Future<
        Output = Result<Option<AdminActivityTemplateRevisionDetails>, AdminActivityTemplatesError>,
    > + Send;
    fn restore(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        revision_id: Uuid,
    ) -> impl Future<
        Output = Result<Option<AdminActivityTemplateSummary>, AdminActivityTemplatesError>,
    > + Send;
    fn delete(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
    ) -> impl Future<Output = Result<bool, AdminActivityTemplatesError>> + Send;
}

pub struct AdminActivityTemplatesCommand<'repository, Repository> {
    repository: &'repository Repository,
}
impl<'repository, Repository> AdminActivityTemplatesCommand<'repository, Repository>
where
    Repository: AdminActivityTemplatesRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }
    fn permitted(principal: &AuthorizedPrincipal) -> bool {
        principal.has_permission("world_activities", "ru")
    }
    pub async fn list(
        &self,
        principal: &AuthorizedPrincipal,
        page: ActivityTemplatePageRequest,
        search: Option<&str>,
    ) -> Result<Option<AdminActivityTemplatePage>, AdminActivityTemplatesError> {
        if !Self::permitted(principal) {
            return Ok(None);
        }
        self.repository.list(principal, page, search).await
    }
    pub async fn create_from_activity(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        name: &ActivityTemplateName,
    ) -> Result<Option<AdminActivityTemplateSummary>, AdminActivityTemplatesError> {
        if !Self::permitted(principal) {
            return Ok(None);
        }
        self.repository
            .create_from_activity(principal, activity_id, name)
            .await
    }
    pub async fn details(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
    ) -> Result<Option<AdminActivityTemplateDetails>, AdminActivityTemplatesError> {
        if !Self::permitted(principal) {
            return Ok(None);
        }
        self.repository.details(principal, template_id).await
    }
    pub async fn rename(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        name: &ActivityTemplateName,
    ) -> Result<Option<AdminActivityTemplateSummary>, AdminActivityTemplatesError> {
        if !Self::permitted(principal) {
            return Ok(None);
        }
        self.repository.rename(principal, template_id, name).await
    }
    pub async fn update_from_activity(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        activity_id: Uuid,
    ) -> Result<Option<AdminActivityTemplateSummary>, AdminActivityTemplatesError> {
        if !Self::permitted(principal) {
            return Ok(None);
        }
        self.repository
            .update_from_activity(principal, template_id, activity_id)
            .await
    }
    pub async fn share(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<AdminActivityTemplateSummary>, AdminActivityTemplatesError> {
        if !Self::permitted(principal) {
            return Ok(None);
        }
        self.repository
            .share(principal, template_id, organization_id)
            .await
    }
    pub async fn revisions(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        page: ActivityTemplateRevisionPageRequest,
    ) -> Result<Option<AdminActivityTemplateRevisionPage>, AdminActivityTemplatesError> {
        if !Self::permitted(principal) {
            return Ok(None);
        }
        self.repository
            .revisions(principal, template_id, page)
            .await
    }
    pub async fn revision_details(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        revision_id: Uuid,
    ) -> Result<Option<AdminActivityTemplateRevisionDetails>, AdminActivityTemplatesError> {
        if !Self::permitted(principal) {
            return Ok(None);
        }
        self.repository
            .revision_details(principal, template_id, revision_id)
            .await
    }
    pub async fn restore(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        revision_id: Uuid,
    ) -> Result<Option<AdminActivityTemplateSummary>, AdminActivityTemplatesError> {
        if !Self::permitted(principal) {
            return Ok(None);
        }
        self.repository
            .restore(principal, template_id, revision_id)
            .await
    }
    pub async fn delete(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
    ) -> Result<bool, AdminActivityTemplatesError> {
        if !Self::permitted(principal) {
            return Ok(false);
        }
        self.repository.delete(principal, template_id).await
    }
}

#[cfg(test)]
mod tests {
    use super::{
        ActivityTemplateName, ActivityTemplatePageRequest, ActivityTemplateRevisionPageRequest,
    };
    #[test]
    fn retains_source_template_names_and_bounded_pages() {
        assert_eq!(
            ActivityTemplateName::parse("  A reusable activity  ")
                .expect("name")
                .0,
            "A reusable activity"
        );
        assert!(ActivityTemplateName::parse("").is_none());
        assert!(ActivityTemplateName::parse(&"a".repeat(121)).is_none());
        assert!(ActivityTemplatePageRequest::parse(Some(0), Some(8)).is_none());
        assert!(ActivityTemplatePageRequest::parse(Some(1), Some(25)).is_none());
        assert_eq!(
            ActivityTemplatePageRequest::parse(None, None)
                .expect("page")
                .per_page,
            8
        );
        assert_eq!(
            ActivityTemplateRevisionPageRequest::parse(None, None)
                .expect("page")
                .per_page,
            6
        );
        assert!(ActivityTemplateRevisionPageRequest::parse(Some(1), Some(25)).is_none());
    }
}
