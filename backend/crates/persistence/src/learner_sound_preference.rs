use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_sound_preference::{
    LearnerSoundPreferenceDraft, LearnerSoundPreferenceError,
    LearnerSoundPreferenceRepository as Port,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerSoundPreferences,
};

pub struct PostgresLearnerSoundPreferenceRepository<'pool> {
    pool: &'pool PgPool,
}
impl<'pool> PostgresLearnerSoundPreferenceRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}
#[derive(FromRow)]
struct PreferenceRow {
    muted: bool,
    effects_volume: i16,
    ambience_volume: i16,
}

impl Port for PostgresLearnerSoundPreferenceRepository<'_> {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl std::future::Future<
        Output = Result<LearnerSoundPreferences, LearnerSoundPreferenceError>,
    > + Send {
        async move {
            load(self.pool, principal).await.map_err(|error| {
                tracing::error!(%error, "could not load learner sound preferences");
                LearnerSoundPreferenceError
            })
        }
    }
    fn save(
        &self,
        principal: &AuthorizedPrincipal,
        draft: LearnerSoundPreferenceDraft,
    ) -> impl std::future::Future<
        Output = Result<LearnerSoundPreferences, LearnerSoundPreferenceError>,
    > + Send {
        async move {
            save(self.pool, principal, draft).await.map_err(|error| {
                tracing::error!(%error, "could not save learner sound preferences");
                LearnerSoundPreferenceError
            })
        }
    }
}

async fn load(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<LearnerSoundPreferences, sqlx::Error> {
    let preference = sqlx::query_as::<_, PreferenceRow>("SELECT preferences.muted, preferences.effects_volume, preferences.ambience_volume FROM learner_sound_preferences AS preferences INNER JOIN application_principals AS principals ON principals.id = preferences.principal_id WHERE principals.identity_subject_id = $1").bind(principal.subject_id).fetch_optional(pool).await?;
    Ok(preference
        .map(|row| LearnerSoundPreferences {
            muted: row.muted,
            effects_volume: row.effects_volume,
            ambience_volume: row.ambience_volume,
        })
        .unwrap_or_else(LearnerSoundPreferences::defaults))
}

async fn save(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    draft: LearnerSoundPreferenceDraft,
) -> Result<LearnerSoundPreferences, sqlx::Error> {
    let principal_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(pool)
    .await?
    .ok_or(sqlx::Error::RowNotFound)?;
    sqlx::query("INSERT INTO learner_sound_preferences (principal_id, muted, effects_volume, ambience_volume) VALUES ($1, $2, $3, $4) ON CONFLICT (principal_id) DO UPDATE SET muted = EXCLUDED.muted, effects_volume = EXCLUDED.effects_volume, ambience_volume = EXCLUDED.ambience_volume, updated_at = NOW()").bind(principal_id).bind(draft.muted).bind(draft.effects_volume).bind(draft.ambience_volume).execute(pool).await?;
    Ok(draft.into_preferences())
}
