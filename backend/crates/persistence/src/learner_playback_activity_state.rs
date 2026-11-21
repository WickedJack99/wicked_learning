use serde_json::Value;
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_domain::learner_state::{
    LearnerPlaybackActivityProgress, LearnerPlaybackActivityState,
};

use crate::learner_item_obstacle::{configured_slots, load_state};

#[derive(FromRow)]
struct StateRow {
    activity_type: String,
    activity_config: Value,
    status: Option<String>,
    completed_at: Option<String>,
    has_item_state: bool,
    obstacle_resolved_at: Option<String>,
}

/// Called only after a command has locked and authorized this principal/activity
/// and its run or direct node context. Read before commit so the response
/// describes that same write, including terminal runs that cannot subsequently
/// be read as active.
pub(crate) async fn load(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
) -> Result<LearnerPlaybackActivityState, sqlx::Error> {
    let row = sqlx::query_as::<_, StateRow>(
        "SELECT a.activity_type,a.activity_config,p.status, \
         to_char(p.completed_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS completed_at, \
         EXISTS(SELECT 1 FROM learner_item_obstacle_states s WHERE s.principal_id=$1 AND s.activity_id=a.id) AS has_item_state, \
         to_char(o.resolved_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS obstacle_resolved_at \
         FROM learning_activities a \
         LEFT JOIN learner_activity_progress p ON p.activity_id=a.id AND p.principal_id=$1 \
         LEFT JOIN learner_obstacle_resolutions o ON o.activity_id=a.id AND o.principal_id=$1 \
         WHERE a.id=$2",
    )
    .bind(principal_id)
    .bind(activity_id)
    .fetch_one(&mut **transaction)
    .await?;
    let item_obstacle = if row.activity_type == "item_obstacle" && row.has_item_state {
        Some(
            load_state(
                transaction,
                principal_id,
                activity_id,
                &configured_slots(&row.activity_config),
            )
            .await?,
        )
    } else {
        None
    };
    Ok(LearnerPlaybackActivityState {
        activity_id,
        progress: row.status.map(|status| LearnerPlaybackActivityProgress {
            activity_id,
            status,
            completed_at: row.completed_at,
        }),
        item_obstacle,
        obstacle_resolved_at: row.obstacle_resolved_at,
    })
}
