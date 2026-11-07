use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, world_content::AdminActivityTransition,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldNodeTransitionError {
    InvalidTransition,
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreateActivityTransition {
    pub from_activity_id: Uuid,
    pub to_activity_id: Option<Uuid>,
    pub from_connector: String,
    pub to_connector: String,
    pub label: Option<String>,
}

impl CreateActivityTransition {
    pub fn parse(
        from_activity_id: Uuid,
        to_activity_id: Option<Uuid>,
        from_connector: &str,
        to_connector: &str,
        label: Option<&str>,
    ) -> Option<Self> {
        if !valid_connector(from_connector)
            || !valid_connector(to_connector)
            || label.is_some_and(|value| value.chars().count() > 120)
        {
            return None;
        }
        Some(Self {
            from_activity_id,
            to_activity_id,
            from_connector: from_connector.to_owned(),
            to_connector: to_connector.to_owned(),
            label: label.map(str::to_owned),
        })
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdateActivityTransition {
    pub label: Option<String>,
    pub trigger_value: Option<String>,
}

impl UpdateActivityTransition {
    pub fn parse(label: Option<&str>, trigger_value: Option<&str>) -> Option<Self> {
        if label.is_some_and(|value| value.chars().count() > 120)
            || trigger_value.is_some_and(|value| value.chars().count() > 120)
        {
            return None;
        }
        Some(Self {
            label: label.map(str::to_owned),
            trigger_value: trigger_value.map(str::to_owned),
        })
    }
}

fn valid_connector(value: &str) -> bool {
    !value.is_empty() && value.chars().count() <= 80
}

pub fn trigger_for_connector(connector: &str) -> &'static str {
    match connector {
        "correct" => "correct",
        "incorrect" => "incorrect",
        "outcome" => "outcome",
        "travel" => "portal",
        _ => "completed",
    }
}

pub fn fallback_output_label(connector: &str) -> String {
    match connector {
        "correct" => "Correct".to_owned(),
        "incorrect" => "Incorrect".to_owned(),
        "outcome" => "Outcome".to_owned(),
        "travel" => "Travel".to_owned(),
        "arrived" => "Arrived".to_owned(),
        "dialogue-end-pending" => "A End".to_owned(),
        "completed" => "Completed".to_owned(),
        value => value
            .split('-')
            .map(|word| {
                let mut chars = word.chars();
                chars.next().map_or_else(String::new, |first| {
                    first.to_uppercase().collect::<String>() + chars.as_str()
                })
            })
            .collect::<Vec<_>>()
            .join(" "),
    }
}

pub trait AdminWorldNodeTransitionRepository {
    fn create(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        transition: &CreateActivityTransition,
    ) -> impl Future<
        Output = Result<Option<Vec<AdminActivityTransition>>, AdminWorldNodeTransitionError>,
    > + Send;

    fn update(
        &self,
        principal: &AuthorizedPrincipal,
        transition_id: Uuid,
        transition: &UpdateActivityTransition,
    ) -> impl Future<
        Output = Result<Option<Vec<AdminActivityTransition>>, AdminWorldNodeTransitionError>,
    > + Send;

    fn delete(
        &self,
        principal: &AuthorizedPrincipal,
        transition_id: Uuid,
    ) -> impl Future<
        Output = Result<Option<Vec<AdminActivityTransition>>, AdminWorldNodeTransitionError>,
    > + Send;
}

pub struct AdminWorldNodeTransitionCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldNodeTransitionCommand<'repository, Repository>
where
    Repository: AdminWorldNodeTransitionRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        transition: &CreateActivityTransition,
    ) -> Result<Option<Vec<AdminActivityTransition>>, AdminWorldNodeTransitionError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository.create(principal, node_id, transition).await
    }

    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        transition_id: Uuid,
        transition: &UpdateActivityTransition,
    ) -> Result<Option<Vec<AdminActivityTransition>>, AdminWorldNodeTransitionError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .update(principal, transition_id, transition)
            .await
    }

    pub async fn delete(
        &self,
        principal: &AuthorizedPrincipal,
        transition_id: Uuid,
    ) -> Result<Option<Vec<AdminActivityTransition>>, AdminWorldNodeTransitionError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository.delete(principal, transition_id).await
    }
}

#[cfg(test)]
mod tests {
    use super::{
        CreateActivityTransition, UpdateActivityTransition, fallback_output_label,
        trigger_for_connector,
    };
    use uuid::Uuid;

    #[test]
    fn keeps_source_connector_triggers_and_labels() {
        assert_eq!(trigger_for_connector("outcome"), "outcome");
        assert_eq!(trigger_for_connector("travel"), "portal");
        assert_eq!(trigger_for_connector("dialogue-end-pending"), "completed");
        assert_eq!(fallback_output_label("dialogue-end-pending"), "A End");
    }

    #[test]
    fn preserves_source_transition_form_bounds() {
        assert!(
            CreateActivityTransition::parse(
                Uuid::new_v4(),
                None,
                "completed",
                "in",
                Some("Continue")
            )
            .is_some()
        );
        assert!(CreateActivityTransition::parse(Uuid::new_v4(), None, "", "in", None).is_none());
        assert!(UpdateActivityTransition::parse(Some(&"x".repeat(121)), None).is_none());
    }
}
