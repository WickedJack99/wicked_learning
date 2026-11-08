use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{identity_access::AuthorizedPrincipal, world_content::AdminSound};

#[derive(Clone, Debug, PartialEq)]
pub struct SoundForm {
    pub audio_asset_id: Option<Uuid>,
    pub icon: String,
    pub loop_enabled: bool,
    pub name: String,
    pub play_seconds: Option<f64>,
    pub slug: Option<String>,
    pub volume: i16,
}

impl SoundForm {
    pub fn parse(
        name: &str,
        slug: Option<&str>,
        icon: &str,
        volume: f64,
        play_seconds: Option<f64>,
        loop_enabled: bool,
        audio_asset_id: Option<Uuid>,
    ) -> Option<Self> {
        let name = name.trim();
        let slug = slug.map(str::trim).filter(|value| !value.is_empty());
        if name.is_empty()
            || name.chars().count() > 120
            || !matches!(icon, "ambience" | "music" | "sfx" | "ui" | "voice")
            || !(0.0..=100.0).contains(&volume)
            || volume.fract() != 0.0
            || play_seconds.is_some_and(|value| !(0.1..=86_400.0).contains(&value))
            || slug.is_some_and(|value| value.chars().count() > 140 || !valid_slug(value))
        {
            return None;
        }

        Some(Self {
            audio_asset_id,
            icon: icon.to_owned(),
            loop_enabled,
            name: name.to_owned(),
            play_seconds,
            slug: slug.map(str::to_owned),
            volume: volume as i16,
        })
    }
}

fn valid_slug(value: &str) -> bool {
    value
        .bytes()
        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminSoundError {
    Invalid,
    Conflict,
    Unavailable,
}

pub trait AdminSoundRepository {
    fn list(&self) -> impl Future<Output = Result<Vec<AdminSound>, AdminSoundError>> + Send;
    fn create(
        &self,
        form: &SoundForm,
    ) -> impl Future<Output = Result<AdminSound, AdminSoundError>> + Send;
    fn update(
        &self,
        sound_id: Uuid,
        form: &SoundForm,
    ) -> impl Future<Output = Result<Option<AdminSoundMutation>, AdminSoundError>> + Send;
    fn delete(
        &self,
        sound_id: Uuid,
    ) -> impl Future<Output = Result<Option<DeletedAdminSound>, AdminSoundError>> + Send;
}

pub struct AdminSoundMutation {
    pub released_object_keys: Vec<String>,
    pub sound: AdminSound,
}

pub struct DeletedAdminSound {
    pub released_object_keys: Vec<String>,
}

pub struct AdminSoundCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminSoundCommand<'repository, Repository>
where
    Repository: AdminSoundRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn list(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<Vec<AdminSound>>, AdminSoundError> {
        if !principal.has_permission("sounds", "ro") {
            return Ok(None);
        }
        self.repository.list().await.map(Some)
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &SoundForm,
    ) -> Result<Option<AdminSound>, AdminSoundError> {
        if !principal.has_permission("sounds", "ru") {
            return Ok(None);
        }
        self.repository.create(form).await.map(Some)
    }

    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        sound_id: Uuid,
        form: &SoundForm,
    ) -> Result<Option<AdminSoundMutation>, AdminSoundError> {
        if !principal.has_permission("sounds", "ru") {
            return Ok(None);
        }
        self.repository.update(sound_id, form).await
    }

    pub async fn delete(
        &self,
        principal: &AuthorizedPrincipal,
        sound_id: Uuid,
    ) -> Result<Option<DeletedAdminSound>, AdminSoundError> {
        if !principal.has_permission("sounds", "rud") {
            return Ok(None);
        }
        self.repository.delete(sound_id).await
    }
}

#[cfg(test)]
mod tests {
    use super::SoundForm;

    #[test]
    fn retains_the_source_sound_bounds() {
        assert!(
            SoundForm::parse("Quiet pulse", None, "ambience", 55.0, None, true, None).is_some()
        );
        assert!(
            SoundForm::parse(
                "Quiet",
                Some("not a slug"),
                "ambience",
                55.0,
                None,
                true,
                None
            )
            .is_none()
        );
        assert!(SoundForm::parse("Quiet", None, "other", 55.0, None, true, None).is_none());
    }
}
