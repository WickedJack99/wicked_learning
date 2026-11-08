use sqlx::{FromRow, PgPool};
use wicked_learning_application::{
    admin_public_content::{AdminPublicContentError, AdminPublicContentRepository as Port},
    public_page::PublicPageSlug,
};
use wicked_learning_domain::platform_presentation::{
    PublicPage, PublicSourceLink, PublicSourceLinks,
};

pub struct PostgresAdminPublicContentRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminPublicContentRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminPublicContentRepository<'_> {
    fn load_pages(
        &self,
    ) -> impl std::future::Future<Output = Result<Vec<PublicPage>, AdminPublicContentError>> + Send
    {
        async move {
            sqlx::query_as::<_, PublicPageRow>(
                "SELECT slug, title, body FROM public_pages WHERE slug = ANY($1) ORDER BY array_position($1, slug)",
            )
            .bind(vec!["about", "imprint", "data-protection"])
            .fetch_all(self.pool)
            .await
            .map(|rows| rows.into_iter().map(Into::into).collect())
            .map_err(|_| AdminPublicContentError)
        }
    }

    fn update_page(
        &self,
        slug: &PublicPageSlug,
        body: String,
    ) -> impl std::future::Future<Output = Result<Option<PublicPage>, AdminPublicContentError>> + Send
    {
        async move {
            sqlx::query_as::<_, PublicPageRow>(
                "UPDATE public_pages SET body = $2, updated_at = NOW() WHERE slug = $1 RETURNING slug, title, body",
            )
            .bind(slug.as_str())
            .bind(body)
            .fetch_optional(self.pool)
            .await
            .map(|page| page.map(Into::into))
            .map_err(|_| AdminPublicContentError)
        }
    }

    fn load_source_links(
        &self,
    ) -> impl std::future::Future<Output = Result<PublicSourceLinks, AdminPublicContentError>> + Send
    {
        async move {
            let rows = sqlx::query_as::<_, PublicSourceLinkRow>(
                "SELECT label, url, is_origin FROM public_source_links ORDER BY position ASC",
            )
            .fetch_all(self.pool)
            .await
            .map_err(|_| AdminPublicContentError)?;
            source_links(rows).ok_or(AdminPublicContentError)
        }
    }

    fn replace_source_links(
        &self,
        links: PublicSourceLinks,
    ) -> impl std::future::Future<Output = Result<PublicSourceLinks, AdminPublicContentError>> + Send
    {
        async move {
            let mut transaction = self
                .pool
                .begin()
                .await
                .map_err(|_| AdminPublicContentError)?;
            sqlx::query("DELETE FROM public_source_links")
                .execute(&mut *transaction)
                .await
                .map_err(|_| AdminPublicContentError)?;
            for (position, link, is_origin) in source_link_rows(&links) {
                sqlx::query(
                    "INSERT INTO public_source_links (position, label, url, is_origin) VALUES ($1, $2, $3, $4)",
                )
                .bind(position)
                .bind(&link.label)
                .bind(&link.url)
                .bind(is_origin)
                .execute(&mut *transaction)
                .await
                .map_err(|_| AdminPublicContentError)?;
            }
            transaction
                .commit()
                .await
                .map_err(|_| AdminPublicContentError)?;
            Ok(links)
        }
    }
}

#[derive(FromRow)]
struct PublicPageRow {
    slug: String,
    title: String,
    body: String,
}

impl From<PublicPageRow> for PublicPage {
    fn from(page: PublicPageRow) -> Self {
        Self {
            slug: page.slug,
            title: page.title,
            body: page.body,
        }
    }
}

#[derive(FromRow)]
struct PublicSourceLinkRow {
    label: String,
    url: String,
    is_origin: bool,
}

fn source_links(rows: Vec<PublicSourceLinkRow>) -> Option<PublicSourceLinks> {
    let mut origin = None;
    let mut modified_sources = Vec::new();
    for row in rows {
        let link = PublicSourceLink {
            label: row.label,
            url: row.url,
        };
        if row.is_origin {
            origin = Some(link);
        } else {
            modified_sources.push(link);
        }
    }

    origin.map(|origin| PublicSourceLinks {
        origin,
        modified_sources,
    })
}

fn source_link_rows(links: &PublicSourceLinks) -> Vec<(i16, &PublicSourceLink, bool)> {
    let mut rows = Vec::with_capacity(links.modified_sources.len() + 1);
    rows.push((0, &links.origin, true));
    rows.extend(
        links
            .modified_sources
            .iter()
            .enumerate()
            .map(|(index, link)| ((index + 1) as i16, link, false)),
    );
    rows
}

#[cfg(test)]
mod tests {
    use wicked_learning_domain::platform_presentation::{PublicSourceLink, PublicSourceLinks};

    use super::source_link_rows;

    #[test]
    fn preserves_the_source_origin_then_modified_link_order() {
        let links = PublicSourceLinks {
            origin: PublicSourceLink {
                label: "Original".to_owned(),
                url: "https://example.test/original".to_owned(),
            },
            modified_sources: vec![PublicSourceLink {
                label: "Deployment".to_owned(),
                url: "https://example.test/deployment".to_owned(),
            }],
        };

        assert_eq!(
            source_link_rows(&links)
                .into_iter()
                .map(|(position, link, is_origin)| (position, link.label.as_str(), is_origin))
                .collect::<Vec<_>>(),
            vec![(0, "Original", true), (1, "Deployment", false)]
        );
    }
}
