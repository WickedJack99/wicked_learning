use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learning_companion::LearnerCompanion,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LearnerCompanionSurface {
    Activity,
    Desk,
    World,
}

impl LearnerCompanionSurface {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Activity => "activity",
            Self::Desk => "desk",
            Self::World => "world",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearnerCompanionRequest {
    pub activity_id: Option<Uuid>,
    pub map_slug: Option<String>,
    pub surface: LearnerCompanionSurface,
}

impl LearnerCompanionRequest {
    pub fn parse(surface: &str, map_slug: Option<&str>, activity_id: Option<Uuid>) -> Option<Self> {
        let surface = match surface {
            "activity" => LearnerCompanionSurface::Activity,
            "desk" => LearnerCompanionSurface::Desk,
            "world" => LearnerCompanionSurface::World,
            _ => return None,
        };
        let map_slug = map_slug
            .map(str::trim)
            .filter(|slug| !slug.is_empty())
            .map(str::to_owned);
        match surface {
            LearnerCompanionSurface::Desk if map_slug.is_none() && activity_id.is_none() => {}
            LearnerCompanionSurface::World if activity_id.is_none() => {}
            LearnerCompanionSurface::Activity if activity_id.is_some() => {}
            _ => return None,
        }
        Some(Self {
            activity_id,
            map_slug,
            surface,
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LearnerCompanionError {
    Unavailable,
}

pub trait LearnerCompanionRepository {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerCompanionRequest,
    ) -> impl Future<Output = Result<Option<LearnerCompanion>, LearnerCompanionError>> + Send;
}

pub struct LearnerCompanionQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerCompanionQuery<'repository, Repository>
where
    Repository: LearnerCompanionRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerCompanionRequest,
    ) -> Result<Option<LearnerCompanion>, LearnerCompanionError> {
        self.repository.load(principal, request).await
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::{LearnerCompanionRequest, LearnerCompanionSurface};

    #[test]
    fn companion_context_accepts_only_the_source_surface_shape() {
        assert_eq!(
            LearnerCompanionRequest::parse("desk", None, None)
                .expect("a desk request")
                .surface,
            LearnerCompanionSurface::Desk
        );
        assert!(LearnerCompanionRequest::parse("desk", Some("first-path"), None).is_none());
        assert!(LearnerCompanionRequest::parse("world", None, Some(Uuid::new_v4())).is_none());
        assert!(LearnerCompanionRequest::parse("activity", None, None).is_none());
        assert!(LearnerCompanionRequest::parse("unknown", None, None).is_none());
    }
}
