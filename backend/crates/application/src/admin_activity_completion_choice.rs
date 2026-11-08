#[derive(Clone, Debug, PartialEq)]
pub struct ActivityCompletionChoiceForm {
    pub prompt: Option<String>,
}

impl ActivityCompletionChoiceForm {
    pub fn parse(prompt: Option<&str>) -> Self {
        Self {
            prompt: prompt
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(|value| value.chars().take(600).collect()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::ActivityCompletionChoiceForm;
    #[test]
    fn trims_or_clears_the_source_choice_context() {
        assert_eq!(
            ActivityCompletionChoiceForm::parse(Some(" Choose a direction. "))
                .prompt
                .as_deref(),
            Some("Choose a direction.")
        );
        assert_eq!(ActivityCompletionChoiceForm::parse(Some(" ")).prompt, None);
    }
}
