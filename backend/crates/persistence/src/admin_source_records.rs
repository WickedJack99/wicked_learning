use sqlx::{FromRow, PgPool, Postgres, Transaction, types::Json};
use uuid::Uuid;
use wicked_learning_application::admin_source_records::{
    AdminSourceRecordsError, AdminSourceRecordsRepository as Port, SourceRecordForm,
    SourceRecordPageRequest, SourceRecordVersionPageRequest,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    world_content::{
        AdminSourceRecord, AdminSourceRecordPage, AdminSourceRecordPagination,
        AdminSourceRecordVersion, AdminSourceRecordVersionPage, AdminSourceRecordVersionPagination,
    },
};

pub struct PostgresAdminSourceRecordsRepository<'pool> {
    pool: &'pool PgPool,
}
impl<'pool> PostgresAdminSourceRecordsRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminSourceRecordsRepository<'_> {
    fn list(
        &self,
        _principal: &AuthorizedPrincipal,
        page: SourceRecordPageRequest,
        search: Option<&str>,
        concept: Option<&str>,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminSourceRecordPage>, AdminSourceRecordsError>,
    > + Send {
        async move {
            list(self.pool, page, search, concept)
                .await
                .map(Some)
                .map_err(unavailable)
        }
    }
    fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &SourceRecordForm,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminSourceRecord>, AdminSourceRecordsError>,
    > + Send {
        async move {
            create(self.pool, principal, form)
                .await
                .map_err(unavailable)
        }
    }
    fn update(
        &self,
        principal: &AuthorizedPrincipal,
        source_id: Uuid,
        form: &SourceRecordForm,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminSourceRecord>, AdminSourceRecordsError>,
    > + Send {
        async move {
            update(self.pool, principal, source_id, form)
                .await
                .map_err(unavailable)
        }
    }
    fn versions(
        &self,
        _principal: &AuthorizedPrincipal,
        source_id: Uuid,
        page: SourceRecordVersionPageRequest,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminSourceRecordVersionPage>, AdminSourceRecordsError>,
    > + Send {
        async move {
            versions(self.pool, source_id, page)
                .await
                .map_err(unavailable)
        }
    }
    fn restore(
        &self,
        principal: &AuthorizedPrincipal,
        source_id: Uuid,
        version_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminSourceRecord>, AdminSourceRecordsError>,
    > + Send {
        async move {
            restore(self.pool, principal, source_id, version_id)
                .await
                .map_err(unavailable)
        }
    }
    fn delete(
        &self,
        _principal: &AuthorizedPrincipal,
        source_id: Uuid,
    ) -> impl std::future::Future<Output = Result<bool, AdminSourceRecordsError>> + Send {
        async move { delete(self.pool, source_id).await.map_err(unavailable) }
    }
}

fn unavailable(error: sqlx::Error) -> AdminSourceRecordsError {
    tracing::error!(%error, "could not load or mutate reusable source records");
    AdminSourceRecordsError::Unavailable
}

#[derive(FromRow)]
struct SourceRow {
    id: Uuid,
    anchor: Option<String>,
    concepts: Json<Vec<String>>,
    excerpt: Option<String>,
    published_at: Option<String>,
    publisher: Option<String>,
    rights: Option<String>,
    title: String,
    url: String,
}
#[derive(FromRow)]
struct VersionRow {
    id: Uuid,
    created_at: String,
    source_id: Uuid,
    anchor: Option<String>,
    concepts: Json<Vec<String>>,
    excerpt: Option<String>,
    published_at: Option<String>,
    publisher: Option<String>,
    rights: Option<String>,
    title: String,
    url: String,
}

const SOURCE_COLUMNS: &str = "id, anchor, concepts, excerpt, to_char(published_at, 'YYYY-MM-DD') AS published_at, publisher, rights, title, url";
const VERSION_SOURCE_COLUMNS: &str = "id, anchor, concepts, excerpt, to_char(published_at, 'YYYY-MM-DD') AS published_at, publisher, rights, title, url";

fn source(row: SourceRow) -> AdminSourceRecord {
    AdminSourceRecord {
        id: row.id,
        anchor: row.anchor,
        concepts: row.concepts.0,
        excerpt: row.excerpt,
        published_at: row.published_at,
        publisher: row.publisher,
        rights: row.rights,
        title: row.title,
        url: row.url,
    }
}

async fn list(
    pool: &PgPool,
    page: SourceRecordPageRequest,
    search: Option<&str>,
    concept: Option<&str>,
) -> Result<AdminSourceRecordPage, sqlx::Error> {
    let search = search.map(str::trim).filter(|value| !value.is_empty());
    let concept = concept.map(str::trim).filter(|value| !value.is_empty());
    let predicate = "WHERE ($1::text IS NULL OR title ILIKE '%' || $1 || '%' OR url ILIKE '%' || $1 || '%' OR publisher ILIKE '%' || $1 || '%' OR anchor ILIKE '%' || $1 || '%' OR excerpt ILIKE '%' || $1 || '%' OR concepts @> jsonb_build_array($1)) AND ($2::text IS NULL OR concepts @> jsonb_build_array($2))";
    let count_sql = format!("SELECT COUNT(*) FROM learning_source_records {predicate}");
    let total: i64 = sqlx::query_scalar(&count_sql)
        .bind(search)
        .bind(concept)
        .fetch_one(pool)
        .await?;
    let rows_sql = format!(
        "SELECT {SOURCE_COLUMNS} FROM learning_source_records {predicate} ORDER BY title ASC, id ASC LIMIT $3 OFFSET $4"
    );
    let rows: Vec<SourceRow> = sqlx::query_as(&rows_sql)
        .bind(search)
        .bind(concept)
        .bind(page.per_page)
        .bind((page.page - 1) * page.per_page)
        .fetch_all(pool)
        .await?;
    Ok(AdminSourceRecordPage {
        items: rows.into_iter().map(source).collect(),
        pagination: AdminSourceRecordPagination {
            current_page: page.page,
            per_page: page.per_page,
            total,
            last_page: ((total + page.per_page - 1) / page.per_page).max(1),
        },
    })
}

async fn create(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    form: &SourceRecordForm,
) -> Result<Option<AdminSourceRecord>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let created_by = application_principal_id(&mut transaction, principal).await?;
    let existing_sql = format!(
        "SELECT {SOURCE_COLUMNS} FROM learning_source_records WHERE anchor IS NOT DISTINCT FROM $1 AND excerpt IS NOT DISTINCT FROM $2 AND published_at IS NOT DISTINCT FROM $3::date AND publisher IS NOT DISTINCT FROM $4 AND rights IS NOT DISTINCT FROM $5 AND title = $6 AND url = $7 LIMIT 1"
    );
    if let Some(row) = sqlx::query_as::<_, SourceRow>(&existing_sql)
        .bind(&form.anchor)
        .bind(&form.excerpt)
        .bind(&form.published_at)
        .bind(&form.publisher)
        .bind(&form.rights)
        .bind(&form.title)
        .bind(&form.url)
        .fetch_optional(&mut *transaction)
        .await?
    {
        transaction.commit().await?;
        return Ok(Some(source(row)));
    }
    let insert_sql = format!(
        "INSERT INTO learning_source_records (id, created_by_principal_id, title, url, publisher, published_at, rights, anchor, excerpt, concepts) VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10) RETURNING {SOURCE_COLUMNS}"
    );
    let row = sqlx::query_as::<_, SourceRow>(&insert_sql)
        .bind(Uuid::new_v4())
        .bind(created_by)
        .bind(&form.title)
        .bind(&form.url)
        .bind(&form.publisher)
        .bind(&form.published_at)
        .bind(&form.rights)
        .bind(&form.anchor)
        .bind(&form.excerpt)
        .bind(Json(&form.concepts))
        .fetch_one(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(Some(source(row)))
}

async fn update(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    source_id: Uuid,
    form: &SourceRecordForm,
) -> Result<Option<AdminSourceRecord>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = application_principal_id(&mut transaction, principal).await? else {
        return Ok(None);
    };
    let Some(current) = locked_source(&mut transaction, source_id).await? else {
        return Ok(None);
    };
    record_version(&mut transaction, &current, principal_id).await?;
    let update_sql = format!(
        "UPDATE learning_source_records SET title = $2, url = $3, publisher = $4, published_at = $5::date, rights = $6, anchor = $7, excerpt = $8, concepts = $9, updated_at = NOW() WHERE id = $1 RETURNING {SOURCE_COLUMNS}"
    );
    let row = sqlx::query_as::<_, SourceRow>(&update_sql)
        .bind(source_id)
        .bind(&form.title)
        .bind(&form.url)
        .bind(&form.publisher)
        .bind(&form.published_at)
        .bind(&form.rights)
        .bind(&form.anchor)
        .bind(&form.excerpt)
        .bind(Json(&form.concepts))
        .fetch_one(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(Some(source(row)))
}

async fn versions(
    pool: &PgPool,
    source_id: Uuid,
    page: SourceRecordVersionPageRequest,
) -> Result<Option<AdminSourceRecordVersionPage>, sqlx::Error> {
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_source_records WHERE id = $1)")
            .bind(source_id)
            .fetch_one(pool)
            .await?;
    if !exists {
        return Ok(None);
    }
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM learning_source_record_versions WHERE source_record_id = $1",
    )
    .bind(source_id)
    .fetch_one(pool)
    .await?;
    let sql = format!(
        "SELECT id, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\\\"T\\\"HH24:MI:SS.US\\\"Z\\\"') AS created_at, source_record_id AS source_id, anchor, concepts, excerpt, to_char(published_at, 'YYYY-MM-DD') AS published_at, publisher, rights, title, url FROM learning_source_record_versions WHERE source_record_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3"
    );
    let rows: Vec<VersionRow> = sqlx::query_as(&sql)
        .bind(source_id)
        .bind(page.per_page)
        .bind((page.page - 1) * page.per_page)
        .fetch_all(pool)
        .await?;
    Ok(Some(AdminSourceRecordVersionPage {
        items: rows
            .into_iter()
            .map(|row| AdminSourceRecordVersion {
                id: row.id,
                created_at: row.created_at,
                source_record: AdminSourceRecord {
                    id: row.source_id,
                    anchor: row.anchor,
                    concepts: row.concepts.0,
                    excerpt: row.excerpt,
                    published_at: row.published_at,
                    publisher: row.publisher,
                    rights: row.rights,
                    title: row.title,
                    url: row.url,
                },
            })
            .collect(),
        pagination: AdminSourceRecordVersionPagination {
            page: page.page,
            per_page: page.per_page,
            total,
            last_page: ((total + page.per_page - 1) / page.per_page).max(1),
        },
    }))
}

async fn restore(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    source_id: Uuid,
    version_id: Uuid,
) -> Result<Option<AdminSourceRecord>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = application_principal_id(&mut transaction, principal).await? else {
        return Ok(None);
    };
    let Some(current) = locked_source(&mut transaction, source_id).await? else {
        return Ok(None);
    };
    let version_sql = format!(
        "SELECT {VERSION_SOURCE_COLUMNS} FROM learning_source_record_versions WHERE id = $1 AND source_record_id = $2 FOR UPDATE"
    );
    let Some(version) = sqlx::query_as::<_, SourceRow>(&version_sql)
        .bind(version_id)
        .bind(source_id)
        .fetch_optional(&mut *transaction)
        .await?
    else {
        return Ok(None);
    };
    record_version(&mut transaction, &current, principal_id).await?;
    let update_sql = format!(
        "UPDATE learning_source_records SET title = $2, url = $3, publisher = $4, published_at = $5::date, rights = $6, anchor = $7, excerpt = $8, concepts = $9, updated_at = NOW() WHERE id = $1 RETURNING {SOURCE_COLUMNS}"
    );
    let row = sqlx::query_as::<_, SourceRow>(&update_sql)
        .bind(source_id)
        .bind(&version.title)
        .bind(&version.url)
        .bind(&version.publisher)
        .bind(&version.published_at)
        .bind(&version.rights)
        .bind(&version.anchor)
        .bind(&version.excerpt)
        .bind(&version.concepts)
        .fetch_one(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(Some(source(row)))
}

async fn delete(pool: &PgPool, source_id: Uuid) -> Result<bool, sqlx::Error> {
    Ok(
        sqlx::query("DELETE FROM learning_source_records WHERE id = $1")
            .bind(source_id)
            .execute(pool)
            .await?
            .rows_affected()
            == 1,
    )
}

async fn application_principal_id(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(principal.subject_id)
        .fetch_optional(&mut **transaction)
        .await
}

async fn locked_source(
    transaction: &mut Transaction<'_, Postgres>,
    source_id: Uuid,
) -> Result<Option<SourceRow>, sqlx::Error> {
    let sql =
        format!("SELECT {SOURCE_COLUMNS} FROM learning_source_records WHERE id = $1 FOR UPDATE");
    sqlx::query_as(&sql)
        .bind(source_id)
        .fetch_optional(&mut **transaction)
        .await
}

async fn record_version(
    transaction: &mut Transaction<'_, Postgres>,
    source: &SourceRow,
    principal_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO learning_source_record_versions (id, source_record_id, changed_by_principal_id, title, url, publisher, published_at, rights, anchor, excerpt, concepts) VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10, $11)").bind(Uuid::new_v4()).bind(source.id).bind(principal_id).bind(&source.title).bind(&source.url).bind(&source.publisher).bind(&source.published_at).bind(&source.rights).bind(&source.anchor).bind(&source.excerpt).bind(&source.concepts).execute(&mut **transaction).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{SourceRow, source};
    use sqlx::types::Json;
    use uuid::Uuid;
    #[test]
    fn preserves_the_catalog_concept_array() {
        let record = source(SourceRow {
            id: Uuid::nil(),
            anchor: None,
            concepts: Json(vec!["retrieval".to_owned()]),
            excerpt: None,
            published_at: None,
            publisher: None,
            rights: None,
            title: "Source".to_owned(),
            url: "https://example.test".to_owned(),
        });
        assert_eq!(record.concepts, ["retrieval"]);
    }
}
