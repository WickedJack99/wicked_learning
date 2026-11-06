use std::future::Future;

use wicked_learning_domain::platform_presentation::PublicPresentation;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PublicPresentationReadError;

/// Application boundary for the singleton public presentation read model.
pub trait PublicPresentationRepository {
    fn load_public(
        &self,
    ) -> impl Future<Output = Result<PublicPresentation, PublicPresentationReadError>> + Send;
}

pub struct PublicPresentationQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> PublicPresentationQuery<'repository, Repository>
where
    Repository: PublicPresentationRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(&self) -> Result<PublicPresentation, PublicPresentationReadError> {
        self.repository.load_public().await
    }
}

#[cfg(test)]
mod tests {
    use std::future::ready;

    use wicked_learning_domain::platform_presentation::{
        PublicAppearanceThemes, PublicAuthTheme, PublicBranding, PublicPalette, PublicPaletteModes,
        PublicPresentation, PublicPresentationAuth, PublicWelcome,
    };

    use super::{
        PublicPresentationQuery, PublicPresentationReadError, PublicPresentationRepository,
    };

    struct Repository;

    impl PublicPresentationRepository for Repository {
        fn load_public(
            &self,
        ) -> impl std::future::Future<
            Output = Result<PublicPresentation, PublicPresentationReadError>,
        > + Send {
            ready(Ok(presentation()))
        }
    }

    #[tokio::test]
    async fn public_presentation_is_returned_without_an_actor_context() {
        let presentation = PublicPresentationQuery::new(&Repository)
            .execute()
            .await
            .expect("the public presentation is available");

        assert_eq!(presentation.branding.logo, "/images/logo.png");
        assert!(presentation.welcome.pages.is_empty());
    }

    fn presentation() -> PublicPresentation {
        let theme = PublicAuthTheme {
            background_color: "#000000".to_owned(),
            background_image: None,
            background_overlay: "none".to_owned(),
            border_line_color: "transparent".to_owned(),
            button_text_color: "#ffffff".to_owned(),
            input_background: "transparent".to_owned(),
            panel_background: "transparent".to_owned(),
        };
        let palette = PublicPalette {
            accent_text: "#ffffff".to_owned(),
            accent_text_opacity: 100,
            body_text: "#ffffff".to_owned(),
            body_text_opacity: 100,
            control_border: "#ffffff".to_owned(),
            control_border_opacity: 100,
            control_text: "#ffffff".to_owned(),
            control_text_opacity: 100,
            heading_text: "#ffffff".to_owned(),
            heading_text_opacity: 100,
            muted_text: "#ffffff".to_owned(),
            muted_text_opacity: 100,
            welcome_overlay: "#000000".to_owned(),
            welcome_overlay_opacity: 100,
        };

        PublicPresentation {
            branding: PublicBranding {
                logo: "/images/logo.png".to_owned(),
            },
            auth: PublicPresentationAuth {
                login: PublicAppearanceThemes {
                    dark: theme.clone(),
                    light: theme.clone(),
                },
                register: PublicAppearanceThemes {
                    dark: theme.clone(),
                    light: theme.clone(),
                },
                welcome: PublicAppearanceThemes {
                    dark: theme.clone(),
                    light: theme,
                },
            },
            welcome: PublicWelcome { pages: vec![] },
            public_palette: PublicPaletteModes {
                dark: palette.clone(),
                light: palette,
            },
        }
    }
}
