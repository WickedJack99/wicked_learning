use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_activity_translation::{
    ActiveActivityTranslation, LearnerActivityTranslationReadError,
    LearnerActivityTranslationRepository,
};
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

use crate::learner_node_availability::PostgresLearnerNodeAvailability;

pub struct PostgresLearnerActivityTranslationRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerActivityTranslationRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl LearnerActivityTranslationRepository for PostgresLearnerActivityTranslationRepository<'_> {
    fn load_active_translation(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<ActiveActivityTranslation>, LearnerActivityTranslationReadError>,
    > + Send {
        async move {
            load_active_translation(self.pool, principal, play_run_id, activity_slug)
                .await
                .map_err(unavailable)
        }
    }
}

#[derive(FromRow)]
struct TranslationRow {
    content: Option<Value>,
    node_id: Uuid,
    node_state: String,
    node_visual_config: Value,
}

async fn load_active_translation(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<ActiveActivityTranslation>, sqlx::Error> {
    let Some(availability) = PostgresLearnerNodeAvailability::load(pool, principal).await? else {
        return Ok(None);
    };
    let row = sqlx::query_as::<_, TranslationRow>(
        "SELECT translations.content, nodes.id AS node_id, nodes.state AS node_state, nodes.visual_config AS node_visual_config \
         FROM learner_route_progress AS progress \
         INNER JOIN application_principals AS principals ON principals.id = progress.principal_id \
         INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id \
         INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id \
         INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id \
         INNER JOIN learning_routes AS routes ON routes.id = activities.route_id \
         INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id \
         INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id \
         LEFT JOIN learner_language_preferences AS preferences ON preferences.principal_id = principals.id \
         LEFT JOIN application_locales AS locales ON locales.code = COALESCE(preferences.locale, 'en') AND locales.is_enabled = TRUE \
         LEFT JOIN learning_activity_translations AS translations ON translations.learning_activity_id = activities.id AND translations.locale = locales.code \
         WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' \
         AND activities.slug = $3 AND nodes.map_asset_id = assets.id \
         AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL \
         AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL \
         AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4)))",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(pool)
    .await?;
    let Some(row) = row else {
        return Ok(None);
    };
    if !availability
        .state_for_node(row.node_id, &row.node_state, &row.node_visual_config)
        .can_play()
    {
        return Ok(None);
    }
    Ok(Some(ActiveActivityTranslation {
        translation: row.content,
    }))
}

fn unavailable(error: sqlx::Error) -> LearnerActivityTranslationReadError {
    tracing::error!(%error, "could not load the active activity translation");
    LearnerActivityTranslationReadError
}
