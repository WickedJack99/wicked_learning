use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    world_content::{AdminSourceRecord, AdminSourceRecordPage, AdminSourceRecordVersionPage},
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SourceRecordForm {
    pub title: String,
    pub url: String,
    pub publisher: Option<String>,
    pub published_at: Option<String>,
    pub rights: Option<String>,
    pub anchor: Option<String>,
    pub excerpt: Option<String>,
    pub concepts: Vec<String>,
}

impl SourceRecordForm {
    pub fn parse(
        title: &str,
        url: &str,
        publisher: Option<&str>,
        published_at: Option<&str>,
        rights: Option<&str>,
        anchor: Option<&str>,
        excerpt: Option<&str>,
        concepts: &[String],
    ) -> Option<Self> {
        let title = title.trim();
        let url = url.trim();
        let publisher = nullable_field(publisher, 160)?;
        let rights = nullable_field(rights, 240)?;
        let anchor = nullable_field(anchor, 240)?;
        let excerpt = nullable_field(excerpt, 800)?;
        let published_at = published_at
            .map(str::trim)
            .filter(|value| !value.is_empty());
        if title.is_empty()
            || title.chars().count() > 160
            || url.is_empty()
            || url.chars().count() > 2_048
            || !valid_url(url)
            || published_at.is_some_and(|value| !valid_date(value))
            || concepts.len() > 8
            || concepts.iter().any(|value| value.chars().count() > 120)
        {
            return None;
        }
        Some(Self {
            title: title.to_owned(),
            url: url.to_owned(),
            publisher,
            published_at: published_at.map(str::to_owned),
            rights,
            anchor,
            excerpt,
            concepts: concepts
                .iter()
                .map(|value| value.trim().to_owned())
                .collect(),
        })
    }
}

fn nullable_field(value: Option<&str>, maximum: usize) -> Option<Option<String>> {
    let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Some(None);
    };
    (value.chars().count() <= maximum).then(|| Some(value.to_owned()))
}

fn valid_url(value: &str) -> bool {
    let Some((scheme, remainder)) = value.split_once("://") else {
        return false;
    };
    matches!(scheme, "http" | "https") && !remainder.is_empty() && !remainder.starts_with('/')
}

fn valid_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 10
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || !bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| matches!(index, 4 | 7) || byte.is_ascii_digit())
    {
        return false;
    }
    let year = value[..4].parse::<u16>().ok();
    let month = value[5..7].parse::<u8>().ok();
    let day = value[8..10].parse::<u8>().ok();
    let (Some(year), Some(month), Some(day)) = (year, month, day) else {
        return false;
    };
    let days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if year % 400 == 0 || (year % 4 == 0 && year % 100 != 0) => 29,
        2 => 28,
        _ => return false,
    };
    (1..=days).contains(&day)
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SourceRecordPageRequest {
    pub page: i64,
    pub per_page: i64,
}
impl SourceRecordPageRequest {
    pub const DEFAULT_PER_PAGE: i64 = 12;
    pub const MAX_PER_PAGE: i64 = 24;
    pub fn parse(page: Option<i64>, per_page: Option<i64>) -> Option<Self> {
        let page = page.unwrap_or(1);
        let per_page = per_page.unwrap_or(Self::DEFAULT_PER_PAGE);
        (page >= 1 && (1..=Self::MAX_PER_PAGE).contains(&per_page))
            .then_some(Self { page, per_page })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SourceRecordVersionPageRequest {
    pub page: i64,
    pub per_page: i64,
}
impl SourceRecordVersionPageRequest {
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
pub enum AdminSourceRecordsError {
    Unavailable,
}

pub trait AdminSourceRecordsRepository {
    fn list(
        &self,
        principal: &AuthorizedPrincipal,
        page: SourceRecordPageRequest,
        search: Option<&str>,
        concept: Option<&str>,
    ) -> impl Future<Output = Result<Option<AdminSourceRecordPage>, AdminSourceRecordsError>> + Send;
    fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &SourceRecordForm,
    ) -> impl Future<Output = Result<Option<AdminSourceRecord>, AdminSourceRecordsError>> + Send;
    fn update(
        &self,
        principal: &AuthorizedPrincipal,
        source_id: Uuid,
        form: &SourceRecordForm,
    ) -> impl Future<Output = Result<Option<AdminSourceRecord>, AdminSourceRecordsError>> + Send;
    fn versions(
        &self,
        principal: &AuthorizedPrincipal,
        source_id: Uuid,
        page: SourceRecordVersionPageRequest,
    ) -> impl Future<Output = Result<Option<AdminSourceRecordVersionPage>, AdminSourceRecordsError>> + Send;
    fn restore(
        &self,
        principal: &AuthorizedPrincipal,
        source_id: Uuid,
        version_id: Uuid,
    ) -> impl Future<Output = Result<Option<AdminSourceRecord>, AdminSourceRecordsError>> + Send;
    fn delete(
        &self,
        principal: &AuthorizedPrincipal,
        source_id: Uuid,
    ) -> impl Future<Output = Result<bool, AdminSourceRecordsError>> + Send;
}

pub struct AdminSourceRecordsCommand<'repository, Repository> {
    repository: &'repository Repository,
}
impl<'repository, Repository> AdminSourceRecordsCommand<'repository, Repository>
where
    Repository: AdminSourceRecordsRepository,
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
        page: SourceRecordPageRequest,
        search: Option<&str>,
        concept: Option<&str>,
    ) -> Result<Option<AdminSourceRecordPage>, AdminSourceRecordsError> {
        if !Self::permitted(principal) {
            return Ok(None);
        }
        self.repository.list(principal, page, search, concept).await
    }
    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &SourceRecordForm,
    ) -> Result<Option<AdminSourceRecord>, AdminSourceRecordsError> {
        if !Self::permitted(principal) {
            return Ok(None);
        }
        self.repository.create(principal, form).await
    }
    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        source_id: Uuid,
        form: &SourceRecordForm,
    ) -> Result<Option<AdminSourceRecord>, AdminSourceRecordsError> {
        if !Self::permitted(principal) {
            return Ok(None);
        }
        self.repository.update(principal, source_id, form).await
    }
    pub async fn versions(
        &self,
        principal: &AuthorizedPrincipal,
        source_id: Uuid,
        page: SourceRecordVersionPageRequest,
    ) -> Result<Option<AdminSourceRecordVersionPage>, AdminSourceRecordsError> {
        if !Self::permitted(principal) {
            return Ok(None);
        }
        self.repository.versions(principal, source_id, page).await
    }
    pub async fn restore(
        &self,
        principal: &AuthorizedPrincipal,
        source_id: Uuid,
        version_id: Uuid,
    ) -> Result<Option<AdminSourceRecord>, AdminSourceRecordsError> {
        if !Self::permitted(principal) {
            return Ok(None);
        }
        self.repository
            .restore(principal, source_id, version_id)
            .await
    }
    pub async fn delete(
        &self,
        principal: &AuthorizedPrincipal,
        source_id: Uuid,
    ) -> Result<bool, AdminSourceRecordsError> {
        if !Self::permitted(principal) {
            return Ok(false);
        }
        self.repository.delete(principal, source_id).await
    }
}

#[cfg(test)]
mod tests {
    use super::{SourceRecordForm, SourceRecordPageRequest, SourceRecordVersionPageRequest};
    #[test]
    fn retains_source_bounds_and_page_defaults() {
        assert!(
            SourceRecordForm::parse(
                " A source ",
                "https://example.test/source",
                None,
                Some("2026-11-08"),
                None,
                None,
                None,
                &["practice".to_owned()]
            )
            .is_some()
        );
        assert!(
            SourceRecordForm::parse(
                "A source",
                "https://example.test/source",
                None,
                Some("2026-02-29"),
                None,
                None,
                None,
                &[]
            )
            .is_none()
        );
        assert!(
            SourceRecordForm::parse(
                "A",
                "javascript:alert(1)",
                None,
                None,
                None,
                None,
                None,
                &[]
            )
            .is_none()
        );
        assert_eq!(
            SourceRecordPageRequest::parse(None, None)
                .expect("default")
                .per_page,
            12
        );
        assert_eq!(
            SourceRecordVersionPageRequest::parse(None, None)
                .expect("default")
                .per_page,
            8
        );
        assert!(SourceRecordPageRequest::parse(Some(0), None).is_none());
        assert!(SourceRecordVersionPageRequest::parse(None, Some(25)).is_none());
    }
}
