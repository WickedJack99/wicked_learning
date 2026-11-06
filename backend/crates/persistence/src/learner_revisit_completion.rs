use serde_json::Value;
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

/// Values written to the immutable review record when a server-owned revisit
/// completes. Callers may supply only values already derived from the active
/// activity command; they do not choose the revisit or progress row.
pub(crate) struct RevisitCompletion<'value> {
    pub activity_id: Uuid,
    pub confidence: Option<&'value str>,
    pub confidence_after_feedback: Option<&'value str>,
    pub learner_reflection_id: Option<Uuid>,
    pub observed_cues: Option<Value>,
    pub outcome: &'value str,
    pub play_run_id: Uuid,
    pub principal_id: Uuid,
    pub response_type: Option<&'value str>,
}

#[derive(FromRow)]
struct LockedRevisitRow {
    attempt_count: i32,
    revisit_reason: String,
}

/// Atomically consumes a due invitation that owns `play_run_id`, records its
/// review attempt and completes that private run. The enclosing transaction
/// retains the activity-specific answer/reflection/evidence writes, so a
/// failure rolls back all effects together.
pub(crate) async fn complete_active_revisit(
    transaction: &mut Transaction<'_, Postgres>,
    completion: RevisitCompletion<'_>,
) -> Result<Option<i32>, sqlx::Error> {
    let locked = sqlx::query_as::<_, LockedRevisitRow>(
        "SELECT progress.attempt_count, runs.revisit_reason FROM learner_revisit_runs AS runs INNER JOIN learner_activity_progress AS progress ON progress.principal_id = runs.principal_id AND progress.activity_id = runs.activity_id AND progress.revisit_check_in_id = runs.check_in_id WHERE runs.id = $1 AND runs.principal_id = $2 AND runs.activity_id = $3 AND runs.status = 'in_progress' AND progress.status = 'completed' AND progress.revisit_status IN ('pending', 'snoozed') AND progress.revisit_available_at <= NOW() FOR UPDATE OF runs, progress",
    )
    .bind(completion.play_run_id)
    .bind(completion.principal_id)
    .bind(completion.activity_id)
    .fetch_optional(&mut **transaction)
    .await?;
    let Some(locked) = locked else {
        return Ok(None);
    };

    let Some(attempt_number) = next_review_attempt_number(locked.attempt_count) else {
        return Ok(None);
    };
    sqlx::query(
        "UPDATE learner_activity_progress SET attempt_count = $3, revisit_status = 'none', revisit_available_at = NULL, revisit_check_in_id = NULL, updated_at = NOW() WHERE principal_id = $1 AND activity_id = $2",
    )
    .bind(completion.principal_id)
    .bind(completion.activity_id)
    .bind(attempt_number)
    .execute(&mut **transaction)
    .await?;
    sqlx::query(
        "UPDATE learner_revisit_runs SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1",
    )
    .bind(completion.play_run_id)
    .execute(&mut **transaction)
    .await?;
    sqlx::query(
        "INSERT INTO learner_review_attempts (revisit_run_id, principal_id, activity_id, learner_reflection_id, attempt_number, outcome, confidence, confidence_after_feedback, observed_cues, revisit_reason, response_type, latency_seconds) SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, GREATEST(0, EXTRACT(EPOCH FROM (NOW() - started_at))::integer) FROM learner_revisit_runs WHERE id = $1",
    )
    .bind(completion.play_run_id)
    .bind(completion.principal_id)
    .bind(completion.activity_id)
    .bind(completion.learner_reflection_id)
    .bind(attempt_number)
    .bind(completion.outcome)
    .bind(completion.confidence)
    .bind(completion.confidence_after_feedback)
    .bind(completion.observed_cues)
    .bind(locked.revisit_reason)
    .bind(completion.response_type)
    .execute(&mut **transaction)
    .await?;

    Ok(Some(attempt_number))
}

fn next_review_attempt_number(completed_attempts: i32) -> Option<i32> {
    completed_attempts
        .checked_add(1)
        .filter(|attempt| *attempt >= 2)
}

#[cfg(test)]
mod tests {
    use super::next_review_attempt_number;

    #[test]
    fn review_attempt_numbers_follow_the_initial_completion_without_overflow() {
        assert_eq!(next_review_attempt_number(1), Some(2));
        assert_eq!(next_review_attempt_number(i32::MAX), None);
    }
}
