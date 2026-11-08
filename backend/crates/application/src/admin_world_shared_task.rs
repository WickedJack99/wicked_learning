use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SharedTaskActivityForm {
    pub title: String,
    pub slug: Option<String>,
    pub introduction: Option<String>,
    pub task_kind: String,
    pub show_contributions: bool,
    pub prompt: String,
    pub instructions: String,
    pub input_label: String,
    pub project_goal: String,
    pub project_deliverable: String,
    pub project_steps: Vec<String>,
    pub peer_review_enabled: bool,
    pub peer_review_prompt: String,
    pub threshold: u16,
    pub minimum_length: u16,
    pub repeat_policy: String,
    pub validation_mode: String,
    pub cycle_mode: String,
}

impl SharedTaskActivityForm {
    #[allow(clippy::too_many_arguments)]
    pub fn parse(
        title: &str,
        slug: Option<&str>,
        introduction: Option<&str>,
        task_kind: &str,
        show_contributions: bool,
        prompt: &str,
        instructions: &str,
        input_label: &str,
        project_goal: &str,
        project_deliverable: &str,
        project_steps: Vec<String>,
        peer_review_enabled: bool,
        peer_review_prompt: &str,
        threshold: u16,
        minimum_length: u16,
        repeat_policy: &str,
        validation_mode: &str,
        cycle_mode: &str,
    ) -> Option<Self> {
        let title = title.trim();
        let slug = slug.map(str::trim).filter(|value| !value.is_empty());
        let prompt = prompt.trim();
        let input_label = input_label.trim();
        let peer_review_prompt = peer_review_prompt.trim();
        let project_steps: Vec<_> = project_steps
            .into_iter()
            .map(|step| step.trim().to_owned())
            .filter(|step| !step.is_empty())
            .collect();
        if title.is_empty()
            || title.chars().count() > 120
            || slug.is_some_and(|value| value.chars().count() > 140 || !valid_slug(value))
            || introduction.is_some_and(|value| value.chars().count() > 1_000)
            || !matches!(task_kind, "text" | "question" | "reflection")
            || !matches!(repeat_policy, "once_per_user" | "unlimited")
            || !matches!(validation_mode, "minimum_length" | "none")
            || !matches!(cycle_mode, "none" | "question_response_question")
            || prompt.is_empty()
            || prompt.chars().count() > 4_000
            || instructions.chars().count() > 4_000
            || input_label.is_empty()
            || input_label.chars().count() > 160
            || project_goal.chars().count() > 1_000
            || project_deliverable.chars().count() > 1_000
            || project_steps.len() > 6
            || project_steps.iter().any(|step| step.chars().count() > 240)
            || peer_review_prompt.is_empty()
            || peer_review_prompt.chars().count() > 1_000
            || threshold == 0
        {
            return None;
        }
        Some(Self {
            title: title.to_owned(),
            slug: slug.map(str::to_owned),
            introduction: introduction.map(str::to_owned),
            task_kind: task_kind.to_owned(),
            show_contributions,
            prompt: prompt.to_owned(),
            instructions: instructions.trim().to_owned(),
            input_label: input_label.to_owned(),
            project_goal: project_goal.trim().to_owned(),
            project_deliverable: project_deliverable.trim().to_owned(),
            project_steps,
            peer_review_enabled,
            peer_review_prompt: peer_review_prompt.to_owned(),
            threshold,
            minimum_length,
            repeat_policy: repeat_policy.to_owned(),
            validation_mode: validation_mode.to_owned(),
            cycle_mode: cycle_mode.to_owned(),
        })
    }
}

fn valid_slug(value: &str) -> bool {
    value
        .bytes()
        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}

pub fn generated_slug(title: &str) -> String {
    let mut slug = String::new();
    let mut separator = true;
    for character in deunicode::deunicode(title).chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character.to_ascii_lowercase());
            separator = false;
        } else if !separator {
            slug.push('-');
            separator = true;
        }
    }
    let slug = slug.trim_matches('-');
    if slug.is_empty() {
        "activity".to_owned()
    } else {
        slug.to_owned()
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldSharedTaskError {
    InvalidActivity,
    Conflict,
    Unavailable,
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdatedSharedTaskActivity {
    pub activity_id: Uuid,
    pub updated_at: String,
}

pub trait AdminWorldSharedTaskRepository {
    fn create_shared_task(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &SharedTaskActivityForm,
    ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldSharedTaskError>> + Send;
    fn update_shared_task(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &SharedTaskActivityForm,
        expected_updated_at: &str,
    ) -> impl Future<Output = Result<Option<UpdatedSharedTaskActivity>, AdminWorldSharedTaskError>> + Send;
}

pub struct AdminWorldSharedTaskCommand<'repository, Repository> {
    repository: &'repository Repository,
}
impl<'repository, Repository: AdminWorldSharedTaskRepository>
    AdminWorldSharedTaskCommand<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }
    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &SharedTaskActivityForm,
    ) -> Result<Option<Uuid>, AdminWorldSharedTaskError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .create_shared_task(principal, node_id, form)
            .await
    }
    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &SharedTaskActivityForm,
        expected_updated_at: &str,
    ) -> Result<Option<UpdatedSharedTaskActivity>, AdminWorldSharedTaskError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .update_shared_task(principal, activity_id, form, expected_updated_at)
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::SharedTaskActivityForm;
    #[test]
    fn keeps_the_source_shared_task_bounds_and_choices() {
        assert!(
            SharedTaskActivityForm::parse(
                "Task",
                None,
                None,
                "text",
                false,
                "Prompt",
                "",
                "Your contribution",
                "",
                "",
                vec![],
                false,
                "Review it",
                3,
                20,
                "once_per_user",
                "minimum_length",
                "none"
            )
            .is_some()
        );
        assert!(
            SharedTaskActivityForm::parse(
                "Task",
                None,
                None,
                "rating",
                false,
                "Prompt",
                "",
                "Your contribution",
                "",
                "",
                vec![],
                false,
                "Review it",
                3,
                20,
                "once_per_user",
                "minimum_length",
                "none"
            )
            .is_none()
        );
        assert!(
            SharedTaskActivityForm::parse(
                "Task",
                None,
                None,
                "text",
                false,
                "Prompt",
                "",
                "",
                "",
                "",
                vec![],
                false,
                "Review it",
                3,
                20,
                "once_per_user",
                "minimum_length",
                "none"
            )
            .is_none()
        );
    }
}
