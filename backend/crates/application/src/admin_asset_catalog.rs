use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    world_content::{AdminEditableItem, AdminEditableTool},
};

#[derive(Clone, Debug, PartialEq)]
pub struct ItemForm {
    pub title: String,
    pub slug: Option<String>,
    pub description: Option<String>,
    pub image_dark: Option<String>,
    pub image_light: Option<String>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ToolForm {
    pub title: String,
    pub slug: Option<String>,
    pub description: Option<String>,
    pub image_dark: Option<String>,
    pub image_light: Option<String>,
    pub animation_dark: Option<String>,
    pub animation_light: Option<String>,
    pub animation_duration_seconds: Option<f64>,
    pub animation_width_percent: Option<f64>,
    pub image_width_percent: Option<f64>,
}

impl ItemForm {
    pub fn parse(
        title: &str,
        slug: Option<&str>,
        description: Option<&str>,
        image_dark: Option<&str>,
        image_light: Option<&str>,
    ) -> Option<Self> {
        Some(Self {
            title: required(title, 120)?,
            slug: optional_slug(slug)?,
            description: optional(description, 1_000)?,
            image_dark: optional(image_dark, 2_048)?,
            image_light: optional(image_light, 2_048)?,
        })
    }
}

impl ToolForm {
    #[allow(clippy::too_many_arguments)]
    pub fn parse(
        title: &str,
        slug: Option<&str>,
        description: Option<&str>,
        image_dark: Option<&str>,
        image_light: Option<&str>,
        animation_dark: Option<&str>,
        animation_light: Option<&str>,
        animation_duration_seconds: Option<f64>,
        animation_width_percent: Option<f64>,
        image_width_percent: Option<f64>,
    ) -> Option<Self> {
        if animation_duration_seconds
            .is_some_and(|value| !value.is_finite() || !(0.0..=600.0).contains(&value))
            || animation_width_percent
                .is_some_and(|value| !value.is_finite() || !(1.0..=100.0).contains(&value))
            || image_width_percent
                .is_some_and(|value| !value.is_finite() || !(1.0..=100.0).contains(&value))
        {
            return None;
        }

        Some(Self {
            title: required(title, 120)?,
            slug: optional_slug(slug)?,
            description: optional(description, 1_000)?,
            image_dark: optional(image_dark, 2_048)?,
            image_light: optional(image_light, 2_048)?,
            animation_dark: optional(animation_dark, 2_048)?,
            animation_light: optional(animation_light, 2_048)?,
            animation_duration_seconds,
            animation_width_percent,
            image_width_percent,
        })
    }
}

fn required(value: &str, maximum: usize) -> Option<String> {
    let value = value.trim();
    (!value.is_empty() && value.chars().count() <= maximum).then(|| value.to_owned())
}

fn optional(value: Option<&str>, maximum: usize) -> Option<Option<String>> {
    let value = value.map(str::trim).filter(|value| !value.is_empty());
    value
        .is_none_or(|value| value.chars().count() <= maximum)
        .then(|| value.map(str::to_owned))
}

fn optional_slug(value: Option<&str>) -> Option<Option<String>> {
    let value = value.map(str::trim).filter(|value| !value.is_empty());
    value
        .is_none_or(|value| {
            value.chars().count() <= 140
                && value
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        })
        .then(|| value.map(str::to_owned))
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminAssetCatalogError {
    Conflict,
    Invalid,
    Unavailable,
}

pub trait AdminAssetCatalogRepository {
    fn list_items(
        &self,
    ) -> impl Future<Output = Result<Vec<AdminEditableItem>, AdminAssetCatalogError>> + Send;
    fn create_item(
        &self,
        form: &ItemForm,
    ) -> impl Future<Output = Result<AdminEditableItem, AdminAssetCatalogError>> + Send;
    fn update_item(
        &self,
        id: Uuid,
        form: &ItemForm,
    ) -> impl Future<Output = Result<Option<AdminEditableItem>, AdminAssetCatalogError>> + Send;
    fn list_tools(
        &self,
    ) -> impl Future<Output = Result<Vec<AdminEditableTool>, AdminAssetCatalogError>> + Send;
    fn create_tool(
        &self,
        form: &ToolForm,
    ) -> impl Future<Output = Result<AdminEditableTool, AdminAssetCatalogError>> + Send;
    fn update_tool(
        &self,
        id: Uuid,
        form: &ToolForm,
    ) -> impl Future<Output = Result<Option<AdminEditableTool>, AdminAssetCatalogError>> + Send;
}

pub struct AdminAssetCatalogCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminAssetCatalogCommand<'repository, Repository>
where
    Repository: AdminAssetCatalogRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn list_items(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<Vec<AdminEditableItem>>, AdminAssetCatalogError> {
        if !principal.has_permission("assets", "ro") {
            return Ok(None);
        }
        self.repository.list_items().await.map(Some)
    }

    pub async fn create_item(
        &self,
        principal: &AuthorizedPrincipal,
        form: &ItemForm,
    ) -> Result<Option<AdminEditableItem>, AdminAssetCatalogError> {
        if !principal.has_permission("assets", "ru") {
            return Ok(None);
        }
        self.repository.create_item(form).await.map(Some)
    }

    pub async fn update_item(
        &self,
        principal: &AuthorizedPrincipal,
        id: Uuid,
        form: &ItemForm,
    ) -> Result<Option<AdminEditableItem>, AdminAssetCatalogError> {
        if !principal.has_permission("assets", "ru") {
            return Ok(None);
        }
        self.repository.update_item(id, form).await
    }

    pub async fn list_tools(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<Vec<AdminEditableTool>>, AdminAssetCatalogError> {
        if !principal.has_permission("assets", "ro") {
            return Ok(None);
        }
        self.repository.list_tools().await.map(Some)
    }

    pub async fn create_tool(
        &self,
        principal: &AuthorizedPrincipal,
        form: &ToolForm,
    ) -> Result<Option<AdminEditableTool>, AdminAssetCatalogError> {
        if !principal.has_permission("assets", "ru") {
            return Ok(None);
        }
        self.repository.create_tool(form).await.map(Some)
    }

    pub async fn update_tool(
        &self,
        principal: &AuthorizedPrincipal,
        id: Uuid,
        form: &ToolForm,
    ) -> Result<Option<AdminEditableTool>, AdminAssetCatalogError> {
        if !principal.has_permission("assets", "ru") {
            return Ok(None);
        }
        self.repository.update_tool(id, form).await
    }
}

#[cfg(test)]
mod tests {
    use super::{ItemForm, ToolForm};

    #[test]
    fn retains_the_source_item_bounds() {
        assert!(ItemForm::parse("Compass", None, Some("A useful marker"), None, None).is_some());
        assert!(ItemForm::parse("", None, None, None, None).is_none());
        assert!(ItemForm::parse("Compass", Some("Not a slug"), None, None, None).is_none());
    }

    #[test]
    fn retains_the_source_tool_numeric_bounds() {
        assert!(
            ToolForm::parse(
                "Lens",
                None,
                None,
                None,
                None,
                None,
                None,
                Some(0.0),
                Some(100.0),
                Some(16.0)
            )
            .is_some()
        );
        assert!(
            ToolForm::parse(
                "Lens",
                None,
                None,
                None,
                None,
                None,
                None,
                Some(601.0),
                None,
                None
            )
            .is_none()
        );
    }
}
