#[derive(Clone, Debug, PartialEq)]
pub struct ActivityFeedbackGuidanceForm {
    pub evidence: Option<String>,
    pub independent_check_feedback: Option<String>,
    pub independent_check_prompt: Option<String>,
    pub next_action: Option<String>,
    pub purpose: Option<String>,
    pub response_feedback: Option<String>,
    pub rubric: Vec<String>,
}

impl ActivityFeedbackGuidanceForm {
    pub fn parse(
        purpose: Option<&str>,
        evidence: Option<&str>,
        response_feedback: Option<&str>,
        next_action: Option<&str>,
        rubric: Vec<&str>,
        independent_check_prompt: Option<&str>,
        independent_check_feedback: Option<&str>,
    ) -> Option<Self> {
        if rubric.len() > 3 {
            return None;
        }
        Some(Self {
            purpose: text(purpose),
            evidence: text(evidence),
            response_feedback: text(response_feedback),
            next_action: text(next_action),
            rubric: rubric
                .into_iter()
                .filter_map(|value| {
                    text(Some(value)).map(|value| value.chars().take(300).collect())
                })
                .collect(),
            independent_check_prompt: text(independent_check_prompt),
            independent_check_feedback: text(independent_check_feedback),
        })
    }
    pub fn is_empty(&self) -> bool {
        self.purpose.is_none()
            && self.evidence.is_none()
            && self.response_feedback.is_none()
            && self.next_action.is_none()
            && self.rubric.is_empty()
            && self.independent_check_prompt.is_none()
            && self.independent_check_feedback.is_none()
    }
}
fn text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::ActivityFeedbackGuidanceForm;
    #[test]
    fn normalizes_the_source_optional_guidance() {
        let form = ActivityFeedbackGuidanceForm::parse(
            Some(" Notice patterns "),
            None,
            None,
            Some(" Try again "),
            vec!["A cue", " ", "B cue"],
            None,
            None,
        )
        .expect("valid");
        assert_eq!(form.purpose.as_deref(), Some("Notice patterns"));
        assert_eq!(form.rubric, ["A cue", "B cue"]);
    }
}
