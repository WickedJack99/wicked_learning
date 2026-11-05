use serde::Deserialize;
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_reflection::{
    LearnerReflectionError, LearnerReflectionRepository as LearnerReflectionRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerReflectionResult,
};

pub struct PostgresLearnerReflectionRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerReflectionRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct CurrentReflectionRow {
    activity_start_id: Uuid,
    activity_config: serde_json::Value,
    activity_id: Uuid,
    activity_title: String,
    node_title: String,
    principal_id: Uuid,
    route_id: Uuid,
}

#[derive(FromRow)]
struct TransitionRow {
    to_activity_id: Option<Uuid>,
}

#[derive(FromRow)]
struct JournalPageRow {
    markdown: String,
}

#[derive(Deserialize)]
struct ReflectionConfig {
    note: Option<String>,
    prompt: String,
    subtopic: Option<String>,
    topic: Option<String>,
}

impl LearnerReflectionRepositoryPort for PostgresLearnerReflectionRepository<'_> {
    fn save_current_reflection(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        reflection: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerReflectionResult>, LearnerReflectionError>,
    > + Send {
        async move {
            save_current_reflection(self.pool, principal, play_run_id, activity_slug, reflection)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not save learner reflection");
                    LearnerReflectionError
                })
        }
    }
}

async fn save_current_reflection(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
    reflection: &str,
) -> Result<Option<LearnerReflectionResult>, sqlx::Error> {
    let reflection = reflection.trim();
    if reflection.is_empty() || reflection.chars().count() > 20_000 {
        return Ok(None);
    }

    let mut transaction = pool.begin().await?;
    let Some(current) =
        load_current_reflection(&mut transaction, principal, play_run_id, activity_slug).await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let Ok(config) = serde_json::from_value::<ReflectionConfig>(current.activity_config) else {
        transaction.commit().await?;
        return Ok(None);
    };
    let prompt = config.prompt.trim();
    if prompt.is_empty()
        || config
            .note
            .as_deref()
            .is_some_and(|note| note.chars().count() > 2_000)
    {
        transaction.commit().await?;
        return Ok(None);
    }

    let topic = config
        .topic
        .as_deref()
        .map(str::trim)
        .filter(|topic| !topic.is_empty())
        .unwrap_or(&current.node_title);
    let subtopic = config
        .subtopic
        .as_deref()
        .map(str::trim)
        .unwrap_or_default();
    if topic.chars().count() > 160 || subtopic.chars().count() > 160 {
        transaction.commit().await?;
        return Ok(None);
    }
    let journal_title = journal_page_title(topic, subtopic);
    let journal_page_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO learner_journal_pages (principal_id, title, topic, subtopic) VALUES ($1, $2, $3, $4) ON CONFLICT (principal_id, topic, subtopic) DO UPDATE SET updated_at = NOW() RETURNING id",
    )
    .bind(current.principal_id)
    .bind(&journal_title)
    .bind(topic)
    .bind(subtopic)
    .fetch_one(&mut *transaction)
    .await?;
    let page = sqlx::query_as::<_, JournalPageRow>(
        "SELECT markdown FROM learner_journal_pages WHERE id = $1 FOR UPDATE",
    )
    .bind(journal_page_id)
    .fetch_one(&mut *transaction)
    .await?;

    let reflection_title = format!("{} - {}", current.node_title, current.activity_title);
    sqlx::query(
        "INSERT INTO learner_reflections (principal_id, learner_journal_page_id, activity_id, activity_start_id, play_run_id, title, question, reflection) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(current.principal_id)
    .bind(journal_page_id)
    .bind(current.activity_id)
    .bind(current.activity_start_id)
    .bind(play_run_id)
    .bind(&reflection_title)
    .bind(prompt)
    .bind(reflection)
    .execute(&mut *transaction)
    .await?;
    let journal_entry = format!(
        "## {reflection_title}\n\n**Question**  {prompt}\n\n**Reflection**  {reflection}\n"
    );
    let markdown = if page.markdown.trim().is_empty() {
        journal_entry
    } else {
        format!("{}\n\n{journal_entry}", page.markdown.trim_end())
    };
    sqlx::query("UPDATE learner_journal_pages SET markdown = $2, updated_at = NOW() WHERE id = $1")
        .bind(journal_page_id)
        .bind(markdown)
        .execute(&mut *transaction)
        .await?;

    let transition = sqlx::query_as::<_, TransitionRow>(
        "SELECT to_activity_id FROM learning_activity_transitions WHERE from_activity_id = $1 AND from_connector = 'completed' AND trigger = 'completed' ORDER BY created_at ASC, id ASC LIMIT 1",
    )
    .bind(current.activity_id)
    .fetch_optional(&mut *transaction)
    .await?;
    let next_activity_id = match transition.and_then(|transition| transition.to_activity_id) {
        Some(next_activity_id) => {
            let next_activity_id = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM learning_activities WHERE id = $1 AND route_id = $2 AND published_at IS NOT NULL AND activity_type IN ('open_practice', 'question', 'reflection')",
            )
            .bind(next_activity_id)
            .bind(current.route_id)
            .fetch_optional(&mut *transaction)
            .await?;
            let Some(next_activity_id) = next_activity_id else {
                transaction.commit().await?;
                return Ok(None);
            };
            Some(next_activity_id)
        }
        None => None,
    };

    mark_activity_completed(&mut transaction, current.principal_id, current.activity_id).await?;
    let status = if let Some(next_activity_id) = next_activity_id {
        mark_activity_reached(&mut transaction, current.principal_id, next_activity_id).await?;
        sqlx::query(
            "UPDATE learner_route_progress SET current_activity_id = $3, status = 'in_progress', last_entered_at = NOW(), last_exited_at = NOW(), updated_at = NOW() WHERE principal_id = $1 AND current_play_run_id = $2",
        )
        .bind(current.principal_id)
        .bind(play_run_id)
        .bind(next_activity_id)
        .execute(&mut *transaction)
        .await?;
        "in_progress"
    } else {
        sqlx::query(
            "UPDATE learner_route_progress SET status = 'completed', completion_count = completion_count + 1, last_completed_at = NOW(), last_exited_at = NOW(), updated_at = NOW() WHERE principal_id = $1 AND current_play_run_id = $2",
        )
        .bind(current.principal_id)
        .bind(play_run_id)
        .execute(&mut *transaction)
        .await?;
        "completed"
    };
    transaction.commit().await?;

    Ok(Some(LearnerReflectionResult {
        play_run_id: play_run_id.to_string(),
        activity_slug: activity_slug.to_owned(),
        status: status.to_owned(),
    }))
}

async fn load_current_reflection(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<CurrentReflectionRow>, sqlx::Error> {
    sqlx::query_as::<_, CurrentReflectionRow>(
        "SELECT progress.activity_start_id, activities.activity_config, activities.id AS activity_id, activities.title AS activity_title, nodes.title AS node_title, progress.principal_id, routes.id AS route_id FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'reflection' AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF progress",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await
}

async fn mark_activity_completed(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO learner_activity_progress (principal_id, activity_id, status, completed_at) VALUES ($1, $2, 'completed', NOW()) ON CONFLICT (principal_id, activity_id) DO UPDATE SET status = 'completed', completed_at = COALESCE(learner_activity_progress.completed_at, EXCLUDED.completed_at), updated_at = NOW()",
    )
    .bind(principal_id)
    .bind(activity_id)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

async fn mark_activity_reached(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO learner_activity_progress (principal_id, activity_id, status) VALUES ($1, $2, 'reached') ON CONFLICT (principal_id, activity_id) DO UPDATE SET updated_at = NOW()",
    )
    .bind(principal_id)
    .bind(activity_id)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

fn journal_page_title(topic: &str, subtopic: &str) -> String {
    let title = if subtopic.is_empty() {
        topic.to_owned()
    } else {
        format!("{topic} - {subtopic}")
    };
    title.chars().take(240).collect()
}
