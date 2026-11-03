use std::future::Future;

use wicked_learning_domain::world_content::PublicMapAssetDetail;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PublicMapAssetReadError;

/// The application boundary for the public map-place detail journey.
pub trait PublicMapAssetRepository {
    fn load_published_focusable(
        &self,
        world_slug: &str,
        map_slug: &str,
        asset_slug: &str,
    ) -> impl Future<Output = Result<Option<PublicMapAssetDetail>, PublicMapAssetReadError>> + Send;
}

pub struct PublicMapAssetQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> PublicMapAssetQuery<'repository, Repository>
where
    Repository: PublicMapAssetRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        world_slug: &str,
        map_slug: &str,
        asset_slug: &str,
    ) -> Result<Option<PublicMapAssetDetail>, PublicMapAssetReadError> {
        self.repository
            .load_published_focusable(world_slug, map_slug, asset_slug)
            .await
    }
}
