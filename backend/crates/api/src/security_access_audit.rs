use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

#[derive(FromRow)]
struct PendingSecurityAccessEvent {
    action: String,
    actor_subject_id: Uuid,
    changes: Value,
    id: Uuid,
    target_subject_id: Uuid,
}

/// Adds a source-shaped, credential-free factor event to the identity
/// transaction that changed the factor. The later delivery process can retry
/// independently without reapplying a browser command.
pub async fn queue_two_factor_change(
    transaction: &mut Transaction<'_, Postgres>,
    subject_id: Uuid,
    enabled: bool,
) -> Result<(), sqlx::Error> {
    let (action, changes) = two_factor_event(enabled);

    sqlx::query(
        "INSERT INTO identity_security_access_audit_outbox \
         (id, action, actor_subject_id, target_subject_id, changes) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(Uuid::new_v4())
    .bind(action)
    .bind(subject_id)
    .bind(subject_id)
    .bind(changes)
    .execute(&mut **transaction)
    .await?;

    Ok(())
}

fn two_factor_event(enabled: bool) -> (&'static str, Value) {
    let (action, before, after) = if enabled {
        (
            "two_factor_enabled",
            "Two-factor authentication disabled",
            "Two-factor authentication enabled",
        )
    } else {
        (
            "two_factor_disabled",
            "Two-factor authentication enabled",
            "Two-factor authentication disabled",
        )
    };
    let changes = json!({
        "security_factor": {
            "before": before,
            "after": after,
        }
    });

    (action, changes)
}

/// Moves a bounded batch of committed identity events into the existing
/// application-owned access history. The event ID is shared across databases,
/// so a crash after the application commit is retried without duplicate rows.
pub async fn deliver_pending(
    identity_database: &PgPool,
    application_database: &PgPool,
) -> Result<usize, sqlx::Error> {
    let mut identity_transaction = identity_database.begin().await?;
    let events = sqlx::query_as::<_, PendingSecurityAccessEvent>(
        "SELECT id, action, actor_subject_id, target_subject_id, changes \
         FROM identity_security_access_audit_outbox \
         WHERE delivered_at IS NULL \
         ORDER BY created_at, id \
         LIMIT 100 FOR UPDATE SKIP LOCKED",
    )
    .fetch_all(&mut *identity_transaction)
    .await?;
    if events.is_empty() {
        identity_transaction.commit().await?;
        return Ok(0);
    }

    let mut application_transaction = application_database.begin().await?;
    for event in &events {
        sqlx::query(
            "INSERT INTO application_access_change_events \
             (id, action, actor_subject_id, target_subject_id, changes) \
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING",
        )
        .bind(event.id)
        .bind(&event.action)
        .bind(event.actor_subject_id)
        .bind(event.target_subject_id)
        .bind(&event.changes)
        .execute(&mut *application_transaction)
        .await?;
    }
    application_transaction.commit().await?;

    let event_ids = events.iter().map(|event| event.id).collect::<Vec<_>>();
    sqlx::query(
        "UPDATE identity_security_access_audit_outbox SET delivered_at = NOW() \
         WHERE id = ANY($1) AND delivered_at IS NULL",
    )
    .bind(event_ids)
    .execute(&mut *identity_transaction)
    .await?;
    identity_transaction.commit().await?;

    Ok(events.len())
}

#[cfg(test)]
mod tests {
    use super::two_factor_event;

    #[test]
    fn source_factor_history_has_no_secret_material() {
        let (enabled_action, enabled) = two_factor_event(true);
        let (disabled_action, disabled) = two_factor_event(false);

        assert_eq!(enabled_action, "two_factor_enabled");
        assert_eq!(
            enabled["security_factor"]["before"],
            "Two-factor authentication disabled"
        );
        assert_eq!(
            enabled["security_factor"]["after"],
            "Two-factor authentication enabled"
        );
        assert_eq!(disabled_action, "two_factor_disabled");
        assert_eq!(
            disabled["security_factor"]["before"],
            "Two-factor authentication enabled"
        );
        assert_eq!(
            disabled["security_factor"]["after"],
            "Two-factor authentication disabled"
        );
        assert!(!enabled.to_string().contains("credential"));
        assert!(!enabled.to_string().contains("recovery"));
        assert!(!disabled.to_string().contains("credential"));
        assert!(!disabled.to_string().contains("recovery"));
    }
}
