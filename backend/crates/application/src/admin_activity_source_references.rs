use std::collections::HashSet;

#[derive(Clone, Debug, PartialEq)]
pub struct ActivitySourceReferencesForm {
    pub references: Vec<ActivitySourceReference>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ActivitySourceReference {
    pub anchor: Option<String>,
    pub concepts: Vec<String>,
    pub excerpt: Option<String>,
    pub published_at: Option<String>,
    pub publisher: Option<String>,
    pub rights: Option<String>,
    pub title: String,
    pub url: String,
}

pub struct SubmittedActivitySourceReference<'a> {
    pub anchor: Option<&'a str>,
    pub concepts: Vec<&'a str>,
    pub excerpt: Option<&'a str>,
    pub published_at: Option<&'a str>,
    pub publisher: Option<&'a str>,
    pub rights: Option<&'a str>,
    pub title: Option<&'a str>,
    pub url: Option<&'a str>,
}

impl ActivitySourceReferencesForm {
    /// Mirrors the source activity editor: incomplete source cards are omitted,
    /// while each saved citation is retained as an activity-owned copy.
    pub fn parse(submitted: Vec<SubmittedActivitySourceReference<'_>>) -> Option<Self> {
        if submitted.len() > 5 {
            return None;
        }
        let mut references = Vec::with_capacity(submitted.len());
        for reference in submitted {
            let Some(title) = text(reference.title, 600) else {
                continue;
            };
            let Some(url) = text(reference.url, 2_000) else {
                continue;
            };
            references.push(ActivitySourceReference {
                anchor: text(reference.anchor, 600),
                concepts: concepts(reference.concepts),
                excerpt: text(reference.excerpt, 800),
                published_at: text(reference.published_at, 600),
                publisher: text(reference.publisher, 600),
                rights: text(reference.rights, 600),
                title,
                url,
            });
        }
        Some(Self { references })
    }
}

fn concepts(submitted: Vec<&str>) -> Vec<String> {
    let mut seen = HashSet::new();
    submitted
        .into_iter()
        .filter_map(|value| text(Some(value), 120))
        .filter(|value| seen.insert(value.to_lowercase()))
        .take(8)
        .collect()
}

fn text(value: Option<&str>, limit: usize) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(limit).collect())
}

#[cfg(test)]
mod tests {
    use super::{ActivitySourceReferencesForm, SubmittedActivitySourceReference};

    #[test]
    fn preserves_complete_copied_references_and_omits_incomplete_cards() {
        let form = ActivitySourceReferencesForm::parse(vec![
            SubmittedActivitySourceReference {
                anchor: Some(" chapter 2 "),
                concepts: vec!["Systems", "systems", "Practice"],
                excerpt: Some("  A bounded extract. "),
                published_at: None,
                publisher: Some(" A publisher "),
                rights: None,
                title: Some(" A source "),
                url: Some(" https://example.test/source "),
            },
            SubmittedActivitySourceReference {
                anchor: None,
                concepts: vec![],
                excerpt: None,
                published_at: None,
                publisher: None,
                rights: None,
                title: Some("Incomplete"),
                url: None,
            },
        ])
        .expect("valid source form");

        assert_eq!(form.references.len(), 1);
        assert_eq!(form.references[0].title, "A source");
        assert_eq!(form.references[0].concepts, ["Systems", "Practice"]);
        assert_eq!(form.references[0].anchor.as_deref(), Some("chapter 2"));
    }
}
