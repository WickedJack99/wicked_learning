use serde::Serialize;

/// A server-owned definition used to render qualitative competence evidence.
/// It is authoring configuration, not a learner score or interpretation.
#[derive(Clone, Debug, Serialize)]
pub struct AdminCompetenceTopic {
    pub slug: String,
    pub name: String,
    pub description: Option<String>,
    pub growth_threshold: f64,
    pub emittance_threshold: f64,
    pub aura_threshold: f64,
    pub is_active: bool,
}

/// Reusable authoring vocabulary. Activities retain a copied label rather than
/// a live relation, so later catalog changes cannot rewrite learner evidence.
#[derive(Clone, Debug, Serialize)]
pub struct AdminLearningConcept {
    pub slug: String,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminLearningTaxonomy {
    pub can_manage_competence_topics: bool,
    pub can_manage_learning_concepts: bool,
    pub competence_topics: Vec<AdminCompetenceTopic>,
    pub learning_concepts: Vec<AdminLearningConcept>,
}
