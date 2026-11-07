use sqlx::{FromRow, PgPool};
use wicked_learning_application::admin_learning_taxonomy::{
    AdminLearningTaxonomyError, AdminLearningTaxonomyRepository as Port, CompetenceTopicForm,
    LearningConceptForm, generated_slug,
};
use wicked_learning_domain::authoring::{
    AdminCompetenceTopic, AdminLearningConcept, AdminLearningTaxonomy,
};

pub struct PostgresAdminLearningTaxonomyRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminLearningTaxonomyRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct CompetenceTopicRow {
    slug: String,
    name: String,
    description: Option<String>,
    growth_threshold: f64,
    emittance_threshold: f64,
    aura_threshold: f64,
    is_active: bool,
}

#[derive(FromRow)]
struct LearningConceptRow {
    slug: String,
    name: String,
    description: Option<String>,
    is_active: bool,
}

impl From<CompetenceTopicRow> for AdminCompetenceTopic {
    fn from(row: CompetenceTopicRow) -> Self {
        Self {
            slug: row.slug,
            name: row.name,
            description: row.description,
            growth_threshold: row.growth_threshold,
            emittance_threshold: row.emittance_threshold,
            aura_threshold: row.aura_threshold,
            is_active: row.is_active,
        }
    }
}

impl From<LearningConceptRow> for AdminLearningConcept {
    fn from(row: LearningConceptRow) -> Self {
        Self {
            slug: row.slug,
            name: row.name,
            description: row.description,
            is_active: row.is_active,
        }
    }
}

impl Port for PostgresAdminLearningTaxonomyRepository<'_> {
    fn list(
        &self,
        include_competence_topics: bool,
        include_learning_concepts: bool,
    ) -> impl std::future::Future<Output = Result<AdminLearningTaxonomy, AdminLearningTaxonomyError>>
    + Send {
        async move {
            let competence_topics = if include_competence_topics {
                list_competence_topics(self.pool).await?
            } else {
                Vec::new()
            };
            let learning_concepts = if include_learning_concepts {
                list_learning_concepts(self.pool).await?
            } else {
                Vec::new()
            };
            Ok(AdminLearningTaxonomy {
                can_manage_competence_topics: include_competence_topics,
                can_manage_learning_concepts: include_learning_concepts,
                competence_topics,
                learning_concepts,
            })
        }
    }

    fn sync_competence_topics(
        &self,
        entries: &[CompetenceTopicForm],
    ) -> impl std::future::Future<Output = Result<(), AdminLearningTaxonomyError>> + Send {
        async move { sync_competence_topics(self.pool, entries).await }
    }

    fn sync_learning_concepts(
        &self,
        entries: &[LearningConceptForm],
    ) -> impl std::future::Future<Output = Result<(), AdminLearningTaxonomyError>> + Send {
        async move { sync_learning_concepts(self.pool, entries).await }
    }
}

async fn list_competence_topics(
    pool: &PgPool,
) -> Result<Vec<AdminCompetenceTopic>, AdminLearningTaxonomyError> {
    sqlx::query_as::<_, CompetenceTopicRow>(
        "SELECT slug, name, description, growth_threshold::double precision AS growth_threshold, emittance_threshold::double precision AS emittance_threshold, aura_threshold::double precision AS aura_threshold, is_active FROM competence_topic_definitions ORDER BY name ASC, slug ASC",
    )
    .fetch_all(pool)
    .await
    .map(|rows| rows.into_iter().map(Into::into).collect())
    .map_err(storage_error)
}

async fn list_learning_concepts(
    pool: &PgPool,
) -> Result<Vec<AdminLearningConcept>, AdminLearningTaxonomyError> {
    sqlx::query_as::<_, LearningConceptRow>(
        "SELECT slug, name, description, is_active FROM learning_concepts ORDER BY name ASC, slug ASC",
    )
    .fetch_all(pool)
    .await
    .map(|rows| rows.into_iter().map(Into::into).collect())
    .map_err(storage_error)
}

async fn sync_competence_topics(
    pool: &PgPool,
    entries: &[CompetenceTopicForm],
) -> Result<(), AdminLearningTaxonomyError> {
    let mut transaction = pool.begin().await.map_err(storage_error)?;
    let slugs = entries
        .iter()
        .map(|entry| generated_slug(&entry.name))
        .collect::<Vec<_>>();
    for entry in entries {
        sqlx::query(
            "INSERT INTO competence_topic_definitions (slug, name, description, growth_threshold, emittance_threshold, aura_threshold, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, growth_threshold = EXCLUDED.growth_threshold, emittance_threshold = EXCLUDED.emittance_threshold, aura_threshold = EXCLUDED.aura_threshold, is_active = EXCLUDED.is_active",
        )
        .bind(generated_slug(&entry.name))
        .bind(&entry.name)
        .bind(&entry.description)
        .bind(entry.growth_threshold)
        .bind(entry.emittance_threshold)
        .bind(entry.aura_threshold)
        .bind(entry.is_active)
        .execute(&mut *transaction)
        .await
        .map_err(storage_error)?;
    }
    sqlx::query("DELETE FROM competence_topic_definitions WHERE NOT (slug = ANY($1))")
        .bind(&slugs)
        .execute(&mut *transaction)
        .await
        .map_err(storage_error)?;
    transaction.commit().await.map_err(storage_error)
}

async fn sync_learning_concepts(
    pool: &PgPool,
    entries: &[LearningConceptForm],
) -> Result<(), AdminLearningTaxonomyError> {
    let mut transaction = pool.begin().await.map_err(storage_error)?;
    let slugs = entries
        .iter()
        .map(|entry| generated_slug(&entry.name))
        .collect::<Vec<_>>();
    for entry in entries {
        sqlx::query(
            "INSERT INTO learning_concepts (slug, name, description, is_active) VALUES ($1, $2, $3, $4) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = EXCLUDED.is_active, updated_at = NOW()",
        )
        .bind(generated_slug(&entry.name))
        .bind(&entry.name)
        .bind(&entry.description)
        .bind(entry.is_active)
        .execute(&mut *transaction)
        .await
        .map_err(storage_error)?;
    }
    sqlx::query("DELETE FROM learning_concepts WHERE NOT (slug = ANY($1))")
        .bind(&slugs)
        .execute(&mut *transaction)
        .await
        .map_err(storage_error)?;
    transaction.commit().await.map_err(storage_error)
}

fn storage_error(error: sqlx::Error) -> AdminLearningTaxonomyError {
    tracing::error!(%error, "could not persist learning taxonomy administration");
    AdminLearningTaxonomyError
}
