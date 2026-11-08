use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, world_content::AdminDialogueTypingSoundSet,
};

const LETTERS: [&str; 26] = [
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s",
    "t", "u", "v", "w", "x", "y", "z",
];

#[derive(Clone, Debug, PartialEq)]
pub struct DialogueTypingSoundSetForm {
    pub is_default: bool,
    pub name: String,
    pub slug: String,
    pub tags: Vec<String>,
}

impl DialogueTypingSoundSetForm {
    pub fn parse(name: &str, slug: &str, tags: &[String], is_default: bool) -> Option<Self> {
        let name = name.trim();
        let slug = slug.trim();
        let tags = normalized_tags(tags)?;
        if name.is_empty()
            || name.chars().count() > 120
            || slug.is_empty()
            || slug.chars().count() > 120
            || !valid_slug(slug)
        {
            return None;
        }

        Some(Self {
            is_default,
            name: name.to_owned(),
            slug: slug.to_owned(),
            tags,
        })
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct DialogueTypingSoundAssignment {
    pub asset_id: Uuid,
    pub letter: String,
}

impl DialogueTypingSoundAssignment {
    pub fn parse(letter: &str, asset_id: Uuid) -> Option<Self> {
        let letter = letter.trim().to_ascii_lowercase();
        LETTERS
            .contains(&letter.as_str())
            .then_some(Self { asset_id, letter })
    }
}

pub fn complete_alphabet(assignments: &[DialogueTypingSoundAssignment]) -> bool {
    assignments.len() == LETTERS.len()
        && LETTERS.iter().all(|letter| {
            assignments
                .iter()
                .filter(|assignment| assignment.letter == *letter)
                .count()
                == 1
        })
}

fn normalized_tags(tags: &[String]) -> Option<Vec<String>> {
    if tags.len() > 12 {
        return None;
    }
    let mut normalized = Vec::new();
    for tag in tags {
        let tag = tag.trim();
        if tag.is_empty() || tag.chars().count() > 40 {
            return None;
        }
        if !normalized.iter().any(|existing: &String| existing == tag) {
            normalized.push(tag.to_owned());
        }
    }
    Some(normalized)
}

fn valid_slug(value: &str) -> bool {
    value
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminDialogueTypingSoundSetError {
    Conflict,
    Invalid,
    Unavailable,
}

pub trait AdminDialogueTypingSoundSetRepository {
    fn list(
        &self,
    ) -> impl Future<
        Output = Result<Vec<AdminDialogueTypingSoundSet>, AdminDialogueTypingSoundSetError>,
    > + Send;
    fn create(
        &self,
        form: &DialogueTypingSoundSetForm,
        assignments: &[DialogueTypingSoundAssignment],
    ) -> impl Future<Output = Result<AdminDialogueTypingSoundSet, AdminDialogueTypingSoundSetError>> + Send;
    fn update(
        &self,
        set_id: Uuid,
        form: &DialogueTypingSoundSetForm,
    ) -> impl Future<
        Output = Result<Option<AdminDialogueTypingSoundSet>, AdminDialogueTypingSoundSetError>,
    > + Send;
    fn replace_all(
        &self,
        set_id: Uuid,
        assignments: &[DialogueTypingSoundAssignment],
    ) -> impl Future<
        Output = Result<Option<DialogueTypingSoundSetMutation>, AdminDialogueTypingSoundSetError>,
    > + Send;
    fn replace_letter(
        &self,
        set_id: Uuid,
        assignment: &DialogueTypingSoundAssignment,
    ) -> impl Future<
        Output = Result<Option<DialogueTypingSoundSetMutation>, AdminDialogueTypingSoundSetError>,
    > + Send;
}

pub struct DialogueTypingSoundSetMutation {
    pub released_object_keys: Vec<String>,
    pub set: AdminDialogueTypingSoundSet,
}

pub struct AdminDialogueTypingSoundSetCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminDialogueTypingSoundSetCommand<'repository, Repository>
where
    Repository: AdminDialogueTypingSoundSetRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn list(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<Vec<AdminDialogueTypingSoundSet>>, AdminDialogueTypingSoundSetError> {
        if !principal.has_permission("sounds", "ro") {
            return Ok(None);
        }
        self.repository.list().await.map(Some)
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &DialogueTypingSoundSetForm,
        assignments: &[DialogueTypingSoundAssignment],
    ) -> Result<Option<AdminDialogueTypingSoundSet>, AdminDialogueTypingSoundSetError> {
        if !principal.has_permission("sounds", "ru") || !complete_alphabet(assignments) {
            return Ok(None);
        }
        self.repository.create(form, assignments).await.map(Some)
    }

    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        set_id: Uuid,
        form: &DialogueTypingSoundSetForm,
    ) -> Result<Option<AdminDialogueTypingSoundSet>, AdminDialogueTypingSoundSetError> {
        if !principal.has_permission("sounds", "ru") {
            return Ok(None);
        }
        self.repository.update(set_id, form).await
    }

    pub async fn replace_all(
        &self,
        principal: &AuthorizedPrincipal,
        set_id: Uuid,
        assignments: &[DialogueTypingSoundAssignment],
    ) -> Result<Option<DialogueTypingSoundSetMutation>, AdminDialogueTypingSoundSetError> {
        if !principal.has_permission("sounds", "ru") || !complete_alphabet(assignments) {
            return Ok(None);
        }
        self.repository.replace_all(set_id, assignments).await
    }

    pub async fn replace_letter(
        &self,
        principal: &AuthorizedPrincipal,
        set_id: Uuid,
        assignment: &DialogueTypingSoundAssignment,
    ) -> Result<Option<DialogueTypingSoundSetMutation>, AdminDialogueTypingSoundSetError> {
        if !principal.has_permission("sounds", "ru") {
            return Ok(None);
        }
        self.repository.replace_letter(set_id, assignment).await
    }
}

#[cfg(test)]
mod tests {
    use super::{DialogueTypingSoundAssignment, DialogueTypingSoundSetForm, complete_alphabet};
    use uuid::Uuid;

    #[test]
    fn retains_source_metadata_and_complete_alphabet_requirements() {
        assert!(
            DialogueTypingSoundSetForm::parse(
                "Soft keys",
                "soft-keys",
                &["dialogue".to_owned(), "typing".to_owned()],
                true,
            )
            .is_some()
        );
        assert!(DialogueTypingSoundSetForm::parse("Soft", "soft_keys-2", &[], false).is_some());
        assert!(DialogueTypingSoundSetForm::parse("Soft", "not a slug", &[], false).is_none());

        let complete = ('a'..='z')
            .map(|letter| {
                DialogueTypingSoundAssignment::parse(&letter.to_string(), Uuid::new_v4())
                    .expect("an alphabet letter")
            })
            .collect::<Vec<_>>();
        assert!(complete_alphabet(&complete));
        assert!(!complete_alphabet(&complete[..25]));
    }
}
