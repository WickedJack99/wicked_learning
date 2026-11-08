use std::{collections::BTreeMap, future::Future};

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Debug, PartialEq)]
pub struct QuestionOptionForm {
    pub body: String,
    pub feedback: String,
    pub is_correct: bool,
    pub key: Option<String>,
    pub label: String,
    pub outcome_key: String,
    pub weights: BTreeMap<String, f64>,
}

impl QuestionOptionForm {
    pub fn parse(
        label: &str,
        body: &str,
        is_correct: bool,
        key: Option<&str>,
        outcome_key: &str,
        feedback: &str,
        weights: BTreeMap<String, f64>,
    ) -> Option<Self> {
        let label = label.trim();
        let body = body.trim();
        let feedback = feedback.trim();
        let outcome_key = outcome_key.trim();
        let key = key.map(str::trim).filter(|value| !value.is_empty());
        if label.is_empty()
            || label.chars().count() > 30
            || body.is_empty()
            || body.chars().count() > 2_000
            || feedback.chars().count() > 2_000
            || outcome_key.chars().count() > 120
            || key.is_some_and(|value| value.chars().count() > 120)
            || weights.len() > 20
            || weights
                .values()
                .any(|weight| !weight.is_finite() || !(0.0..=1_000.0).contains(weight))
        {
            return None;
        }
        Some(Self {
            body: body.to_owned(),
            feedback: feedback.to_owned(),
            is_correct,
            key: key.map(str::to_owned),
            label: label.to_owned(),
            outcome_key: outcome_key.to_owned(),
            weights,
        })
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct QuestionActivityForm {
    pub title: String,
    pub slug: Option<String>,
    pub introduction: Option<String>,
    pub prompt: String,
    pub feedback_correct: String,
    pub feedback_incorrect: String,
    pub explanation: String,
    pub allow_multiple: bool,
    pub options: Vec<QuestionOptionForm>,
}

impl QuestionActivityForm {
    #[allow(clippy::too_many_arguments)]
    pub fn parse(
        title: &str,
        slug: Option<&str>,
        introduction: Option<&str>,
        prompt: &str,
        feedback_correct: &str,
        feedback_incorrect: &str,
        explanation: &str,
        allow_multiple: bool,
        options: Vec<QuestionOptionForm>,
    ) -> Option<Self> {
        let title = title.trim();
        let slug = slug.map(str::trim).filter(|value| !value.is_empty());
        let prompt = prompt.trim();
        let feedback_correct = feedback_correct.trim();
        let feedback_incorrect = feedback_incorrect.trim();
        let explanation = explanation.trim();
        if title.is_empty()
            || title.chars().count() > 120
            || slug.is_some_and(|value| value.chars().count() > 140 || !valid_slug(value))
            || introduction.is_some_and(|value| value.chars().count() > 1_000)
            || prompt.is_empty()
            || prompt.chars().count() > 4_000
            || feedback_correct.chars().count() > 2_000
            || feedback_incorrect.chars().count() > 2_000
            || explanation.chars().count() > 4_000
            || !(2..=12).contains(&options.len())
        {
            return None;
        }
        Some(Self {
            title: title.to_owned(),
            slug: slug.map(str::to_owned),
            introduction: introduction.map(str::to_owned),
            prompt: prompt.to_owned(),
            feedback_correct: feedback_correct.to_owned(),
            feedback_incorrect: feedback_incorrect.to_owned(),
            explanation: explanation.to_owned(),
            allow_multiple,
            options,
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
pub enum AdminWorldQuestionError {
    InvalidActivity,
    Conflict,
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdatedQuestionActivity {
    pub activity_id: Uuid,
    pub updated_at: String,
}

pub trait AdminWorldQuestionRepository {
    fn create_question(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &QuestionActivityForm,
    ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldQuestionError>> + Send;

    fn update_question(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &QuestionActivityForm,
        expected_updated_at: &str,
    ) -> impl Future<Output = Result<Option<UpdatedQuestionActivity>, AdminWorldQuestionError>> + Send;
}

pub struct AdminWorldQuestionCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: AdminWorldQuestionRepository>
    AdminWorldQuestionCommand<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &QuestionActivityForm,
    ) -> Result<Option<Uuid>, AdminWorldQuestionError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .create_question(principal, node_id, form)
            .await
    }

    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &QuestionActivityForm,
        expected_updated_at: &str,
    ) -> Result<Option<UpdatedQuestionActivity>, AdminWorldQuestionError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .update_question(principal, activity_id, form, expected_updated_at)
            .await
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::{QuestionActivityForm, QuestionOptionForm};

    fn option(label: &str, body: &str) -> QuestionOptionForm {
        QuestionOptionForm::parse(label, body, false, None, "", "", BTreeMap::new())
            .expect("valid source answer")
    }

    #[test]
    fn retains_source_question_and_answer_bounds() {
        assert!(
            QuestionActivityForm::parse(
                "Question",
                None,
                None,
                "Which choice preserves learner agency?",
                "",
                "",
                "",
                false,
                vec![
                    option("A", "Keep choices visible."),
                    option("B", "Hide routes.")
                ],
            )
            .is_some()
        );
        assert!(
            QuestionActivityForm::parse(
                "Question",
                None,
                None,
                "Prompt",
                "",
                "",
                "",
                false,
                vec![option("A", "Only one answer")],
            )
            .is_none()
        );
        assert!(
            QuestionOptionForm::parse(
                "A",
                "Answer",
                false,
                None,
                "",
                "",
                (0..21).map(|index| (index.to_string(), 1.0)).collect(),
            )
            .is_none()
        );
        assert!(
            QuestionOptionForm::parse(
                "A",
                "Answer",
                false,
                None,
                "",
                "",
                BTreeMap::from([("recall".to_owned(), 0.5)]),
            )
            .is_some()
        );
    }
}
