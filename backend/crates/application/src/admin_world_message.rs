use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MessageUi {
    pub surface_color_dark: String,
    pub surface_color_light: String,
    pub card_color_dark: String,
    pub card_color_light: String,
    pub card_border_color_dark: String,
    pub card_border_color_light: String,
    pub text_color_dark: String,
    pub text_color_light: String,
    pub accent_color_dark: String,
    pub accent_color_light: String,
}

impl MessageUi {
    #[allow(clippy::too_many_arguments)]
    pub fn parse(
        surface_color_dark: &str,
        surface_color_light: &str,
        card_color_dark: &str,
        card_color_light: &str,
        card_border_color_dark: &str,
        card_border_color_light: &str,
        text_color_dark: &str,
        text_color_light: &str,
        accent_color_dark: &str,
        accent_color_light: &str,
    ) -> Option<Self> {
        let colors = [
            surface_color_dark,
            surface_color_light,
            card_color_dark,
            card_color_light,
            card_border_color_dark,
            card_border_color_light,
            text_color_dark,
            text_color_light,
            accent_color_dark,
            accent_color_light,
        ];
        if colors.iter().any(|color| !valid_color(color)) {
            return None;
        }
        Some(Self {
            surface_color_dark: surface_color_dark.to_ascii_lowercase(),
            surface_color_light: surface_color_light.to_ascii_lowercase(),
            card_color_dark: card_color_dark.to_ascii_lowercase(),
            card_color_light: card_color_light.to_ascii_lowercase(),
            card_border_color_dark: card_border_color_dark.to_ascii_lowercase(),
            card_border_color_light: card_border_color_light.to_ascii_lowercase(),
            text_color_dark: text_color_dark.to_ascii_lowercase(),
            text_color_light: text_color_light.to_ascii_lowercase(),
            accent_color_dark: accent_color_dark.to_ascii_lowercase(),
            accent_color_light: accent_color_light.to_ascii_lowercase(),
        })
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MessageActivityForm {
    pub title: String,
    pub slug: Option<String>,
    pub introduction: Option<String>,
    pub activity_type: String,
    pub topic_id: Option<Uuid>,
    pub topic_title: String,
    pub audience: String,
    pub allow_responses: bool,
    pub response_prompt: String,
    pub prompt: String,
    pub input_label: String,
    pub ui: MessageUi,
}

impl MessageActivityForm {
    #[allow(clippy::too_many_arguments)]
    pub fn parse(
        title: &str,
        slug: Option<&str>,
        introduction: Option<&str>,
        activity_type: &str,
        topic_id: Option<Uuid>,
        topic_title: &str,
        audience: &str,
        allow_responses: bool,
        response_prompt: &str,
        prompt: &str,
        input_label: &str,
        ui: MessageUi,
    ) -> Option<Self> {
        let title = title.trim();
        let slug = slug.map(str::trim).filter(|value| !value.is_empty());
        let topic_title = topic_title.trim();
        let prompt = prompt.trim();
        let input_label = input_label.trim();
        let response_prompt = response_prompt.trim();
        if title.is_empty()
            || title.chars().count() > 120
            || slug.is_some_and(|value| value.chars().count() > 140 || !valid_slug(value))
            || introduction.is_some_and(|value| value.chars().count() > 1_000)
            || !matches!(activity_type, "message_prompt" | "message_wall")
            || topic_id.is_none() && topic_title.is_empty()
            || topic_title.chars().count() > 120
            || !matches!(audience, "peers" | "support")
            || activity_type == "message_wall" && audience != "peers"
            || activity_type == "message_prompt" && allow_responses
            || response_prompt.chars().count() > 280
            || prompt.is_empty()
            || prompt.chars().count() > 1_000
            || input_label.is_empty()
            || input_label.chars().count() > 120
        {
            return None;
        }
        Some(Self {
            title: title.to_owned(),
            slug: slug.map(str::to_owned),
            introduction: introduction.map(str::to_owned),
            activity_type: activity_type.to_owned(),
            topic_id,
            topic_title: topic_title.to_owned(),
            audience: audience.to_owned(),
            allow_responses,
            response_prompt: response_prompt.to_owned(),
            prompt: prompt.to_owned(),
            input_label: input_label.to_owned(),
            ui,
        })
    }
}
fn valid_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)
}
fn valid_slug(value: &str) -> bool {
    value
        .bytes()
        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}
pub fn generated_slug(title: &str) -> String {
    let mut out = String::new();
    let mut separator = true;
    for character in deunicode::deunicode(title).chars() {
        if character.is_ascii_alphanumeric() {
            out.push(character.to_ascii_lowercase());
            separator = false;
        } else if !separator {
            out.push('-');
            separator = true;
        }
    }
    let out = out.trim_matches('-');
    if out.is_empty() {
        "activity".to_owned()
    } else {
        out.to_owned()
    }
}
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldMessageError {
    InvalidActivity,
    Conflict,
    Unavailable,
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdatedMessageActivity {
    pub activity_id: Uuid,
    pub updated_at: String,
}
pub trait AdminWorldMessageRepository {
    fn create_message(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &MessageActivityForm,
    ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldMessageError>> + Send;
    fn update_message(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &MessageActivityForm,
        expected_updated_at: &str,
    ) -> impl Future<Output = Result<Option<UpdatedMessageActivity>, AdminWorldMessageError>> + Send;
}
pub struct AdminWorldMessageCommand<'repository, Repository> {
    repository: &'repository Repository,
}
impl<'repository, Repository: AdminWorldMessageRepository>
    AdminWorldMessageCommand<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }
    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &MessageActivityForm,
    ) -> Result<Option<Uuid>, AdminWorldMessageError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .create_message(principal, node_id, form)
            .await
    }
    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &MessageActivityForm,
        expected_updated_at: &str,
    ) -> Result<Option<UpdatedMessageActivity>, AdminWorldMessageError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .update_message(principal, activity_id, form, expected_updated_at)
            .await
    }
}
#[cfg(test)]
mod tests {
    use super::{MessageActivityForm, MessageUi};

    fn ui() -> MessageUi {
        MessageUi::parse(
            "#071018", "#e6f5f2", "#13262d", "#ffffff", "#2dd4bf", "#0f766e", "#f1f5f9", "#0f172a",
            "#5eead4", "#0f766e",
        )
        .expect("source default colors are valid")
    }

    #[test]
    fn preserves_message_type_boundaries() {
        assert!(
            MessageActivityForm::parse(
                "Prompt",
                None,
                None,
                "message_prompt",
                None,
                "Notes",
                "peers",
                false,
                "",
                "Leave a note",
                "Your note",
                ui(),
            )
            .is_some()
        );
        assert!(
            MessageActivityForm::parse(
                "Wall",
                None,
                None,
                "message_wall",
                None,
                "Notes",
                "support",
                false,
                "",
                "Read notes",
                "Your note",
                ui(),
            )
            .is_none()
        );
        assert!(
            MessageActivityForm::parse(
                "Prompt",
                None,
                None,
                "message_prompt",
                None,
                "Notes",
                "peers",
                true,
                "",
                "Leave a note",
                "Your note",
                ui(),
            )
            .is_none()
        );
    }

    #[test]
    fn normalizes_source_message_colors_and_rejects_invalid_ones() {
        assert_eq!(
            MessageUi::parse(
                "#ABCDEF", "#e6f5f2", "#13262d", "#ffffff", "#2dd4bf", "#0f766e", "#f1f5f9",
                "#0f172a", "#5eead4", "#0f766e",
            )
            .expect("valid source color")
            .surface_color_dark,
            "#abcdef"
        );
        assert!(
            MessageUi::parse(
                "blue", "#e6f5f2", "#13262d", "#ffffff", "#2dd4bf", "#0f766e", "#f1f5f9",
                "#0f172a", "#5eead4", "#0f766e",
            )
            .is_none()
        );
    }
}
