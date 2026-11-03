use sqlx::{FromRow, PgPool};
use wicked_learning_application::public_source_links::{
    PublicSourceLinksReadError, PublicSourceLinksRepository as PublicSourceLinksRepositoryPort,
};
use wicked_learning_domain::platform_presentation::{PublicSourceLink, PublicSourceLinks};

pub struct PostgresPublicSourceLinksRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresPublicSourceLinksRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl PublicSourceLinksRepositoryPort for PostgresPublicSourceLinksRepository<'_> {
    fn load_public(
        &self,
    ) -> impl std::future::Future<Output = Result<PublicSourceLinks, PublicSourceLinksReadError>> + Send
    {
        async move {
            let links = sqlx::query_as::<_, PublicSourceLinkRow>(
                "SELECT label, url, is_origin FROM public_source_links ORDER BY position ASC",
            )
            .fetch_all(self.pool)
            .await
            .map_err(|_| PublicSourceLinksReadError)?;

            let mut origin = None;
            let mut modified_sources = Vec::new();
            for link in links {
                let is_origin = link.is_origin;
                let link = PublicSourceLink {
                    label: link.label,
                    url: link.url,
                };
                if is_origin {
                    origin = Some(link);
                } else {
                    modified_sources.push(link);
                }
            }

            Ok(PublicSourceLinks {
                origin: origin.ok_or(PublicSourceLinksReadError)?,
                modified_sources,
            })
        }
    }
}

#[derive(FromRow)]
struct PublicSourceLinkRow {
    label: String,
    url: String,
    is_origin: bool,
}
