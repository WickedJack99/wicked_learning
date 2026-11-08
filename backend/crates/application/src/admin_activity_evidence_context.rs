use std::collections::HashSet;

#[derive(Clone, Debug, PartialEq)]
pub struct ActivityEvidenceContextForm {
    pub concepts: Vec<String>,
    pub objective: Option<String>,
}

impl ActivityEvidenceContextForm {
    pub fn parse(objective: Option<&str>, concepts: Vec<&str>) -> Option<Self> {
        if concepts.len() > 8 {
            return None;
        }
        let objective = text(objective, 600);
        let mut seen = HashSet::new();
        let concepts = concepts
            .into_iter()
            .filter_map(|concept| text(Some(concept), 120))
            .filter(|concept| seen.insert(concept.to_lowercase()))
            .collect();
        Some(Self {
            concepts,
            objective,
        })
    }
}

fn text(value: Option<&str>, limit: usize) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(limit).collect())
}

#[cfg(test)]
mod tests {
    use super::ActivityEvidenceContextForm;

    #[test]
    fn retains_bounded_unique_source_orientation_fields() {
        let form = ActivityEvidenceContextForm::parse(
            Some(" Notice the next choice. "),
            vec!["Agency", "agency", "Reflection"],
        )
        .expect("valid evidence context");
        assert_eq!(form.objective.as_deref(), Some("Notice the next choice."));
        assert_eq!(form.concepts, ["Agency", "Reflection"]);
    }
}
