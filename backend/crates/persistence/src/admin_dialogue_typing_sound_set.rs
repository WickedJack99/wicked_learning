use std::future::Future;

use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::admin_dialogue_typing_sound_set::{
    AdminDialogueTypingSoundSetError, AdminDialogueTypingSoundSetRepository as Port,
    DialogueTypingSoundAssignment, DialogueTypingSoundSetForm, DialogueTypingSoundSetMutation,
};
use wicked_learning_domain::world_content::AdminDialogueTypingSoundSet;

const REFERENCE_FIELD: &str = "audio";
const REFERENCE_KIND: &str = "dialogue_typing_sound";

pub struct PostgresAdminDialogueTypingSoundSetRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminDialogueTypingSoundSetRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminDialogueTypingSoundSetRepository<'_> {
    fn list(
        &self,
    ) -> impl Future<
        Output = Result<Vec<AdminDialogueTypingSoundSet>, AdminDialogueTypingSoundSetError>,
    > + Send {
        async move { list(self.pool).await.map_err(map_error) }
    }

    fn create(
        &self,
        form: &DialogueTypingSoundSetForm,
        assignments: &[DialogueTypingSoundAssignment],
    ) -> impl Future<Output = Result<AdminDialogueTypingSoundSet, AdminDialogueTypingSoundSetError>> + Send
    {
        async move {
            create(self.pool, form, assignments)
                .await
                .map_err(map_error)
        }
    }

    fn update(
        &self,
        set_id: Uuid,
        form: &DialogueTypingSoundSetForm,
    ) -> impl Future<
        Output = Result<Option<AdminDialogueTypingSoundSet>, AdminDialogueTypingSoundSetError>,
    > + Send {
        async move { update(self.pool, set_id, form).await.map_err(map_error) }
    }

    fn replace_all(
        &self,
        set_id: Uuid,
        assignments: &[DialogueTypingSoundAssignment],
    ) -> impl Future<
        Output = Result<Option<DialogueTypingSoundSetMutation>, AdminDialogueTypingSoundSetError>,
    > + Send {
        async move {
            replace_all(self.pool, set_id, assignments)
                .await
                .map_err(map_error)
        }
    }

    fn replace_letter(
        &self,
        set_id: Uuid,
        assignment: &DialogueTypingSoundAssignment,
    ) -> impl Future<
        Output = Result<Option<DialogueTypingSoundSetMutation>, AdminDialogueTypingSoundSetError>,
    > + Send {
        async move {
            replace_letter(self.pool, set_id, assignment)
                .await
                .map_err(map_error)
        }
    }
}

#[derive(FromRow)]
struct SummaryRow {
    id: Uuid,
    is_default: bool,
    letters: Vec<String>,
    name: String,
    slug: String,
    sound_count: i64,
    tags: Vec<String>,
}

#[derive(FromRow)]
struct SoundRow {
    audio_asset_id: Option<Uuid>,
    id: Uuid,
    letter: String,
}

fn summary(row: SummaryRow) -> AdminDialogueTypingSoundSet {
    AdminDialogueTypingSoundSet {
        id: row.id,
        is_default: row.is_default,
        letters: row.letters,
        name: row.name,
        slug: row.slug,
        sound_count: row.sound_count,
        tags: row.tags,
    }
}

fn map_error(error: sqlx::Error) -> AdminDialogueTypingSoundSetError {
    if matches!(error, sqlx::Error::Protocol(_)) {
        return AdminDialogueTypingSoundSetError::Invalid;
    }
    if error
        .as_database_error()
        .and_then(|database| database.code())
        .is_some_and(|code| code == "23505")
    {
        AdminDialogueTypingSoundSetError::Conflict
    } else {
        tracing::error!(%error, "could not mutate dialogue typing sound sets");
        AdminDialogueTypingSoundSetError::Unavailable
    }
}

async fn list(pool: &PgPool) -> Result<Vec<AdminDialogueTypingSoundSet>, sqlx::Error> {
    let rows = sqlx::query_as::<_, SummaryRow>(summary_query())
        .fetch_all(pool)
        .await?;
    Ok(rows.into_iter().map(summary).collect())
}

async fn create(
    pool: &PgPool,
    form: &DialogueTypingSoundSetForm,
    assignments: &[DialogueTypingSoundAssignment],
) -> Result<AdminDialogueTypingSoundSet, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    assert_wav_assets(&mut transaction, assignments).await?;
    if form.is_default {
        clear_other_defaults(&mut transaction, Uuid::nil()).await?;
    }
    let set_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO learning_dialogue_typing_sound_sets (id, slug, name, tags, is_default, updated_at) VALUES ($1, $2, $3, $4, $5, NOW())",
    )
    .bind(set_id)
    .bind(&form.slug)
    .bind(&form.name)
    .bind(&form.tags)
    .bind(form.is_default)
    .execute(&mut *transaction)
    .await?;
    for assignment in assignments {
        let sound_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO learning_dialogue_typing_sounds (id, sound_set_id, letter, url, volume, audio_asset_id, updated_at) VALUES ($1, $2, $3, $4, 70, $5, NOW())",
        )
        .bind(sound_id)
        .bind(set_id)
        .bind(&assignment.letter)
        .bind(content_url(sound_id))
        .bind(assignment.asset_id)
        .execute(&mut *transaction)
        .await?;
        set_audio_reference(&mut transaction, sound_id, assignment.asset_id).await?;
    }
    ensure_default(&mut transaction, set_id, form.is_default).await?;
    let result = summary_by_id(&mut transaction, set_id)
        .await?
        .expect("new dialogue typing sound set exists");
    transaction.commit().await?;
    Ok(summary(result))
}

async fn update(
    pool: &PgPool,
    set_id: Uuid,
    form: &DialogueTypingSoundSetForm,
) -> Result<Option<AdminDialogueTypingSoundSet>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let exists = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM learning_dialogue_typing_sound_sets WHERE id = $1 FOR UPDATE",
    )
    .bind(set_id)
    .fetch_optional(&mut *transaction)
    .await?;
    if exists.is_none() {
        transaction.commit().await?;
        return Ok(None);
    }
    if form.is_default {
        clear_other_defaults(&mut transaction, set_id).await?;
    }
    sqlx::query(
        "UPDATE learning_dialogue_typing_sound_sets SET slug = $2, name = $3, tags = $4, is_default = $5, updated_at = NOW() WHERE id = $1",
    )
    .bind(set_id)
    .bind(&form.slug)
    .bind(&form.name)
    .bind(&form.tags)
    .bind(form.is_default)
    .execute(&mut *transaction)
    .await?;
    ensure_default(&mut transaction, set_id, form.is_default).await?;
    let result = summary_by_id(&mut transaction, set_id)
        .await?
        .expect("updated dialogue typing sound set exists");
    transaction.commit().await?;
    Ok(Some(summary(result)))
}

async fn replace_all(
    pool: &PgPool,
    set_id: Uuid,
    assignments: &[DialogueTypingSoundAssignment],
) -> Result<Option<DialogueTypingSoundSetMutation>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    if !set_exists(&mut transaction, set_id).await? {
        transaction.commit().await?;
        return Ok(None);
    }
    assert_wav_assets(&mut transaction, assignments).await?;
    let sounds = sound_rows(&mut transaction, set_id).await?;
    let mut released_object_keys = Vec::new();
    for assignment in assignments {
        let sound = sounds
            .iter()
            .find(|sound| sound.letter == assignment.letter)
            .ok_or_else(invalid)?;
        replace_sound_asset(
            &mut transaction,
            sound,
            assignment.asset_id,
            &mut released_object_keys,
        )
        .await?;
    }
    let result = summary_by_id(&mut transaction, set_id)
        .await?
        .expect("existing dialogue typing sound set exists");
    transaction.commit().await?;
    Ok(Some(DialogueTypingSoundSetMutation {
        released_object_keys,
        set: summary(result),
    }))
}

async fn replace_letter(
    pool: &PgPool,
    set_id: Uuid,
    assignment: &DialogueTypingSoundAssignment,
) -> Result<Option<DialogueTypingSoundSetMutation>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    if !set_exists(&mut transaction, set_id).await? {
        transaction.commit().await?;
        return Ok(None);
    }
    assert_wav_assets(&mut transaction, std::slice::from_ref(assignment)).await?;
    let sound = sqlx::query_as::<_, SoundRow>(
        "SELECT id, letter, audio_asset_id FROM learning_dialogue_typing_sounds WHERE sound_set_id = $1 AND letter = $2 FOR UPDATE",
    )
    .bind(set_id)
    .bind(&assignment.letter)
    .fetch_optional(&mut *transaction)
    .await?
    .ok_or_else(invalid)?;
    let mut released_object_keys = Vec::new();
    replace_sound_asset(
        &mut transaction,
        &sound,
        assignment.asset_id,
        &mut released_object_keys,
    )
    .await?;
    let result = summary_by_id(&mut transaction, set_id)
        .await?
        .expect("existing dialogue typing sound set exists");
    transaction.commit().await?;
    Ok(Some(DialogueTypingSoundSetMutation {
        released_object_keys,
        set: summary(result),
    }))
}

async fn set_exists(
    transaction: &mut Transaction<'_, Postgres>,
    set_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_dialogue_typing_sound_sets WHERE id = $1 FOR UPDATE)")
        .bind(set_id)
        .fetch_one(&mut **transaction)
        .await
}

async fn sound_rows(
    transaction: &mut Transaction<'_, Postgres>,
    set_id: Uuid,
) -> Result<Vec<SoundRow>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, letter, audio_asset_id FROM learning_dialogue_typing_sounds WHERE sound_set_id = $1 ORDER BY letter ASC FOR UPDATE",
    )
    .bind(set_id)
    .fetch_all(&mut **transaction)
    .await
}

async fn assert_wav_assets(
    transaction: &mut Transaction<'_, Postgres>,
    assignments: &[DialogueTypingSoundAssignment],
) -> Result<(), sqlx::Error> {
    for assignment in assignments {
        let exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS (SELECT 1 FROM reusable_media_assets WHERE id = $1 AND content_type = 'audio/wav')",
        )
        .bind(assignment.asset_id)
        .fetch_one(&mut **transaction)
        .await?;
        if !exists {
            return Err(invalid());
        }
    }
    Ok(())
}

async fn replace_sound_asset(
    transaction: &mut Transaction<'_, Postgres>,
    sound: &SoundRow,
    asset_id: Uuid,
    released_object_keys: &mut Vec<String>,
) -> Result<(), sqlx::Error> {
    if sound.audio_asset_id == Some(asset_id) {
        return Ok(());
    }
    clear_audio_reference(transaction, sound.id).await?;
    sqlx::query(
        "UPDATE learning_dialogue_typing_sounds SET audio_asset_id = $2, url = $3, updated_at = NOW() WHERE id = $1",
    )
    .bind(sound.id)
    .bind(asset_id)
    .bind(content_url(sound.id))
    .execute(&mut **transaction)
    .await?;
    set_audio_reference(transaction, sound.id, asset_id).await?;
    if let Some(old_asset_id) = sound.audio_asset_id
        && let Some(object_key) = reclaim_unreferenced_asset(transaction, old_asset_id).await?
    {
        released_object_keys.push(object_key);
    }
    Ok(())
}

async fn ensure_default(
    transaction: &mut Transaction<'_, Postgres>,
    set_id: Uuid,
    requested_default: bool,
) -> Result<(), sqlx::Error> {
    if requested_default {
        clear_other_defaults(transaction, set_id).await?;
        return Ok(());
    }
    let any_default: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM learning_dialogue_typing_sound_sets WHERE is_default)",
    )
    .fetch_one(&mut **transaction)
    .await?;
    if !any_default {
        sqlx::query(
            "UPDATE learning_dialogue_typing_sound_sets SET is_default = TRUE, updated_at = NOW() WHERE id = $1",
        )
        .bind(set_id)
        .execute(&mut **transaction)
        .await?;
    }
    Ok(())
}

async fn clear_other_defaults(
    transaction: &mut Transaction<'_, Postgres>,
    set_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE learning_dialogue_typing_sound_sets SET is_default = FALSE, updated_at = NOW() WHERE is_default AND id <> $1",
    )
    .bind(set_id)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

async fn summary_by_id(
    transaction: &mut Transaction<'_, Postgres>,
    set_id: Uuid,
) -> Result<Option<SummaryRow>, sqlx::Error> {
    sqlx::query_as(summary_query_with_where())
        .bind(set_id)
        .fetch_optional(&mut **transaction)
        .await
}

fn summary_query() -> &'static str {
    "SELECT sets.id, sets.is_default, COALESCE(array_agg(sounds.letter ORDER BY sounds.letter) FILTER (WHERE sounds.letter IS NOT NULL), ARRAY[]::text[]) AS letters, sets.name, sets.slug, COUNT(sounds.id)::bigint AS sound_count, sets.tags FROM learning_dialogue_typing_sound_sets AS sets LEFT JOIN learning_dialogue_typing_sounds AS sounds ON sounds.sound_set_id = sets.id GROUP BY sets.id ORDER BY sets.is_default DESC, sets.name ASC, sets.id ASC"
}

fn summary_query_with_where() -> &'static str {
    "SELECT sets.id, sets.is_default, COALESCE(array_agg(sounds.letter ORDER BY sounds.letter) FILTER (WHERE sounds.letter IS NOT NULL), ARRAY[]::text[]) AS letters, sets.name, sets.slug, COUNT(sounds.id)::bigint AS sound_count, sets.tags FROM learning_dialogue_typing_sound_sets AS sets LEFT JOIN learning_dialogue_typing_sounds AS sounds ON sounds.sound_set_id = sets.id WHERE sets.id = $1 GROUP BY sets.id"
}

async fn clear_audio_reference(
    transaction: &mut Transaction<'_, Postgres>,
    sound_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM reusable_media_asset_references WHERE owner_kind = $1 AND owner_id = $2 AND field_key = $3",
    )
    .bind(REFERENCE_KIND)
    .bind(sound_id)
    .bind(REFERENCE_FIELD)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

async fn set_audio_reference(
    transaction: &mut Transaction<'_, Postgres>,
    sound_id: Uuid,
    asset_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO reusable_media_asset_references (asset_id, owner_kind, owner_id, field_key) VALUES ($1, $2, $3, $4)",
    )
    .bind(asset_id)
    .bind(REFERENCE_KIND)
    .bind(sound_id)
    .bind(REFERENCE_FIELD)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

async fn reclaim_unreferenced_asset(
    transaction: &mut Transaction<'_, Postgres>,
    asset_id: Uuid,
) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar(
        "DELETE FROM reusable_media_assets WHERE id = $1 AND content_type = 'audio/wav' AND NOT EXISTS (SELECT 1 FROM reusable_media_asset_references WHERE asset_id = $1) RETURNING object_key",
    )
    .bind(asset_id)
    .fetch_optional(&mut **transaction)
    .await
}

fn content_url(sound_id: Uuid) -> String {
    format!("/api/v1/learner/dialogue-typing-sounds/{sound_id}/content")
}

fn invalid() -> sqlx::Error {
    sqlx::Error::Protocol("a dialogue typing sound requires a managed WAV upload".to_owned())
}
