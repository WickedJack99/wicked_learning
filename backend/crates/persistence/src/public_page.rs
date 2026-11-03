use sqlx::{FromRow, PgPool};
use wicked_learning_application::public_page::{
    PublicPageReadError, PublicPageRepository as PublicPageRepositoryPort, PublicPageSlug,
};
use wicked_learning_domain::platform_presentation::PublicPage;

pub struct PostgresPublicPageRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresPublicPageRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl PublicPageRepositoryPort for PostgresPublicPageRepository<'_> {
    fn load_published(
        &self,
        slug: &PublicPageSlug,
    ) -> impl std::future::Future<Output = Result<Option<PublicPage>, PublicPageReadError>> + Send
    {
        async move {
            sqlx::query_as::<_, PublicPageRow>(
                "SELECT slug, title, body FROM public_pages WHERE slug = $1 AND published_at IS NOT NULL LIMIT 1",
            )
            .bind(slug.as_str())
            .fetch_optional(self.pool)
            .await
            .map(|page| {
                page.map(|page| PublicPage {
                    slug: page.slug,
                    title: page.title,
                    body: page.body,
                })
            })
            .map_err(|_| PublicPageReadError)
        }
    }
}

#[derive(FromRow)]
struct PublicPageRow {
    slug: String,
    title: String,
    body: String,
}
