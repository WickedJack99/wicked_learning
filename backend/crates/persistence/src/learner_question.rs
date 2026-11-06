use serde::Deserialize;
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_question::{
    LearnerQuestionAnswerError, LearnerQuestionRepository as LearnerQuestionRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerQuestionAnswerResult, LearnerQuestionEarlierAttempt},
};

pub struct PostgresLearnerQuestionRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerQuestionRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct CurrentQuestionRow {
    activity_config: serde_json::Value,
    activity_id: Uuid,
    principal_id: Uuid,
}

#[derive(FromRow)]
struct TransitionRow {
    label: Option<String>,
    to_activity_id: Option<Uuid>,
}

#[derive(FromRow)]
struct CompletionAnswerRow {
    attempt_number: i32,
    calibration: Option<String>,
    confidence: Option<String>,
    is_correct: bool,
    selected_option_keys: serde_json::Value,
}

#[derive(FromRow)]
struct EarlierAnswerRow {
    answered_at: String,
    calibration: Option<String>,
    confidence: Option<String>,
    is_correct: bool,
    selected_option_keys: serde_json::Value,
}

/// The final question-completion command reuses the latest answer from the
/// same server-owned run. It never accepts a browser-supplied outcome or
/// transition after feedback has been shown.
pub(crate) struct QuestionCompletionAttempt {
    pub(crate) attempt_number: i32,
    pub(crate) calibration: Option<String>,
    pub(crate) confidence: Option<String>,
    pub(crate) is_correct: bool,
    pub(crate) next_activity_id: Option<Uuid>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuestionConfig {
    allow_multiple: bool,
    explanation: Option<String>,
    feedback_correct: Option<String>,
    feedback_incorrect: Option<String>,
    options: Vec<QuestionOption>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuestionOption {
    feedback: Option<String>,
    is_correct: bool,
    key: String,
    label: String,
    outcome_key: Option<String>,
}

impl LearnerQuestionRepositoryPort for PostgresLearnerQuestionRepository<'_> {
    fn answer_current_question(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        option_keys: &[String],
        confidence: Option<&str>,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerQuestionAnswerResult>, LearnerQuestionAnswerError>,
    > + Send {
        async move {
            answer_current_question(
                self.pool,
                principal,
                play_run_id,
                activity_slug,
                option_keys,
                confidence,
            )
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not answer learner question");
                LearnerQuestionAnswerError
            })
        }
    }
}

async fn answer_current_question(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
    option_keys: &[String],
    confidence: Option<&str>,
) -> Result<Option<LearnerQuestionAnswerResult>, sqlx::Error> {
    if option_keys.is_empty() || option_keys.len() > 24 || !valid_confidence(confidence) {
        return Ok(None);
    }
    let mut transaction = pool.begin().await?;
    let Some(current) =
        load_current_question(&mut transaction, principal, play_run_id, activity_slug).await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let Ok(config) = serde_json::from_value::<QuestionConfig>(current.activity_config) else {
        transaction.commit().await?;
        return Ok(None);
    };
    let selected = config
        .options
        .iter()
        .filter(|option| option_keys.contains(&option.key))
        .collect::<Vec<_>>();
    if selected.len() != option_keys.len()
        || selected.iter().any(|option| option.key.is_empty())
        || duplicate(option_keys)
        || (!config.allow_multiple && selected.len() != 1)
    {
        transaction.commit().await?;
        return Ok(None);
    }
    let correct_keys = config
        .options
        .iter()
        .filter(|option| option.is_correct)
        .map(|option| &option.key)
        .collect::<Vec<_>>();
    let is_correct =
        selected.len() == correct_keys.len() && selected.iter().all(|option| option.is_correct);
    let calibration = confidence.map(|value| calibration(is_correct, value).to_owned());
    let attempt_number = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM learner_question_answers WHERE principal_id = $1 AND activity_id = $2")
        .bind(current.principal_id).bind(current.activity_id).fetch_one(&mut *transaction).await? as i32 + 1;
    let transition = transition_for(
        &mut transaction,
        current.activity_id,
        selected
            .first()
            .and_then(|option| option.outcome_key.as_deref()),
        is_correct,
    )
    .await?;
    let selected_option_keys = option_keys.to_vec();
    sqlx::query("INSERT INTO learner_question_answers (principal_id, activity_id, play_run_id, selected_option_keys, is_correct, confidence, calibration, attempt_number) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)")
        .bind(current.principal_id).bind(current.activity_id).bind(play_run_id).bind(serde_json::json!(selected_option_keys)).bind(is_correct).bind(confidence).bind(&calibration).bind(attempt_number).execute(&mut *transaction).await?;
    let earlier_attempts = earlier_attempts(
        &mut transaction,
        current.principal_id,
        current.activity_id,
        attempt_number,
        &config.options,
    )
    .await?;
    transaction.commit().await?;
    let feedback = selected
        .first()
        .and_then(|option| option.feedback.clone())
        .or_else(|| {
            if is_correct {
                config.feedback_correct
            } else {
                config.feedback_incorrect
            }
        });
    Ok(Some(LearnerQuestionAnswerResult {
        play_run_id: play_run_id.to_string(),
        activity_slug: activity_slug.to_owned(),
        selected_option_keys,
        is_correct,
        feedback,
        explanation: config.explanation,
        confidence: confidence.map(str::to_owned),
        calibration,
        attempt_number,
        earlier_attempts,
        next_transition_label: transition.and_then(|transition| transition.label),
        status: "in_progress".to_owned(),
    }))
}

async fn earlier_attempts(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
    current_attempt_number: i32,
    options: &[QuestionOption],
) -> Result<Vec<LearnerQuestionEarlierAttempt>, sqlx::Error> {
    let attempts = sqlx::query_as::<_, EarlierAnswerRow>(
        "SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS answered_at, calibration, confidence, is_correct, selected_option_keys FROM learner_question_answers WHERE principal_id = $1 AND activity_id = $2 AND attempt_number < $3 ORDER BY attempt_number DESC LIMIT 3",
    )
    .bind(principal_id)
    .bind(activity_id)
    .bind(current_attempt_number)
    .fetch_all(&mut **transaction)
    .await?;

    Ok(attempts
        .into_iter()
        .filter_map(|attempt| {
            let selected_keys =
                serde_json::from_value::<Vec<String>>(attempt.selected_option_keys).ok()?;
            if selected_keys.is_empty() || duplicate(&selected_keys) {
                return None;
            }
            let option_labels = selected_keys
                .iter()
                .map(|key| {
                    options
                        .iter()
                        .find(|option| option.key == *key)
                        .map(|option| option.label.clone())
                })
                .collect::<Option<Vec<_>>>()?;

            Some(LearnerQuestionEarlierAttempt {
                answered_at: attempt.answered_at,
                calibration: attempt.calibration,
                confidence: attempt.confidence,
                is_correct: attempt.is_correct,
                option_label: option_labels.first().cloned(),
                option_labels,
            })
        })
        .collect())
}

pub(crate) async fn latest_answer_for_completion(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
    play_run_id: Uuid,
    activity_config: &serde_json::Value,
) -> Result<Option<QuestionCompletionAttempt>, sqlx::Error> {
    let Some(answer) = sqlx::query_as::<_, CompletionAnswerRow>(
        "SELECT attempt_number, calibration, confidence, is_correct, selected_option_keys FROM learner_question_answers WHERE principal_id = $1 AND activity_id = $2 AND play_run_id = $3 ORDER BY attempt_number DESC LIMIT 1",
    )
    .bind(principal_id)
    .bind(activity_id)
    .bind(play_run_id)
    .fetch_optional(&mut **transaction)
    .await?
    else {
        return Ok(None);
    };
    let Ok(config) = serde_json::from_value::<QuestionConfig>(activity_config.clone()) else {
        return Ok(None);
    };
    let Ok(selected_option_keys) =
        serde_json::from_value::<Vec<String>>(answer.selected_option_keys)
    else {
        return Ok(None);
    };
    let selected = config
        .options
        .iter()
        .filter(|option| selected_option_keys.contains(&option.key))
        .collect::<Vec<_>>();
    if selected_option_keys.is_empty()
        || selected.len() != selected_option_keys.len()
        || selected.iter().any(|option| option.key.is_empty())
        || duplicate(&selected_option_keys)
    {
        return Ok(None);
    }
    let transition = transition_for(
        transaction,
        activity_id,
        selected
            .first()
            .and_then(|option| option.outcome_key.as_deref()),
        answer.is_correct,
    )
    .await?;

    Ok(Some(QuestionCompletionAttempt {
        attempt_number: answer.attempt_number,
        calibration: answer.calibration,
        confidence: answer.confidence,
        is_correct: answer.is_correct,
        next_activity_id: transition.and_then(|transition| transition.to_activity_id),
    }))
}

async fn load_current_question(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<CurrentQuestionRow>, sqlx::Error> {
    let route = sqlx::query_as::<_, CurrentQuestionRow>("SELECT activities.activity_config, activities.id AS activity_id, progress.principal_id FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'question' AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF progress")
        .bind(principal.subject_id).bind(play_run_id).bind(activity_slug).bind(&principal.roles).fetch_optional(&mut **transaction).await?;
    if route.is_some() {
        return Ok(route);
    }

    sqlx::query_as::<_, CurrentQuestionRow>("SELECT activities.activity_config, activities.id AS activity_id, runs.principal_id FROM learner_revisit_runs AS runs INNER JOIN application_principals AS principals ON principals.id = runs.principal_id INNER JOIN learner_activity_check_ins AS check_ins ON check_ins.id = runs.check_in_id AND check_ins.principal_id = runs.principal_id AND check_ins.activity_id = runs.activity_id INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'question' AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF runs")
        .bind(principal.subject_id).bind(play_run_id).bind(activity_slug).bind(&principal.roles).fetch_optional(&mut **transaction).await
}

async fn transition_for(
    transaction: &mut Transaction<'_, Postgres>,
    activity_id: Uuid,
    outcome_key: Option<&str>,
    is_correct: bool,
) -> Result<Option<TransitionRow>, sqlx::Error> {
    let outcome = if let Some(outcome_key) = outcome_key {
        sqlx::query_as::<_, TransitionRow>("SELECT label, to_activity_id FROM learning_activity_transitions WHERE from_activity_id = $1 AND trigger = 'outcome' AND trigger_value = $2 ORDER BY created_at ASC, id ASC LIMIT 1").bind(activity_id).bind(outcome_key).fetch_optional(&mut **transaction).await?
    } else {
        None
    };
    if outcome.is_some() {
        return Ok(outcome);
    }
    sqlx::query_as::<_, TransitionRow>("SELECT label, to_activity_id FROM learning_activity_transitions WHERE from_activity_id = $1 AND trigger = $2 ORDER BY created_at ASC, id ASC LIMIT 1").bind(activity_id).bind(if is_correct { "correct" } else { "incorrect" }).fetch_optional(&mut **transaction).await
}

fn duplicate(keys: &[String]) -> bool {
    keys.iter()
        .enumerate()
        .any(|(index, key)| keys[..index].contains(key))
}
pub(crate) fn valid_confidence(value: Option<&str>) -> bool {
    value.is_none_or(|value| matches!(value, "exploring" | "leaning" | "settled"))
}
fn calibration(correct: bool, confidence: &str) -> &'static str {
    match (correct, confidence) {
        (true, "settled") => "aligned",
        (true, _) => "stronger_than_expected",
        (false, "settled") => "higher_than_result",
        (false, _) => "uncertainty_made_gap_visible",
    }
}

#[cfg(test)]
mod tests {
    use super::valid_confidence;

    #[test]
    fn accepts_only_the_source_defined_confidence_values() {
        assert!(valid_confidence(None));
        assert!(valid_confidence(Some("exploring")));
        assert!(valid_confidence(Some("leaning")));
        assert!(valid_confidence(Some("settled")));
        assert!(!valid_confidence(Some("certain")));
    }
}
