use std::future::Future;

use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    platform_presentation::{
        PublicAppearanceImages, PublicAppearanceThemes, PublicAuthTheme, PublicCursor,
        PublicInformationPage, PublicPalette, PublicPresentation, PublicWelcomePage,
        SettingsPalette,
    },
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminPublicPresentationError;

/// The source's public-presentation workspace is a single, deployment-owned
/// setting. It is deliberately separate from the anonymous projection so
/// editor authorization and raw reusable-media URLs never leak to visitors.
pub trait AdminPublicPresentationRepository {
    fn load(
        &self,
    ) -> impl Future<Output = Result<PublicPresentation, AdminPublicPresentationError>> + Send;

    fn update(
        &self,
        presentation: PublicPresentation,
    ) -> impl Future<Output = Result<PublicPresentation, AdminPublicPresentationError>> + Send;
}

pub struct AdminPublicPresentationQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct UpdateAdminPublicPresentation<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminPublicPresentationQuery<'repository, Repository>
where
    Repository: AdminPublicPresentationRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<PublicPresentation>, AdminPublicPresentationError> {
        if !principal.has_permission("presentation", "ro") {
            return Ok(None);
        }

        self.repository.load().await.map(Some)
    }
}

impl<'repository, Repository> UpdateAdminPublicPresentation<'repository, Repository>
where
    Repository: AdminPublicPresentationRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        presentation: PublicPresentation,
    ) -> Result<Option<PublicPresentation>, AdminPublicPresentationError> {
        if !principal.has_permission("presentation", "ru")
            || !valid_public_presentation(&presentation)
        {
            return Ok(None);
        }

        self.repository.update(presentation).await.map(Some)
    }
}

/// Mirrors the bounded source settings form at the application boundary. The
/// browser is not trusted to constrain JSON values before they reach storage.
pub fn valid_public_presentation(presentation: &PublicPresentation) -> bool {
    bounded(&presentation.branding.logo, 2_048)
        && valid_auth_themes(&presentation.auth.login)
        && valid_auth_themes(&presentation.auth.register)
        && valid_auth_themes(&presentation.auth.welcome)
        && optional_valid_cursor(presentation.cursors.action.as_ref())
        && optional_valid_cursor(presentation.cursors.default.as_ref())
        && optional_valid_cursor(presentation.cursors.denied.as_ref())
        && optional_valid_cursor(presentation.cursors.grab.as_ref())
        && optional_valid_cursor(presentation.cursors.text.as_ref())
        && presentation.welcome.pages.len() <= 12
        && !presentation.welcome.pages.is_empty()
        && presentation.welcome.pages.iter().all(valid_welcome_page)
        && presentation.information_pages.len() <= 24
        && !presentation.information_pages.is_empty()
        && presentation
            .information_pages
            .iter()
            .all(valid_information_page)
        && valid_palette(&presentation.public_palette.dark)
        && valid_palette(&presentation.public_palette.light)
        && valid_settings_palette(&presentation.settings_palette.dark)
        && valid_settings_palette(&presentation.settings_palette.light)
}

fn valid_cursors(cursor: &PublicCursor) -> bool {
    optional_bounded(cursor.image.as_deref(), 2_048)
        && cursor.hotspot_x.is_none_or(|value| value <= 64)
        && cursor.hotspot_y.is_none_or(|value| value <= 64)
        && cursor.size.is_none_or(|value| (16..=128).contains(&value))
        && optional_bounded(cursor.fallback.as_deref(), 32)
}

fn optional_valid_cursor(cursor: Option<&PublicCursor>) -> bool {
    cursor.is_none_or(valid_cursors)
}

fn valid_auth_themes(themes: &PublicAppearanceThemes) -> bool {
    valid_auth_theme(&themes.dark) && valid_auth_theme(&themes.light)
}

fn valid_auth_theme(theme: &PublicAuthTheme) -> bool {
    bounded(&theme.background_color, 128)
        && optional_bounded(theme.background_image.as_deref(), 2_048)
        && bounded(&theme.background_overlay, 2_048)
        && bounded(&theme.border_line_color, 128)
        && bounded(&theme.button_text_color, 128)
        && bounded(&theme.input_background, 256)
        && bounded(&theme.panel_background, 256)
}

fn valid_welcome_page(page: &PublicWelcomePage) -> bool {
    valid_images(&page.backgrounds)
        && bounded(&page.body, 1_200)
        && bounded(&page.eyebrow, 120)
        && bounded(&page.title, 160)
        && page.buttons.len() <= 6
        && page
            .buttons
            .iter()
            .all(|button| bounded(&button.target, 2_048) && bounded(&button.text, 80))
}

fn valid_information_page(page: &PublicInformationPage) -> bool {
    valid_images(&page.backgrounds)
        && valid_information_slug(&page.slug)
        && !page.title.is_empty()
        && bounded(&page.title, 120)
        && !page.body.is_empty()
        && bounded(&page.body, 50_000)
}

fn valid_information_slug(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 80
        && value.bytes().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == b'-'
        })
}

fn valid_images(images: &PublicAppearanceImages) -> bool {
    optional_bounded(images.dark.as_deref(), 2_048)
        && optional_bounded(images.light.as_deref(), 2_048)
}

fn valid_palette(palette: &PublicPalette) -> bool {
    [
        &palette.accent_text,
        &palette.body_text,
        &palette.control_border,
        &palette.control_text,
        &palette.heading_text,
        &palette.muted_text,
        &palette.welcome_overlay,
    ]
    .into_iter()
    .all(|value| bounded(value, 64))
        && [
            palette.accent_text_opacity,
            palette.body_text_opacity,
            palette.control_border_opacity,
            palette.control_text_opacity,
            palette.heading_text_opacity,
            palette.muted_text_opacity,
            palette.welcome_overlay_opacity,
        ]
        .into_iter()
        .all(|value| value <= 100)
}

fn valid_settings_palette(palette: &SettingsPalette) -> bool {
    [
        &palette.accent,
        &palette.accent_foreground,
        &palette.active_background,
        &palette.appearance_switch_background,
        &palette.appearance_switch_active_background,
        &palette.appearance_switch_active_text,
        &palette.appearance_switch_inactive_text,
        &palette.sidebar_background,
        &palette.content_background,
        &palette.input_background,
        &palette.input_border_color,
        &palette.panel_background,
        &palette.border_color,
        &palette.muted_text,
        &palette.nested_sidebar_background,
        &palette.scrollbar_thumb,
    ]
    .into_iter()
    .all(|value| bounded(value, 64))
        && [
            palette.accent_opacity,
            palette.accent_foreground_opacity,
            palette.active_background_opacity,
            palette.appearance_switch_background_opacity,
            palette.appearance_switch_active_background_opacity,
            palette.appearance_switch_active_text_opacity,
            palette.appearance_switch_inactive_text_opacity,
            palette.sidebar_background_opacity,
            palette.content_background_opacity,
            palette.input_background_opacity,
            palette.input_border_color_opacity,
            palette.panel_background_opacity,
            palette.border_color_opacity,
            palette.muted_text_opacity,
            palette.nested_sidebar_background_opacity,
            palette.scrollbar_thumb_opacity,
        ]
        .into_iter()
        .all(|value| value <= 100)
}

fn bounded(value: &str, maximum: usize) -> bool {
    value.chars().count() <= maximum
}

fn optional_bounded(value: Option<&str>, maximum: usize) -> bool {
    value.is_none_or(|value| bounded(value, maximum))
}

#[cfg(test)]
mod tests {
    use std::future::ready;

    use uuid::Uuid;
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal,
        platform_presentation::{
            PublicAppearanceThemes, PublicAuthTheme, PublicBranding, PublicCursors, PublicPalette,
            PublicPaletteModes, PublicPresentation, PublicPresentationAuth, PublicWelcome,
        },
    };

    use super::{
        AdminPublicPresentationError, AdminPublicPresentationQuery,
        AdminPublicPresentationRepository, UpdateAdminPublicPresentation,
    };

    struct Repository;

    impl AdminPublicPresentationRepository for Repository {
        fn load(
            &self,
        ) -> impl std::future::Future<
            Output = Result<PublicPresentation, AdminPublicPresentationError>,
        > + Send {
            ready(Ok(presentation()))
        }

        fn update(
            &self,
            _: PublicPresentation,
        ) -> impl std::future::Future<
            Output = Result<PublicPresentation, AdminPublicPresentationError>,
        > + Send {
            ready(Ok(presentation()))
        }
    }

    #[tokio::test]
    async fn presentation_workspace_requires_the_source_presentation_permission() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec![],
        };

        assert!(
            AdminPublicPresentationQuery::new(&Repository)
                .execute(&principal)
                .await
                .unwrap()
                .is_none()
        );
        assert!(
            UpdateAdminPublicPresentation::new(&Repository)
                .execute(&principal, presentation())
                .await
                .unwrap()
                .is_none()
        );
    }

    #[tokio::test]
    async fn public_presentation_rejects_unbounded_welcome_copy_before_writing() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:presentation:ru:all".to_owned()],
        };
        let mut invalid = presentation();
        invalid.welcome.pages[0].body = "x".repeat(1_201);

        assert!(
            UpdateAdminPublicPresentation::new(&Repository)
                .execute(&principal, invalid)
                .await
                .unwrap()
                .is_none()
        );
    }

    #[tokio::test]
    async fn public_presentation_rejects_an_out_of_range_cursor_size_before_writing() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:presentation:ru:all".to_owned()],
        };
        let mut invalid = presentation();
        invalid
            .cursors
            .action
            .as_mut()
            .expect("the source default action cursor exists")
            .size = Some(15);

        assert!(
            UpdateAdminPublicPresentation::new(&Repository)
                .execute(&principal, invalid)
                .await
                .unwrap()
                .is_none()
        );
    }

    #[tokio::test]
    async fn public_presentation_rejects_an_unbounded_settings_palette_value_before_writing() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:presentation:ru:all".to_owned()],
        };
        let mut invalid = presentation();
        invalid.settings_palette.dark.accent = "#".to_owned() + &"f".repeat(64);

        assert!(
            UpdateAdminPublicPresentation::new(&Repository)
                .execute(&principal, invalid)
                .await
                .unwrap()
                .is_none()
        );
    }

    #[tokio::test]
    async fn public_presentation_rejects_an_unbounded_information_page_before_writing() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:presentation:ru:all".to_owned()],
        };
        let mut invalid = presentation();
        invalid.information_pages = vec![
            wicked_learning_domain::platform_presentation::PublicInformationPage {
                backgrounds:
                    wicked_learning_domain::platform_presentation::PublicAppearanceImages {
                        dark: None,
                        light: None,
                    },
                body: "x".repeat(50_001),
                slug: "custom".to_owned(),
                title: "Custom".to_owned(),
            },
        ];

        assert!(
            UpdateAdminPublicPresentation::new(&Repository)
                .execute(&principal, invalid)
                .await
                .unwrap()
                .is_none()
        );
    }

    #[tokio::test]
    async fn public_presentation_requires_one_information_page_before_writing() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:presentation:ru:all".to_owned()],
        };
        let mut invalid = presentation();
        invalid.information_pages = vec![];

        assert!(
            UpdateAdminPublicPresentation::new(&Repository)
                .execute(&principal, invalid)
                .await
                .unwrap()
                .is_none()
        );
    }

    fn presentation() -> PublicPresentation {
        let theme = PublicAuthTheme {
            background_color: "#000".to_owned(),
            background_image: None,
            background_overlay: "none".to_owned(),
            border_line_color: "transparent".to_owned(),
            button_text_color: "#fff".to_owned(),
            input_background: "transparent".to_owned(),
            panel_background: "transparent".to_owned(),
        };
        let palette = PublicPalette {
            accent_text: "#fff".to_owned(),
            accent_text_opacity: 100,
            body_text: "#fff".to_owned(),
            body_text_opacity: 100,
            control_border: "#fff".to_owned(),
            control_border_opacity: 100,
            control_text: "#fff".to_owned(),
            control_text_opacity: 100,
            heading_text: "#fff".to_owned(),
            heading_text_opacity: 100,
            muted_text: "#fff".to_owned(),
            muted_text_opacity: 100,
            welcome_overlay: "#000".to_owned(),
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
            cursors: PublicCursors::default(),
            welcome: PublicWelcome {
                pages: vec![
                    wicked_learning_domain::platform_presentation::PublicWelcomePage {
                        backgrounds:
                            wicked_learning_domain::platform_presentation::PublicAppearanceImages {
                                dark: None,
                                light: None,
                            },
                        body: "A public welcome page.".to_owned(),
                        buttons: vec![],
                        eyebrow: "Welcome".to_owned(),
                        title: "Wicked Learning".to_owned(),
                    },
                ],
            },
            information_pages: vec![],
            public_palette: PublicPaletteModes {
                dark: palette.clone(),
                light: palette,
            },
            settings_palette: Default::default(),
        }
    }
}
