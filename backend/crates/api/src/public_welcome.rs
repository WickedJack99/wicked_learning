use axum::{Json, extract::State};
use axum_login::AuthSession;
use serde::Serialize;
use uuid::Uuid;
use wicked_learning_application::{
    current_user::CurrentUserQuery, public_presentation::PublicPresentationQuery,
};
use wicked_learning_domain::platform_presentation::PublicPresentation;
use wicked_learning_persistence::{
    current_user::PostgresCurrentUserRepository,
    public_presentation::PostgresPublicPresentationRepository,
};

use crate::{AppState, error::ApiError, identity::IdentityBackend};

/// The small source-page document consumed only by the canonical Welcome
/// route. It intentionally exposes an authenticated marker, rather than an
/// account/profile projection, because the source page only branches on
/// `auth.user` truthiness.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WelcomeProjectionResponse {
    auth: WelcomeAuth,
    appearance: String,
    public_presentation: PublicPresentation,
}

#[derive(Serialize)]
pub struct WelcomeAuth {
    user: Option<WelcomeUser>,
}

#[derive(Serialize)]
pub struct WelcomeUser {
    id: Uuid,
}

pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<WelcomeProjectionResponse>, ApiError> {
    let presentation_repository =
        PostgresPublicPresentationRepository::new(&state.application_database);
    let public_presentation = PublicPresentationQuery::new(&presentation_repository)
        .execute()
        .await
        .map_err(|_| ApiError::service_unavailable())?;

    let (user, appearance) = match auth_session.user {
        Some(subject) => {
            let subject_id = subject.subject_id();
            let current_user_repository =
                PostgresCurrentUserRepository::new(&state.application_database);
            let current_user = CurrentUserQuery::new(&current_user_repository)
                .execute(subject_id)
                .await
                .map_err(|_| ApiError::service_unavailable())?
                .ok_or_else(ApiError::forbidden)?;

            (
                Some(WelcomeUser { id: subject_id }),
                current_user.appearance.as_str().to_owned(),
            )
        }
        None => (None, "system".to_owned()),
    };

    Ok(Json(WelcomeProjectionResponse {
        auth: WelcomeAuth { user },
        appearance,
        public_presentation,
    }))
}

#[cfg(test)]
mod tests {
    use wicked_learning_domain::{
        learner_state::LearnerAppearance,
        platform_presentation::{
            PublicAppearanceThemes, PublicAuthTheme, PublicBranding, PublicCursors, PublicPalette,
            PublicPaletteModes, PublicPresentation, PublicPresentationAuth, PublicWelcome,
        },
    };

    use super::{WelcomeAuth, WelcomeProjectionResponse, WelcomeUser};

    #[test]
    fn guest_projection_exposes_only_the_source_guest_appearance_and_no_user() {
        let response = WelcomeProjectionResponse {
            auth: WelcomeAuth { user: None },
            appearance: "system".to_owned(),
            public_presentation: presentation(),
        };

        let value = serde_json::to_value(response).expect("projection is serializable");

        assert_eq!(value["appearance"], "system");
        assert!(value["auth"]["user"].is_null());
        assert!(value.get("roles").is_none());
        assert!(value.get("capabilities").is_none());
    }

    #[test]
    fn authenticated_projection_keeps_the_real_subject_marker_and_resolved_preference() {
        let subject_id = uuid::Uuid::new_v4();
        let response = WelcomeProjectionResponse {
            auth: WelcomeAuth {
                user: Some(WelcomeUser { id: subject_id }),
            },
            appearance: LearnerAppearance::Dark.as_str().to_owned(),
            public_presentation: presentation(),
        };

        let value = serde_json::to_value(response).expect("projection is serializable");

        assert_eq!(value["appearance"], "dark");
        assert_eq!(value["auth"]["user"]["id"], subject_id.to_string());
        assert!(value.get("settingsAccess").is_none());
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
            cursors: PublicCursors::default(),
            welcome: PublicWelcome { pages: vec![] },
            information_pages: vec![],
            public_palette: PublicPaletteModes {
                dark: palette.clone(),
                light: palette,
            },
            settings_palette: Default::default(),
        }
    }
}
