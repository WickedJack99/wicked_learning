use uuid::Uuid;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuthorizedPrincipal {
    pub subject_id: Uuid,
    pub roles: Vec<String>,
}
