use sqlx::{FromRow, PgPool, types::Json};
use wicked_learning_application::public_presentation::{
    PublicPresentationReadError, PublicPresentationRepository as PublicPresentationRepositoryPort,
};
use wicked_learning_domain::platform_presentation::PublicPresentation;

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
            .map(|row| row.value.0)
            .ok_or(PublicPresentationReadError)
        }
    }
}

#[derive(FromRow)]
struct PublicPresentationRow {
    value: Json<PublicPresentation>,
}
