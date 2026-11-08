use std::future::Future;

use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_sound::{
    AdminSoundError, AdminSoundMutation, AdminSoundRepository, DeletedAdminSound, SoundForm,
};
use wicked_learning_domain::world_content::AdminSound;

const REFERENCE_KIND: &str = "learning_sound";
const REFERENCE_FIELD: &str = "audio";

pub struct PostgresAdminSoundRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminSoundRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl AdminSoundRepository for PostgresAdminSoundRepository<'_> {
    fn list(&self) -> impl Future<Output = Result<Vec<AdminSound>, AdminSoundError>> + Send {
        async move { list(self.pool).await.map_err(map_error) }
    }

    fn create(
        &self,
        form: &SoundForm,
    ) -> impl Future<Output = Result<AdminSound, AdminSoundError>> + Send {
        async move { create(self.pool, form).await.map_err(map_error) }
    }

    fn update(
        &self,
        sound_id: Uuid,
        form: &SoundForm,
    ) -> impl Future<Output = Result<Option<AdminSoundMutation>, AdminSoundError>> + Send {
        async move { update(self.pool, sound_id, form).await.map_err(map_error) }
    }

    fn delete(
        &self,
        sound_id: Uuid,
    ) -> impl Future<Output = Result<Option<DeletedAdminSound>, AdminSoundError>> + Send {
        async move { delete(self.pool, sound_id).await.map_err(map_error) }
    }
}

#[derive(FromRow)]
struct SoundRow {
    id: Uuid,
    icon: Option<String>,
    loop_enabled: bool,
    name: String,
    play_seconds: Option<f64>,
    slug: String,
    url: String,
    volume: i16,
}

fn sound(row: SoundRow) -> AdminSound {
    AdminSound {
        id: row.id,
        icon: row.icon.unwrap_or_else(|| "sfx".to_owned()),
        loop_enabled: row.loop_enabled,
        name: row.name,
        play_seconds: row.play_seconds,
        slug: row.slug,
        url: row.url,
        volume: row.volume,
    }
}

fn map_error(error: sqlx::Error) -> AdminSoundError {
    if matches!(error, sqlx::Error::Protocol(_)) {
        return AdminSoundError::Invalid;
    }
    if error
        .as_database_error()
        .and_then(|database| database.code())
        .is_some_and(|code| code == "23505")
    {
        AdminSoundError::Conflict
    } else {
        tracing::error!(%error, "could not mutate reusable sound library");
        AdminSoundError::Unavailable
    }
}

async fn list(pool: &PgPool) -> Result<Vec<AdminSound>, sqlx::Error> {
    let rows = sqlx::query_as::<_, SoundRow>(
        "SELECT id, icon, loop AS loop_enabled, name, play_seconds::double precision AS play_seconds, slug, url, volume FROM learning_sounds ORDER BY name ASC, id ASC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(sound).collect())
}

async fn create(pool: &PgPool, form: &SoundForm) -> Result<AdminSound, sqlx::Error> {
    let Some(audio_asset_id) = form.audio_asset_id else {
        return Err(sqlx::Error::Protocol(
            "a new sound needs managed audio".to_owned(),
        ));
    };
    let id = Uuid::new_v4();
    let slug = form.slug.clone().unwrap_or_else(|| slugify(&form.name));
    let url = public_url(id);
    let mut transaction = pool.begin().await?;
    if !audio_asset_exists(&mut transaction, audio_asset_id).await? {
        return Err(sqlx::Error::Protocol(
            "sound audio asset is unavailable".to_owned(),
        ));
    }
    let row = sqlx::query_as::<_, SoundRow>(
        "INSERT INTO learning_sounds (id, slug, name, icon, url, volume, play_seconds, loop, published_at, audio_asset_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9) RETURNING id, icon, loop AS loop_enabled, name, play_seconds::double precision AS play_seconds, slug, url, volume",
    )
    .bind(id)
    .bind(slug)
    .bind(&form.name)
    .bind(&form.icon)
    .bind(url)
    .bind(form.volume)
    .bind(form.play_seconds)
    .bind(form.loop_enabled)
    .bind(audio_asset_id)
    .fetch_one(&mut *transaction)
    .await?;
    set_audio_reference(&mut transaction, id, audio_asset_id).await?;
    transaction.commit().await?;
    Ok(sound(row))
}

async fn update(
    pool: &PgPool,
    sound_id: Uuid,
    form: &SoundForm,
) -> Result<Option<AdminSoundMutation>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(existing_asset_id) = sqlx::query_scalar::<_, Option<Uuid>>(
        "SELECT audio_asset_id FROM learning_sounds WHERE id = $1 FOR UPDATE",
    )
    .bind(sound_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    let audio_asset_id = form.audio_asset_id.or(existing_asset_id);
    if let Some(audio_asset_id) = audio_asset_id {
        if !audio_asset_exists(&mut transaction, audio_asset_id).await? {
            return Err(sqlx::Error::Protocol(
                "sound audio asset is unavailable".to_owned(),
            ));
        }
    }
    let url = if audio_asset_id.is_some() {
        public_url(sound_id)
    } else {
        sqlx::query_scalar("SELECT url FROM learning_sounds WHERE id = $1")
            .bind(sound_id)
            .fetch_one(&mut *transaction)
            .await?
    };
    let row = sqlx::query_as::<_, SoundRow>(
        "UPDATE learning_sounds SET slug = $2, name = $3, icon = $4, url = $5, volume = $6, play_seconds = $7, loop = $8, audio_asset_id = $9, updated_at = NOW() WHERE id = $1 RETURNING id, icon, loop AS loop_enabled, name, play_seconds::double precision AS play_seconds, slug, url, volume",
    )
    .bind(sound_id)
    .bind(form.slug.clone().unwrap_or_else(|| slugify(&form.name)))
    .bind(&form.name)
    .bind(&form.icon)
    .bind(url)
    .bind(form.volume)
    .bind(form.play_seconds)
    .bind(form.loop_enabled)
    .bind(audio_asset_id)
    .fetch_one(&mut *transaction)
    .await?;
    let mut released_object_keys = Vec::new();
    if audio_asset_id != existing_asset_id {
        clear_audio_reference(&mut transaction, sound_id).await?;
        if let Some(audio_asset_id) = audio_asset_id {
            set_audio_reference(&mut transaction, sound_id, audio_asset_id).await?;
        }
        if let Some(existing_asset_id) = existing_asset_id {
            if let Some(object_key) =
                reclaim_unreferenced_asset(&mut transaction, existing_asset_id).await?
            {
                released_object_keys.push(object_key);
            }
        }
    }
    transaction.commit().await?;
    Ok(Some(AdminSoundMutation {
        released_object_keys,
        sound: sound(row),
    }))
}

async fn delete(pool: &PgPool, sound_id: Uuid) -> Result<Option<DeletedAdminSound>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(audio_asset_id) = sqlx::query_scalar::<_, Option<Uuid>>(
        "SELECT audio_asset_id FROM learning_sounds WHERE id = $1 FOR UPDATE",
    )
    .bind(sound_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    clear_audio_reference(&mut transaction, sound_id).await?;
    sqlx::query_scalar::<_, Uuid>("DELETE FROM learning_sounds WHERE id = $1 RETURNING id")
        .bind(sound_id)
        .fetch_one(&mut *transaction)
        .await?;
    let mut released_object_keys = Vec::new();
    if let Some(audio_asset_id) = audio_asset_id {
        if let Some(object_key) =
            reclaim_unreferenced_asset(&mut transaction, audio_asset_id).await?
        {
            released_object_keys.push(object_key);
        }
    }
    transaction.commit().await?;
    Ok(Some(DeletedAdminSound {
        released_object_keys,
    }))
}

async fn audio_asset_exists(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    asset_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM reusable_media_assets WHERE id = $1 AND content_type LIKE 'audio/%')",
    )
    .bind(asset_id)
    .fetch_one(&mut **transaction)
    .await
}

async fn clear_audio_reference(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    sound_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM reusable_media_asset_references WHERE owner_kind = $1 AND owner_id = $2",
    )
    .bind(REFERENCE_KIND)
    .bind(sound_id)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

async fn set_audio_reference(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
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
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    asset_id: Uuid,
) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar(
        "DELETE FROM reusable_media_assets WHERE id = $1 AND content_type LIKE 'audio/%' AND NOT EXISTS (SELECT 1 FROM reusable_media_asset_references WHERE asset_id = $1) RETURNING object_key",
    )
    .bind(asset_id)
    .fetch_optional(&mut **transaction)
    .await
}

fn public_url(sound_id: Uuid) -> String {
    format!("/api/v1/public/sounds/{sound_id}/content")
}

fn slugify(value: &str) -> String {
    let slug = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>();
    let slug = slug.trim_matches('-');
    if slug.is_empty() {
        "sound".to_owned()
    } else {
        slug.to_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::slugify;

    #[test]
    fn derives_the_source_slug_when_the_form_omits_it() {
        assert_eq!(slugify("Signal chime!"), "signal-chime");
    }
}
