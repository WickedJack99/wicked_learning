use std::future::Future;

use wicked_learning_domain::world_content::PublicRouteOutline;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PublicRouteReadError;

/// The application boundary for a published route outline.
pub trait PublicRouteRepository {
    fn load_published_outline(
        &self,
        world_slug: &str,
        map_slug: &str,
        asset_slug: &str,
        route_slug: &str,
    ) -> impl Future<Output = Result<Option<PublicRouteOutline>, PublicRouteReadError>> + Send;
}

pub struct PublicRouteQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> PublicRouteQuery<'repository, Repository>
where
    Repository: PublicRouteRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        world_slug: &str,
        map_slug: &str,
        asset_slug: &str,
        route_slug: &str,
    ) -> Result<Option<PublicRouteOutline>, PublicRouteReadError> {
        self.repository
            .load_published_outline(world_slug, map_slug, asset_slug, route_slug)
            .await
    }
}
