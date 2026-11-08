use std::collections::HashSet;

pub const LEARNING_INTENTS: [&str; 7] = [
    "apply",
    "explain",
    "participate",
    "reflect",
    "retrieve",
    "review",
    "transfer",
];

#[derive(Clone, Debug, PartialEq)]
pub struct LearningDesignForm {
    pub learning_intent: Option<String>,
    pub competence_topics: Vec<CompetenceTopic>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct CompetenceTopic {
    pub name: String,
    pub slug: String,
    pub weight: f64,
}

pub struct SubmittedCompetenceTopic<'a> {
    pub name: &'a str,
    pub weight: f64,
}

impl LearningDesignForm {
    /// Parses the source activity competence fields without accepting model
    /// output as a write instruction. The caller supplies this only after a
    /// tutor has reviewed and explicitly saved the editable draft.
    pub fn parse(
        learning_intent: Option<&str>,
        submitted_topics: Vec<SubmittedCompetenceTopic<'_>>,
    ) -> Option<Self> {
        if submitted_topics.len() > 20 {
            return None;
        }
        let learning_intent = learning_intent
            .map(str::trim)
            .filter(|value| !value.is_empty());
        if learning_intent.is_some_and(|value| !LEARNING_INTENTS.contains(&value)) {
            return None;
        }
        let mut topic_slugs = HashSet::new();
        let mut competence_topics = Vec::with_capacity(submitted_topics.len());
        for submitted in submitted_topics {
            let name = submitted.name.trim();
            if name.is_empty() || name.chars().count() > 120 || !submitted.weight.is_finite() {
                return None;
            }
            let weight = (submitted.weight * 100.0).round() / 100.0;
            if !(0.0 < weight && weight <= 1000.0) {
                return None;
            }
            let slug = topic_slug(name);
            if slug.is_empty() || !topic_slugs.insert(slug.clone()) {
                return None;
            }
            competence_topics.push(CompetenceTopic {
                name: name.to_owned(),
                slug,
                weight,
            });
        }
        Some(Self {
            learning_intent: learning_intent.map(str::to_owned),
            competence_topics,
        })
    }
}

fn topic_slug(value: &str) -> String {
    let mut slug = String::new();
    let mut separator = true;
    for character in deunicode::deunicode(value).chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character.to_ascii_lowercase());
            separator = false;
        } else if !separator {
            slug.push('-');
            separator = true;
        }
    }
    slug.trim_matches('-').chars().take(140).collect()
}

#[cfg(test)]
mod tests {
    use super::{LearningDesignForm, SubmittedCompetenceTopic};

    #[test]
    fn normalizes_source_learning_design_fields_and_rejects_duplicate_topics() {
        let form = LearningDesignForm::parse(
            Some(" explain "),
            vec![SubmittedCompetenceTopic {
                name: "Systems Thinking",
                weight: 1.234,
            }],
        )
        .expect("valid form");
        assert_eq!(form.learning_intent.as_deref(), Some("explain"));
        assert_eq!(form.competence_topics[0].slug, "systems-thinking");
        assert_eq!(form.competence_topics[0].weight, 1.23);
        assert!(
            LearningDesignForm::parse(
                None,
                vec![
                    SubmittedCompetenceTopic {
                        name: "Systems Thinking",
                        weight: 1.0
                    },
                    SubmittedCompetenceTopic {
                        name: "systems-thinking",
                        weight: 1.0
                    },
                ],
            )
            .is_none()
        );
    }
}
