use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_npc_dialogue::{
    LearnerNpcDialogueError, LearnerNpcDialogueRepository as LearnerNpcDialogueRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerNpcDialogueState,
};

pub struct PostgresLearnerNpcDialogueRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerNpcDialogueRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct CurrentDialogueRow {
    activity_id: Uuid,
    principal_id: Uuid,
}

#[derive(FromRow)]
struct DialogueStateRow {
    current_node_id: Uuid,
    history: Value,
}

impl LearnerNpcDialogueRepositoryPort for PostgresLearnerNpcDialogueRepository<'_> {
    fn continue_current_dialogue(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerNpcDialogueState>, LearnerNpcDialogueError>,
    > + Send {
        async move {
            continue_current_dialogue(self.pool, principal, play_run_id, activity_slug)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not continue NPC dialogue");
                    LearnerNpcDialogueError
                })
        }
    }

    fn answer_current_dialogue(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        answer_node_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerNpcDialogueState>, LearnerNpcDialogueError>,
    > + Send {
        async move {
            answer_current_dialogue(
                self.pool,
                principal,
                play_run_id,
                activity_slug,
                answer_node_id,
            )
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not answer NPC dialogue");
                LearnerNpcDialogueError
            })
        }
    }

    fn go_back_in_current_dialogue(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerNpcDialogueState>, LearnerNpcDialogueError>,
    > + Send {
        async move {
            go_back_in_current_dialogue(self.pool, principal, play_run_id, activity_slug)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not move back in NPC dialogue");
                    LearnerNpcDialogueError
                })
        }
    }
}

async fn continue_current_dialogue(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<LearnerNpcDialogueState>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(current) =
        load_current_dialogue_for_update(&mut transaction, principal, play_run_id, activity_slug)
            .await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let Some(state) = ensure_state_for_update(&mut transaction, &current, play_run_id).await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let node_type = node_type(&mut transaction, current.activity_id, state.current_node_id).await?;
    if !matches!(node_type.as_deref(), Some("npc_monologue") | Some("answer")) {
        transaction.commit().await?;
        return Ok(None);
    }
    let Some(next_node_id) = next_node_id(
        &mut transaction,
        current.activity_id,
        state.current_node_id,
        "out",
    )
    .await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let next = advance_state(
        &mut transaction,
        &current,
        play_run_id,
        state,
        next_node_id,
        true,
    )
    .await?;
    transaction.commit().await?;
    Ok(Some(next))
}

async fn answer_current_dialogue(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
    answer_node_id: Uuid,
) -> Result<Option<LearnerNpcDialogueState>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(current) =
        load_current_dialogue_for_update(&mut transaction, principal, play_run_id, activity_slug)
            .await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let Some(state) = ensure_state_for_update(&mut transaction, &current, play_run_id).await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    if node_type(&mut transaction, current.activity_id, state.current_node_id)
        .await?
        .as_deref()
        != Some("npc_question")
    {
        transaction.commit().await?;
        return Ok(None);
    }
    let is_authored_answer = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learning_npc_dialogue_transitions AS transitions INNER JOIN learning_npc_dialogue_nodes AS answers ON answers.id = transitions.to_node_id AND answers.activity_id = transitions.activity_id WHERE transitions.activity_id = $1 AND transitions.from_node_id = $2 AND transitions.to_node_id = $3 AND transitions.from_connector LIKE 'answer-%' AND answers.node_type = 'answer')",
    )
    .bind(current.activity_id)
    .bind(state.current_node_id)
    .bind(answer_node_id)
    .fetch_one(&mut *transaction)
    .await?;
    if !is_authored_answer {
        transaction.commit().await?;
        return Ok(None);
    }
    // The source player resets its back stack after choosing an answer so a
    // learner cannot reopen a resolved question through browser-local state.
    let next = advance_state(
        &mut transaction,
        &current,
        play_run_id,
        state,
        answer_node_id,
        false,
    )
    .await?;
    transaction.commit().await?;
    Ok(Some(next))
}

async fn go_back_in_current_dialogue(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<LearnerNpcDialogueState>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(current) =
        load_current_dialogue_for_update(&mut transaction, principal, play_run_id, activity_slug)
            .await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let Some(state) = ensure_state_for_update(&mut transaction, &current, play_run_id).await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let mut history = parse_history(&state.history);
    let Some(previous_node_id) = history.pop() else {
        transaction.commit().await?;
        return Ok(None);
    };
    sqlx::query(
        "UPDATE learner_npc_dialogue_states SET current_node_id = $1, history = $2, updated_at = NOW() WHERE principal_id = $3 AND play_run_id = $4 AND activity_id = $5",
    )
    .bind(previous_node_id)
    .bind(json!(history))
    .bind(current.principal_id)
    .bind(play_run_id)
    .bind(current.activity_id)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Some(LearnerNpcDialogueState {
        current_node_id: previous_node_id.to_string(),
        history: history.into_iter().map(|node| node.to_string()).collect(),
    }))
}

async fn load_current_dialogue_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<CurrentDialogueRow>, sqlx::Error> {
    sqlx::query_as::<_, CurrentDialogueRow>(
        "SELECT activities.id AS activity_id, progress.principal_id FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'npc_dialogue' AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF progress",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await
}

async fn ensure_state_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    current: &CurrentDialogueRow,
    play_run_id: Uuid,
) -> Result<Option<DialogueStateRow>, sqlx::Error> {
    let inserted = sqlx::query(
        "INSERT INTO learner_npc_dialogue_states (principal_id, play_run_id, activity_id, current_node_id) SELECT $1, $2, $3, transitions.to_node_id FROM learning_npc_dialogue_transitions AS transitions WHERE transitions.activity_id = $3 AND transitions.from_node_id IS NULL AND transitions.from_connector = 'out' ON CONFLICT (principal_id, play_run_id, activity_id) DO NOTHING",
    )
    .bind(current.principal_id)
    .bind(play_run_id)
    .bind(current.activity_id)
    .execute(&mut **transaction)
    .await?;
    let _ = inserted;
    sqlx::query_as::<_, DialogueStateRow>(
        "SELECT current_node_id, history FROM learner_npc_dialogue_states WHERE principal_id = $1 AND play_run_id = $2 AND activity_id = $3 FOR UPDATE",
    )
    .bind(current.principal_id)
    .bind(play_run_id)
    .bind(current.activity_id)
    .fetch_optional(&mut **transaction)
    .await
}

async fn node_type(
    transaction: &mut Transaction<'_, Postgres>,
    activity_id: Uuid,
    node_id: Uuid,
) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar::<_, String>(
        "SELECT node_type FROM learning_npc_dialogue_nodes WHERE activity_id = $1 AND id = $2",
    )
    .bind(activity_id)
    .bind(node_id)
    .fetch_optional(&mut **transaction)
    .await
}

async fn next_node_id(
    transaction: &mut Transaction<'_, Postgres>,
    activity_id: Uuid,
    node_id: Uuid,
    connector: &str,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT to_node_id FROM learning_npc_dialogue_transitions WHERE activity_id = $1 AND from_node_id = $2 AND from_connector = $3",
    )
    .bind(activity_id)
    .bind(node_id)
    .bind(connector)
    .fetch_optional(&mut **transaction)
    .await
}

async fn advance_state(
    transaction: &mut Transaction<'_, Postgres>,
    current: &CurrentDialogueRow,
    play_run_id: Uuid,
    state: DialogueStateRow,
    next_node_id: Uuid,
    remember_current: bool,
) -> Result<LearnerNpcDialogueState, sqlx::Error> {
    let mut history = if remember_current {
        parse_history(&state.history)
    } else {
        Vec::new()
    };
    if remember_current {
        history.push(state.current_node_id);
        if history.len() > 40 {
            history.remove(0);
        }
    }
    sqlx::query(
        "UPDATE learner_npc_dialogue_states SET current_node_id = $1, history = $2, updated_at = NOW() WHERE principal_id = $3 AND play_run_id = $4 AND activity_id = $5",
    )
    .bind(next_node_id)
    .bind(json!(history))
    .bind(current.principal_id)
    .bind(play_run_id)
    .bind(current.activity_id)
    .execute(&mut **transaction)
    .await?;
    Ok(LearnerNpcDialogueState {
        current_node_id: next_node_id.to_string(),
        history: history.into_iter().map(|node| node.to_string()).collect(),
    })
}

fn parse_history(value: &Value) -> Vec<Uuid> {
    serde_json::from_value::<Vec<Uuid>>(value.clone())
        .unwrap_or_default()
        .into_iter()
        .take(40)
        .collect()
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use uuid::Uuid;

    use super::parse_history;

    #[test]
    fn discards_tampered_or_unbounded_history() {
        assert!(parse_history(&json!(["not-a-uuid"])).is_empty());
        let history = (0..41).map(|_| Uuid::new_v4()).collect::<Vec<_>>();
        assert_eq!(parse_history(&json!(history)).len(), 40);
    }
}
