use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Debug, PartialEq)]
pub struct ItemObstacleSlot {
    pub item_id: Uuid,
    pub width: f64,
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ItemObstacleSound {
    pub enabled: bool,
    pub sound_id: Option<Uuid>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ItemObstacleActivityForm {
    pub title: String,
    pub slug: Option<String>,
    pub introduction: Option<String>,
    pub background_dark: String,
    pub background_light: String,
    pub background_mirrored: bool,
    pub met_background_dark: String,
    pub met_background_light: String,
    pub met_background_mirrored: bool,
    pub overlay_dark: String,
    pub overlay_light: String,
    pub overlay_mirrored: bool,
    pub overlay_x: f64,
    pub overlay_y: f64,
    pub overlay_width: f64,
    pub slots: Vec<ItemObstacleSlot>,
    pub consume_on_each_entry: bool,
    pub lock_minutes: i32,
    pub sound_not_met: ItemObstacleSound,
    pub sound_met: ItemObstacleSound,
    pub sound_transition: ItemObstacleSound,
}

impl ItemObstacleActivityForm {
    #[allow(clippy::too_many_arguments)]
    pub fn parse(
        title: &str,
        slug: Option<&str>,
        introduction: Option<&str>,
        background_dark: Option<&str>,
        background_light: Option<&str>,
        background_mirrored: bool,
        met_background_dark: Option<&str>,
        met_background_light: Option<&str>,
        met_background_mirrored: bool,
        overlay_dark: Option<&str>,
        overlay_light: Option<&str>,
        overlay_mirrored: bool,
        overlay_x: f64,
        overlay_y: f64,
        overlay_width: f64,
        slots: Vec<ItemObstacleSlot>,
        consume_on_each_entry: bool,
        lock_minutes: i32,
        sound_not_met: ItemObstacleSound,
        sound_met: ItemObstacleSound,
        sound_transition: ItemObstacleSound,
    ) -> Option<Self> {
        let title = title.trim();
        let slug = slug.map(str::trim).filter(|value| !value.is_empty());
        if title.is_empty()
            || title.chars().count() > 120
            || slug.is_some_and(|value| value.chars().count() > 140 || !valid_slug(value))
            || introduction.is_some_and(|value| value.chars().count() > 1_000)
            || [
                background_dark,
                background_light,
                met_background_dark,
                met_background_light,
                overlay_dark,
                overlay_light,
            ]
            .into_iter()
            .flatten()
            .any(|value| value.chars().count() > 2_048)
            || slots.len() > 10
            || !bounded(overlay_x, 0.0, 100.0)
            || !bounded(overlay_y, 0.0, 100.0)
            || !bounded(overlay_width, 1.0, 100.0)
            || !(0..=10_080).contains(&lock_minutes)
            || slots.iter().any(|slot| {
                !bounded(slot.x, 0.0, 100.0)
                    || !bounded(slot.y, 0.0, 100.0)
                    || !bounded(slot.width, 1.0, 100.0)
            })
        {
            return None;
        }

        Some(Self {
            title: title.to_owned(),
            slug: slug.map(str::to_owned),
            introduction: introduction.map(str::to_owned),
            background_dark: background_dark.unwrap_or_default().to_owned(),
            background_light: background_light.unwrap_or_default().to_owned(),
            background_mirrored,
            met_background_dark: met_background_dark.unwrap_or_default().to_owned(),
            met_background_light: met_background_light.unwrap_or_default().to_owned(),
            met_background_mirrored,
            overlay_dark: overlay_dark.unwrap_or_default().to_owned(),
            overlay_light: overlay_light.unwrap_or_default().to_owned(),
            overlay_mirrored,
            overlay_x,
            overlay_y,
            overlay_width,
            slots: slots
                .into_iter()
                .map(|slot| ItemObstacleSlot {
                    width: slot.width.clamp(3.0, 60.0),
                    ..slot
                })
                .collect(),
            consume_on_each_entry,
            lock_minutes,
            sound_not_met,
            sound_met,
            sound_transition,
        })
    }
}

fn valid_slug(value: &str) -> bool {
    value
        .bytes()
        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}

fn bounded(value: f64, minimum: f64, maximum: f64) -> bool {
    value.is_finite() && (minimum..=maximum).contains(&value)
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldItemObstacleError {
    InvalidActivity,
    Conflict,
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdatedItemObstacleActivity {
    pub activity_id: Uuid,
    pub updated_at: String,
}

pub trait AdminWorldItemObstacleRepository {
    fn create_item_obstacle(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &ItemObstacleActivityForm,
    ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldItemObstacleError>> + Send;

    fn update_item_obstacle(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &ItemObstacleActivityForm,
        expected_updated_at: &str,
    ) -> impl Future<
        Output = Result<Option<UpdatedItemObstacleActivity>, AdminWorldItemObstacleError>,
    > + Send;
}

pub struct AdminWorldItemObstacleCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldItemObstacleCommand<'repository, Repository>
where
    Repository: AdminWorldItemObstacleRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &ItemObstacleActivityForm,
    ) -> Result<Option<Uuid>, AdminWorldItemObstacleError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }

        self.repository
            .create_item_obstacle(principal, node_id, form)
            .await
    }

    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &ItemObstacleActivityForm,
        expected_updated_at: &str,
    ) -> Result<Option<UpdatedItemObstacleActivity>, AdminWorldItemObstacleError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }

        self.repository
            .update_item_obstacle(principal, activity_id, form, expected_updated_at)
            .await
    }
}

#[cfg(test)]
mod tests {
    use std::{
        future::Future,
        sync::{
            Arc,
            atomic::{AtomicBool, Ordering},
        },
    };

    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::{
        AdminWorldItemObstacleCommand, AdminWorldItemObstacleError,
        AdminWorldItemObstacleRepository, ItemObstacleActivityForm, ItemObstacleSlot,
        ItemObstacleSound, UpdatedItemObstacleActivity,
    };

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldItemObstacleRepository for RecordingRepository {
        fn create_item_obstacle(
            &self,
            _principal: &AuthorizedPrincipal,
            _node_id: Uuid,
            _form: &ItemObstacleActivityForm,
        ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldItemObstacleError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn update_item_obstacle(
            &self,
            _principal: &AuthorizedPrincipal,
            _activity_id: Uuid,
            _form: &ItemObstacleActivityForm,
            _expected_updated_at: &str,
        ) -> impl Future<
            Output = Result<Option<UpdatedItemObstacleActivity>, AdminWorldItemObstacleError>,
        > + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    fn valid_form() -> ItemObstacleActivityForm {
        ItemObstacleActivityForm::parse(
            "Obstacle",
            None,
            None,
            None,
            None,
            false,
            None,
            None,
            false,
            None,
            None,
            false,
            50.0,
            50.0,
            30.0,
            vec![ItemObstacleSlot {
                item_id: Uuid::new_v4(),
                x: 50.0,
                y: 50.0,
                width: 10.0,
            }],
            false,
            0,
            ItemObstacleSound {
                enabled: false,
                sound_id: None,
            },
            ItemObstacleSound {
                enabled: false,
                sound_id: None,
            },
            ItemObstacleSound {
                enabled: false,
                sound_id: None,
            },
        )
        .expect("source defaults are valid")
    }

    #[test]
    fn preserves_source_defaults_and_slot_bounds() {
        let form = valid_form();
        assert_eq!(form.overlay_width, 30.0);
        assert_eq!(form.slots[0].width, 10.0);
        assert!(
            ItemObstacleActivityForm::parse(
                "Obstacle",
                None,
                None,
                None,
                None,
                false,
                None,
                None,
                false,
                None,
                None,
                false,
                50.0,
                50.0,
                30.0,
                vec![ItemObstacleSlot {
                    item_id: Uuid::new_v4(),
                    x: 101.0,
                    y: 50.0,
                    width: 10.0,
                }],
                false,
                0,
                ItemObstacleSound {
                    enabled: false,
                    sound_id: None
                },
                ItemObstacleSound {
                    enabled: false,
                    sound_id: None
                },
                ItemObstacleSound {
                    enabled: false,
                    sound_id: None
                },
            )
            .is_none()
        );
    }

    #[tokio::test]
    async fn requires_source_world_activity_update_before_catalog_resolution_or_writing() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_nodes:rud:all".to_owned()],
        };

        let result = AdminWorldItemObstacleCommand::new(&repository)
            .create(&principal, Uuid::new_v4(), &valid_form())
            .await
            .expect("authorization check succeeds");

        assert_eq!(result, None);
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
