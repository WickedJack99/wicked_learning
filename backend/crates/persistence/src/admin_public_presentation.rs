use sqlx::{PgPool, Postgres, Transaction, types::Json};
use uuid::Uuid;
use wicked_learning_application::admin_public_presentation::{
    AdminPublicPresentationError, AdminPublicPresentationRepository as Port,
};
use wicked_learning_domain::platform_presentation::PublicPresentation;

const MEDIA_ASSET_CONTENT_PREFIX: &str = "/api/v1/admin/media-assets/";
const MEDIA_ASSET_CONTENT_SUFFIX: &str = "/content";
const MEDIA_OWNER_KIND: &str = "public_presentation";
const MEDIA_OWNER_ID: Uuid = Uuid::from_u128(0x5b2fed81_70dd_4a74_9f55_814a263e8d74);

pub struct PostgresAdminPublicPresentationRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminPublicPresentationRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminPublicPresentationRepository<'_> {
    fn load(
        &self,
    ) -> impl std::future::Future<Output = Result<PublicPresentation, AdminPublicPresentationError>> + Send
    {
        async move {
            sqlx::query_scalar::<_, Json<PublicPresentation>>(
                "SELECT value FROM public_presentation_settings WHERE key = 'public_presentation' LIMIT 1",
            )
            .fetch_optional(self.pool)
            .await
            .map_err(|_| AdminPublicPresentationError)?
            .map(|value| value.0)
            .ok_or(AdminPublicPresentationError)
        }
    }

    fn update(
        &self,
        presentation: PublicPresentation,
    ) -> impl std::future::Future<Output = Result<PublicPresentation, AdminPublicPresentationError>> + Send
    {
        async move {
            let mut transaction = self
                .pool
                .begin()
                .await
                .map_err(|_| AdminPublicPresentationError)?;
            let updated = sqlx::query_scalar::<_, Json<PublicPresentation>>(
                "UPDATE public_presentation_settings SET value = $1, updated_at = NOW() WHERE key = 'public_presentation' RETURNING value",
            )
            .bind(Json(&presentation))
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|_| AdminPublicPresentationError)?
            .map(|value| value.0)
            .ok_or(AdminPublicPresentationError)?;
            synchronize_media_references(&mut transaction, &updated)
                .await
                .map_err(|_| AdminPublicPresentationError)?;
            transaction
                .commit()
                .await
                .map_err(|_| AdminPublicPresentationError)?;
            Ok(updated)
        }
    }
}

fn media_references(presentation: &PublicPresentation) -> Vec<(Uuid, String)> {
    let mut references = Vec::new();
    push_reference(
        &mut references,
        &presentation.branding.logo,
        "branding.logo".to_owned(),
    );
    for (page, themes) in [
        ("login", &presentation.auth.login),
        ("register", &presentation.auth.register),
        ("welcome", &presentation.auth.welcome),
    ] {
        push_optional_reference(
            &mut references,
            themes.dark.background_image.as_deref(),
            format!("auth.{page}.dark.background_image"),
        );
        push_optional_reference(
            &mut references,
            themes.light.background_image.as_deref(),
            format!("auth.{page}.light.background_image"),
        );
    }
    for (index, page) in presentation.welcome.pages.iter().enumerate() {
        push_optional_reference(
            &mut references,
            page.backgrounds.dark.as_deref(),
            format!("welcome.pages.{index}.backgrounds.dark"),
        );
        push_optional_reference(
            &mut references,
            page.backgrounds.light.as_deref(),
            format!("welcome.pages.{index}.backgrounds.light"),
        );
    }
    for (index, page) in presentation.information_pages.iter().enumerate() {
        push_optional_reference(
            &mut references,
            page.backgrounds.dark.as_deref(),
            format!("information_pages.{index}.backgrounds.dark"),
        );
        push_optional_reference(
            &mut references,
            page.backgrounds.light.as_deref(),
            format!("information_pages.{index}.backgrounds.light"),
        );
    }
    for (role, cursor) in [
        ("action", presentation.cursors.action.as_ref()),
        ("default", presentation.cursors.default.as_ref()),
        ("denied", presentation.cursors.denied.as_ref()),
        ("grab", presentation.cursors.grab.as_ref()),
        ("text", presentation.cursors.text.as_ref()),
    ] {
        push_optional_reference(
            &mut references,
            cursor.and_then(|cursor| cursor.image.as_deref()),
            format!("cursors.{role}.image"),
        );
    }
    references
}

fn push_optional_reference(
    references: &mut Vec<(Uuid, String)>,
    value: Option<&str>,
    field: String,
) {
    if let Some(value) = value {
        push_reference(references, value, field);
    }
}

fn push_reference(references: &mut Vec<(Uuid, String)>, value: &str, field: String) {
    if let Some(id) = media_asset_id(value) {
        references.push((id, field));
    }
}

fn media_asset_id(value: &str) -> Option<Uuid> {
    value
        .strip_prefix(MEDIA_ASSET_CONTENT_PREFIX)?
        .strip_suffix(MEDIA_ASSET_CONTENT_SUFFIX)
        .and_then(|value| Uuid::parse_str(value).ok())
}

async fn synchronize_media_references(
    transaction: &mut Transaction<'_, Postgres>,
    presentation: &PublicPresentation,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM reusable_media_asset_references WHERE owner_kind = $1 AND owner_id = $2",
    )
    .bind(MEDIA_OWNER_KIND)
    .bind(MEDIA_OWNER_ID)
    .execute(&mut **transaction)
    .await?;
    for (asset_id, field_key) in media_references(presentation) {
        sqlx::query("INSERT INTO reusable_media_asset_references (asset_id, owner_kind, owner_id, field_key) SELECT id, $2, $3, $4 FROM reusable_media_assets WHERE id = $1 ON CONFLICT DO NOTHING")
            .bind(asset_id)
            .bind(MEDIA_OWNER_KIND)
            .bind(MEDIA_OWNER_ID)
            .bind(field_key)
            .execute(&mut **transaction)
            .await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;
    use wicked_learning_domain::platform_presentation::{
        PublicAppearanceImages, PublicAppearanceThemes, PublicAuthTheme, PublicBranding,
        PublicCursors, PublicPalette, PublicPaletteModes, PublicPresentation,
        PublicPresentationAuth, PublicWelcome, PublicWelcomePage,
    };

    use super::media_references;

    #[test]
    fn tracks_only_canonical_reusable_visual_urls() {
        let logo = Uuid::new_v4();
        let cursor = Uuid::new_v4();
        let mut presentation = presentation(&format!("/api/v1/admin/media-assets/{logo}/content"));
        presentation
            .cursors
            .action
            .as_mut()
            .expect("the source action role exists")
            .image = Some(format!("/api/v1/admin/media-assets/{cursor}/content"));

        assert_eq!(
            media_references(&presentation),
            vec![
                (logo, "branding.logo".to_owned()),
                (cursor, "cursors.action.image".to_owned()),
            ]
        );
    }

    fn presentation(logo: &str) -> PublicPresentation {
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
                logo: logo.to_owned(),
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
                pages: vec![PublicWelcomePage {
                    backgrounds: PublicAppearanceImages {
                        dark: None,
                        light: None,
                    },
                    body: "Body".to_owned(),
                    buttons: vec![],
                    eyebrow: "Eyebrow".to_owned(),
                    title: "Title".to_owned(),
                }],
            },
            information_pages: vec![],
            public_palette: PublicPaletteModes {
                dark: palette.clone(),
                light: palette,
            },
        }
    }
}
