use std::future::Future;

use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    platform_presentation::{PublicPage, PublicSourceLink, PublicSourceLinks},
};

use crate::public_page::PublicPageSlug;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminPublicContentError;

/// The three direct source routes retain a separate fixed-content override.
/// Configured information pages belong to the public-presentation workspace;
/// keeping this narrower allow-list prevents the legacy override writer from
/// creating a second dynamic-page lifecycle.
pub const EDITABLE_PUBLIC_PAGE_SLUGS: [&str; 3] = ["about", "imprint", "data-protection"];

pub trait AdminPublicContentRepository {
    fn load_pages(
        &self,
    ) -> impl Future<Output = Result<Vec<PublicPage>, AdminPublicContentError>> + Send;

    fn update_page(
        &self,
        slug: &PublicPageSlug,
        body: String,
    ) -> impl Future<Output = Result<Option<PublicPage>, AdminPublicContentError>> + Send;

    fn load_source_links(
        &self,
    ) -> impl Future<Output = Result<PublicSourceLinks, AdminPublicContentError>> + Send;

    fn replace_source_links(
        &self,
        links: PublicSourceLinks,
    ) -> impl Future<Output = Result<PublicSourceLinks, AdminPublicContentError>> + Send;
}

pub struct AdminPublicContentQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct UpdateAdminPublicInformationPage<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct UpdateAdminPublicSourceLinks<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminPublicContentQuery<'repository, Repository>
where
    Repository: AdminPublicContentRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn pages(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<Vec<PublicPage>>, AdminPublicContentError> {
        if !principal.has_permission("presentation", "ro") {
            return Ok(None);
        }

        self.repository.load_pages().await.map(Some)
    }

    pub async fn source_links(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<PublicSourceLinks>, AdminPublicContentError> {
        if !principal.has_permission("presentation", "ro") {
            return Ok(None);
        }

        self.repository.load_source_links().await.map(Some)
    }
}

impl<'repository, Repository> UpdateAdminPublicInformationPage<'repository, Repository>
where
    Repository: AdminPublicContentRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        slug: &PublicPageSlug,
        body: String,
    ) -> Result<Option<PublicPage>, AdminPublicContentError> {
        if !principal.has_permission("presentation", "ru")
            || !editable_page(slug)
            || !valid_markdown(&body)
        {
            return Ok(None);
        }

        self.repository.update_page(slug, body).await
    }
}

impl<'repository, Repository> UpdateAdminPublicSourceLinks<'repository, Repository>
where
    Repository: AdminPublicContentRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        links: PublicSourceLinks,
    ) -> Result<Option<PublicSourceLinks>, AdminPublicContentError> {
        if !principal.has_permission("presentation", "ru") || !valid_source_links(&links) {
            return Ok(None);
        }

        self.repository.replace_source_links(links).await.map(Some)
    }
}

pub fn editable_page(slug: &PublicPageSlug) -> bool {
    EDITABLE_PUBLIC_PAGE_SLUGS.contains(&slug.as_str())
}

pub fn valid_markdown(body: &str) -> bool {
    !body.is_empty() && body.chars().count() <= 50_000
}

/// Mirrors Laravel's required URL and 80-character label constraints while
/// retaining the existing database's HTTP(S)-only policy.
pub fn valid_source_links(links: &PublicSourceLinks) -> bool {
    links.modified_sources.len() <= 12
        && valid_source_link(&links.origin)
        && links.modified_sources.iter().all(valid_source_link)
}

fn valid_source_link(link: &PublicSourceLink) -> bool {
    !link.label.is_empty()
        && link.label.chars().count() <= 80
        && !link.url.is_empty()
        && link.url.chars().count() <= 2_048
        && (link.url.starts_with("https://") || link.url.starts_with("http://"))
        && !link.url.chars().any(char::is_whitespace)
}

#[cfg(test)]
mod tests {
    use std::future::ready;

    use uuid::Uuid;
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal,
        platform_presentation::{PublicPage, PublicSourceLink, PublicSourceLinks},
    };

    use super::{
        AdminPublicContentError, AdminPublicContentQuery, AdminPublicContentRepository,
        UpdateAdminPublicInformationPage, UpdateAdminPublicSourceLinks,
    };
    use crate::public_page::PublicPageSlug;

    struct Repository;

    impl AdminPublicContentRepository for Repository {
        fn load_pages(
            &self,
        ) -> impl std::future::Future<Output = Result<Vec<PublicPage>, AdminPublicContentError>> + Send
        {
            ready(Ok(vec![]))
        }

        fn update_page(
            &self,
            _: &PublicPageSlug,
            _: String,
        ) -> impl std::future::Future<Output = Result<Option<PublicPage>, AdminPublicContentError>> + Send
        {
            ready(Ok(None))
        }

        fn load_source_links(
            &self,
        ) -> impl std::future::Future<Output = Result<PublicSourceLinks, AdminPublicContentError>> + Send
        {
            ready(Ok(links()))
        }

        fn replace_source_links(
            &self,
            links: PublicSourceLinks,
        ) -> impl std::future::Future<Output = Result<PublicSourceLinks, AdminPublicContentError>> + Send
        {
            ready(Ok(links))
        }
    }

    #[tokio::test]
    async fn public_content_commands_require_the_source_presentation_permission() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec![],
        };
        let slug = PublicPageSlug::parse("about").unwrap();

        assert!(
            AdminPublicContentQuery::new(&Repository)
                .pages(&principal)
                .await
                .unwrap()
                .is_none()
        );
        assert!(
            UpdateAdminPublicInformationPage::new(&Repository)
                .execute(&principal, &slug, "# About".to_owned())
                .await
                .unwrap()
                .is_none()
        );
        assert!(
            UpdateAdminPublicSourceLinks::new(&Repository)
                .execute(&principal, links())
                .await
                .unwrap()
                .is_none()
        );
    }

    #[tokio::test]
    async fn public_content_rejects_invalid_markdown_and_non_http_source_links() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:presentation:ru:all".to_owned()],
        };
        let slug = PublicPageSlug::parse("about").unwrap();
        let invalid_links = PublicSourceLinks {
            origin: PublicSourceLink {
                label: "Origin".to_owned(),
                url: "ftp://example.test/source".to_owned(),
            },
            modified_sources: vec![],
        };

        assert!(
            UpdateAdminPublicInformationPage::new(&Repository)
                .execute(&principal, &slug, "x".repeat(50_001))
                .await
                .unwrap()
                .is_none()
        );
        assert!(
            UpdateAdminPublicInformationPage::new(&Repository)
                .execute(&principal, &slug, String::new())
                .await
                .unwrap()
                .is_none()
        );
        assert!(
            UpdateAdminPublicSourceLinks::new(&Repository)
                .execute(&principal, invalid_links)
                .await
                .unwrap()
                .is_none()
        );
    }

    fn links() -> PublicSourceLinks {
        PublicSourceLinks {
            origin: PublicSourceLink {
                label: "Original project".to_owned(),
                url: "https://example.test/original".to_owned(),
            },
            modified_sources: vec![],
        }
    }
}
