use serde::Deserialize;
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_reflection::{
    LearnerReflectionError, LearnerReflectionRepository as LearnerReflectionRepositoryPort,
    LearnerReflectionSubmission,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerReflectionResult,
};

pub struct PostgresLearnerReflectionRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerReflectionRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct CurrentReflectionRow {
    activity_start_id: Option<Uuid>,
    activity_config: serde_json::Value,
    activity_id: Uuid,
    activity_type: String,
    activity_title: String,
    node_title: String,
    principal_id: Uuid,
}

#[derive(FromRow)]
struct JournalPageRow {
    markdown: String,
}

#[derive(Deserialize)]
struct ReflectionConfig {
    note: Option<String>,
    prompt: Option<String>,
    subtopic: Option<String>,
    topic: Option<String>,
    #[serde(rename = "learningIntent")]
    learning_intent: Option<String>,
    #[serde(rename = "feedbackGuidance")]
    feedback_guidance: Option<ReflectionFeedbackGuidance>,
}

#[derive(Deserialize)]
struct ReflectionFeedbackGuidance {
    #[serde(rename = "independentCheckPrompt")]
    independent_check_prompt: Option<String>,
    rubric: Option<Vec<String>>,
}

impl LearnerReflectionRepositoryPort for PostgresLearnerReflectionRepository<'_> {
    fn save_current_reflection(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        submission: LearnerReflectionSubmission<'_>,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerReflectionResult>, LearnerReflectionError>,
    > + Send {
        async move {
            save_current_reflection(self.pool, principal, play_run_id, activity_slug, submission)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not save learner reflection");
                    LearnerReflectionError
                })
        }
    }
}

async fn save_current_reflection(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
    submission: LearnerReflectionSubmission<'_>,
) -> Result<Option<LearnerReflectionResult>, sqlx::Error> {
    let reflection = submission.reflection.trim();
    if reflection.is_empty() || reflection.chars().count() > 20_000 {
        return Ok(None);
    }

    let mut transaction = pool.begin().await?;
    let Some(current) =
        load_current_reflection(&mut transaction, principal, play_run_id, activity_slug).await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let Ok(config) = serde_json::from_value::<ReflectionConfig>(current.activity_config) else {
        transaction.commit().await?;
        return Ok(None);
    };
    let prompt = config
        .prompt
        .as_deref()
        .map(str::trim)
        .filter(|prompt| !prompt.is_empty())
        .unwrap_or("What feels clearer now?");
    if config
        .note
        .as_deref()
        .is_some_and(|note| note.chars().count() > 2_000)
        || prompt.chars().count() > 2_000
    {
        transaction.commit().await?;
        return Ok(None);
    }

    let response_type = response_type(&config);
    let response_context = submission
        .response_context
        .map(str::trim)
        .unwrap_or_default();
    if response_type == "transfer" && response_context.is_empty() {
        transaction.commit().await?;
        return Ok(None);
    }
    let observed_cues = observed_cues(
        &config,
        response_type,
        current.activity_type == "review" || config.learning_intent.as_deref() == Some("review"),
        submission.observed_cues,
    );
    if submission.observed_cues.len() > 3
        || submission
            .observed_cues
            .iter()
            .any(|cue| cue.chars().count() > 300)
        || (submission.independent_check && !independent_check_is_available(&config, response_type))
    {
        transaction.commit().await?;
        return Ok(None);
    }

    let topic = config
        .topic
        .as_deref()
        .map(str::trim)
        .filter(|topic| !topic.is_empty())
        .unwrap_or(&current.node_title);
    let subtopic = config
        .subtopic
        .as_deref()
        .map(str::trim)
        .unwrap_or_default();
    if topic.chars().count() > 160 || subtopic.chars().count() > 160 {
        transaction.commit().await?;
        return Ok(None);
    }
    let journal_page_id =
        reflection_journal_page_id(&mut transaction, current.principal_id, topic, subtopic).await?;
    let page = sqlx::query_as::<_, JournalPageRow>(
        "SELECT markdown FROM learner_journal_pages WHERE id = $1 FOR UPDATE",
    )
    .bind(journal_page_id)
    .fetch_one(&mut *transaction)
    .await?;

    let question = if submission.independent_check {
        config
            .feedback_guidance
            .as_ref()
            .and_then(|guidance| guidance.independent_check_prompt.as_deref())
            .map(str::trim)
            .filter(|prompt| !prompt.is_empty())
            .expect("validated independent-check prompt")
    } else {
        prompt
    };
    let reflection_title = format!("{} - {}", current.node_title, current.activity_title);
    let _reflection_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO learner_reflections (principal_id, learner_journal_page_id, activity_id, activity_start_id, play_run_id, title, question, reflection, response_type, response_context, is_independent_check, observed_cues) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id",
    )
    .bind(current.principal_id)
    .bind(journal_page_id)
    .bind(current.activity_id)
    .bind(current.activity_start_id)
    .bind(play_run_id)
    .bind(&reflection_title)
    .bind(question)
    .bind(reflection)
    .bind(response_type)
    .bind((response_type == "transfer").then_some(response_context))
    .bind(submission.independent_check)
    .bind((!observed_cues.is_empty()).then_some(serde_json::json!(observed_cues)))
    .fetch_one(&mut *transaction)
    .await?;
    let journal_entry = format!(
        "## {reflection_title}\n\n**Question**  {question}\n\n**Reflection**  {reflection}"
    );
    let journal_entry = if response_type == "transfer" {
        format!("{journal_entry}\n\n**Changed context**  {response_context}")
    } else {
        journal_entry
    };
    let journal_entry = if observed_cues.is_empty() {
        journal_entry
    } else {
        format!(
            "{journal_entry}\n\n**What I noticed**  {}",
            observed_cues.join(" · ")
        )
    };
    let journal_entry = format!("{journal_entry}\n");
    let markdown = if page.markdown.trim().is_empty() {
        journal_entry
    } else {
        format!("{}\n\n{journal_entry}", page.markdown.trim_end())
    };
    sqlx::query("UPDATE learner_journal_pages SET markdown = $2, updated_at = NOW() WHERE id = $1")
        .bind(journal_page_id)
        .bind(markdown)
        .execute(&mut *transaction)
        .await?;

    transaction.commit().await?;

    Ok(Some(LearnerReflectionResult {
        play_run_id: play_run_id.to_string(),
        activity_slug: activity_slug.to_owned(),
        status: "saved".to_owned(),
    }))
}

fn response_type(config: &ReflectionConfig) -> &'static str {
    match config.learning_intent.as_deref() {
        Some("explain") => "explain",
        Some("transfer") => "transfer",
        _ => "reflection",
    }
}

fn independent_check_is_available(config: &ReflectionConfig, response_type: &str) -> bool {
    matches!(response_type, "explain" | "transfer")
        && config
            .feedback_guidance
            .as_ref()
            .and_then(|guidance| guidance.independent_check_prompt.as_deref())
            .is_some_and(|prompt| !prompt.trim().is_empty() && prompt.chars().count() <= 2_000)
}

/// The client may suggest selected labels, but the source only persists cues
/// that are authored for this activity. Keeping the normalization here also
/// means a stale browser cannot retain a cue removed from the activity.
fn observed_cues(
    config: &ReflectionConfig,
    response_type: &str,
    is_review: bool,
    requested: &[String],
) -> Vec<String> {
    if !is_review && !matches!(response_type, "explain" | "transfer") {
        return Vec::new();
    }

    let authored = config
        .feedback_guidance
        .as_ref()
        .and_then(|guidance| guidance.rubric.as_deref())
        .map_or_else(Vec::new, |cues| {
            cues.iter()
                .take(3)
                .filter_map(|cue| {
                    let cue = cue.trim();
                    (!cue.is_empty() && cue.chars().count() <= 300).then(|| cue.to_owned())
                })
                .collect()
        });

    authored
        .into_iter()
        .filter(|cue| requested.iter().any(|requested| requested == cue))
        .collect()
}

/// Reflection pages are categorized by authored topic/subtopic, while manual
/// journal pages may share that category. Serialize the small first-or-create
/// decision per principal/category so two reflection submissions cannot create
/// competing category pages after the manual-page uniqueness restriction was
/// removed. The oldest matching page remains the one reflections use, as in
/// the Laravel action's `firstOrCreate` lookup.
async fn reflection_journal_page_id(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    topic: &str,
    subtopic: &str,
) -> Result<Uuid, sqlx::Error> {
    let lock_key = format!("{principal_id}:{topic}:{subtopic}");
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
        .bind(lock_key)
        .execute(&mut **transaction)
        .await?;

    let existing = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM learner_journal_pages WHERE principal_id = $1 AND topic = $2 AND subtopic = $3 ORDER BY created_at ASC, id ASC LIMIT 1 FOR UPDATE",
    )
    .bind(principal_id)
    .bind(topic)
    .bind(subtopic)
    .fetch_optional(&mut **transaction)
    .await?;
    if let Some(existing) = existing {
        return Ok(existing);
    }

    sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO learner_journal_pages (principal_id, title, topic, subtopic) VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(principal_id)
    .bind(journal_page_title(topic, subtopic))
    .bind(topic)
    .bind(subtopic)
    .fetch_one(&mut **transaction)
    .await
}

async fn load_current_reflection(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<CurrentReflectionRow>, sqlx::Error> {
    let route = sqlx::query_as::<_, CurrentReflectionRow>(
        "SELECT progress.activity_start_id, activities.activity_config, activities.id AS activity_id, activities.activity_type, activities.title AS activity_title, FALSE AS is_revisit, nodes.title AS node_title, progress.principal_id, routes.id AS route_id FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type IN ('reflection', 'review') AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF progress",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await?;
    if route.is_some() {
        return Ok(route);
    }

    sqlx::query_as::<_, CurrentReflectionRow>(
        "SELECT NULL::uuid AS activity_start_id, activities.activity_config, activities.id AS activity_id, activities.activity_type, activities.title AS activity_title, TRUE AS is_revisit, nodes.title AS node_title, runs.principal_id, routes.id AS route_id FROM learner_revisit_runs AS runs INNER JOIN application_principals AS principals ON principals.id = runs.principal_id INNER JOIN learner_activity_check_ins AS check_ins ON check_ins.id = runs.check_in_id AND check_ins.principal_id = runs.principal_id AND check_ins.activity_id = runs.activity_id INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type IN ('reflection', 'review') AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF runs",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await
}

fn journal_page_title(topic: &str, subtopic: &str) -> String {
    let title = if subtopic.is_empty() {
        topic.to_owned()
    } else {
        format!("{topic} - {subtopic}")
    };
    title.chars().take(240).collect()
}

#[cfg(test)]
mod tests {
    use super::{
        ReflectionConfig, ReflectionFeedbackGuidance, independent_check_is_available,
        observed_cues, response_type,
    };

    #[test]
    fn transfer_only_retains_authored_selected_cues() {
        let config = ReflectionConfig {
            note: None,
            prompt: None,
            subtopic: None,
            topic: None,
            learning_intent: Some("transfer".to_owned()),
            feedback_guidance: Some(ReflectionFeedbackGuidance {
                independent_check_prompt: Some("Try it without looking back.".to_owned()),
                rubric: Some(vec![
                    "Names the changed context.".to_owned(),
                    "Connects the idea to the new situation.".to_owned(),
                ]),
            }),
        };
        let requested = vec![
            "Connects the idea to the new situation.".to_owned(),
            "Not an authored cue.".to_owned(),
        ];

        assert_eq!(response_type(&config), "transfer");
        assert!(independent_check_is_available(&config, "transfer"));
        assert_eq!(
            observed_cues(&config, "transfer", false, &requested),
            vec!["Connects the idea to the new situation."]
        );
    }

    #[test]
    fn base_reflection_cannot_claim_an_independent_check() {
        let config = ReflectionConfig {
            note: None,
            prompt: None,
            subtopic: None,
            topic: None,
            learning_intent: None,
            feedback_guidance: Some(ReflectionFeedbackGuidance {
                independent_check_prompt: Some("Try it without looking back.".to_owned()),
                rubric: Some(vec!["A cue.".to_owned()]),
            }),
        };

        assert_eq!(response_type(&config), "reflection");
        assert!(!independent_check_is_available(&config, "reflection"));
        assert!(observed_cues(&config, "reflection", false, &[]).is_empty());
    }

    #[test]
    fn review_retains_only_selected_authored_cues_without_becoming_an_explanation() {
        let config = ReflectionConfig {
            note: None,
            prompt: None,
            subtopic: None,
            topic: None,
            learning_intent: Some("review".to_owned()),
            feedback_guidance: Some(ReflectionFeedbackGuidance {
                independent_check_prompt: None,
                rubric: Some(vec!["Names a changed connection.".to_owned()]),
            }),
        };

        assert_eq!(response_type(&config), "reflection");
        assert_eq!(
            observed_cues(
                &config,
                "reflection",
                true,
                &["Names a changed connection.".to_owned()],
            ),
            vec!["Names a changed connection."]
        );
    }
}
