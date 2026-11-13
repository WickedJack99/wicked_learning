use sqlx::{FromRow, PgPool, types::Json};
use uuid::Uuid;
use wicked_learning_application::public_presentation::{
    PublicPresentationReadError, PublicPresentationRepository as PublicPresentationRepositoryPort,
};
use wicked_learning_domain::platform_presentation::PublicPresentation;

const MEDIA_ASSET_CONTENT_PREFIX: &str = "/api/v1/admin/media-assets/";
const MEDIA_ASSET_CONTENT_SUFFIX: &str = "/content";

pub struct PostgresPublicPresentationRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresPublicPresentationRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl PublicPresentationRepositoryPort for PostgresPublicPresentationRepository<'_> {
    fn load_public(
        &self,
    ) -> impl std::future::Future<Output = Result<PublicPresentation, PublicPresentationReadError>> + Send
    {
        async move {
            sqlx::query_as::<_, PublicPresentationRow>(
                "SELECT value FROM public_presentation_settings WHERE key = 'public_presentation' LIMIT 1",
            )
            .fetch_optional(self.pool)
            .await
            .map_err(|_| PublicPresentationReadError)?
            .map(|row| public_presentation(row.value.0))
            .ok_or(PublicPresentationReadError)
        }
    }
}

#[derive(FromRow)]
struct PublicPresentationRow {
    value: Json<PublicPresentation>,
}

fn public_presentation(mut presentation: PublicPresentation) -> PublicPresentation {
    public_media_url(&mut presentation.branding.logo);
    for themes in [
        &mut presentation.auth.login,
        &mut presentation.auth.register,
        &mut presentation.auth.welcome,
    ] {
        public_optional_media_url(&mut themes.dark.background_image);
        public_optional_media_url(&mut themes.light.background_image);
    }
    for page in &mut presentation.welcome.pages {
        public_optional_media_url(&mut page.backgrounds.dark);
        public_optional_media_url(&mut page.backgrounds.light);
    }
    for page in &mut presentation.information_pages {
        public_optional_media_url(&mut page.backgrounds.dark);
        public_optional_media_url(&mut page.backgrounds.light);
    }
    for cursor in [
        presentation.cursors.action.as_mut(),
        presentation.cursors.default.as_mut(),
        presentation.cursors.denied.as_mut(),
        presentation.cursors.grab.as_mut(),
        presentation.cursors.text.as_mut(),
    ]
    .into_iter()
    .flatten()
    {
        public_optional_media_url(&mut cursor.image);
    }
    presentation
}

fn public_optional_media_url(value: &mut Option<String>) {
    if let Some(value) = value {
        public_media_url(value);
    }
}

fn public_media_url(value: &mut String) {
    let Some(asset_id) = value
        .strip_prefix(MEDIA_ASSET_CONTENT_PREFIX)
        .and_then(|value| value.strip_suffix(MEDIA_ASSET_CONTENT_SUFFIX))
        .and_then(|value| Uuid::parse_str(value).ok())
    else {
        return;
    };
    *value = format!("/api/v1/public/media-assets/{asset_id}/content");
}
