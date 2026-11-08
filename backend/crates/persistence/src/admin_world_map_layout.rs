use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::admin_world_map_layout::{
    AdminWorldMapLayoutError, AdminWorldMapLayoutRepository as Port, HexPosition,
    MapLayoutPreviewItem, MapLayoutPreviewPage, MapLayoutVersion, MapLayoutVersionPage,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

pub struct PostgresAdminWorldMapLayoutRepository<'pool> {
    pool: &'pool PgPool,
}
impl<'pool> PostgresAdminWorldMapLayoutRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}
impl Port for PostgresAdminWorldMapLayoutRepository<'_> {
    fn update_node_position(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        position: HexPosition,
    ) -> impl std::future::Future<Output = Result<Option<HexPosition>, AdminWorldMapLayoutError>> + Send
    {
        async move {
            update(self.pool, principal, node_id, position)
                .await
                .map_err(|_| AdminWorldMapLayoutError::Unavailable)
        }
    }
    fn list_versions(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        page: u32,
        per_page: u32,
    ) -> impl std::future::Future<
        Output = Result<Option<MapLayoutVersionPage>, AdminWorldMapLayoutError>,
    > + Send {
        async move {
            list(self.pool, principal, map_id, page, per_page)
                .await
                .map_err(|_| AdminWorldMapLayoutError::Unavailable)
        }
    }
    fn preview_version(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        version_id: Uuid,
        page: u32,
        per_page: u32,
    ) -> impl std::future::Future<
        Output = Result<Option<MapLayoutPreviewPage>, AdminWorldMapLayoutError>,
    > + Send {
        async move {
            preview(self.pool, principal, map_id, version_id, page, per_page)
                .await
                .map_err(|_| AdminWorldMapLayoutError::Unavailable)
        }
    }
    fn restore_version(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        version_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<()>, AdminWorldMapLayoutError>> + Send
    {
        async move {
            restore(self.pool, principal, map_id, version_id)
                .await
                .map_err(|_| AdminWorldMapLayoutError::Unavailable)
        }
    }
}
#[derive(FromRow)]
struct Node {
    id: Uuid,
    q: i32,
    r: i32,
    title: String,
}
async fn principal_id(
    tx: &mut Transaction<'_, Postgres>,
    p: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id=$1")
        .bind(p.subject_id)
        .fetch_optional(&mut **tx)
        .await
}
async fn allowed(
    tx: &mut Transaction<'_, Postgres>,
    p: &AuthorizedPrincipal,
    principal_id: Uuid,
    map_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let creator: Option<Uuid> =
        sqlx::query_scalar("SELECT created_by_principal_id FROM learning_maps WHERE id=$1")
            .bind(map_id)
            .fetch_optional(&mut **tx)
            .await?
            .flatten();
    let direct: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups e INNER JOIN learning_group_memberships m ON m.group_id=e.group_id WHERE e.map_id=$1 AND m.principal_id=$2)").bind(map_id).bind(principal_id).fetch_one(&mut **tx).await?;
    let Some(scope) = p.permission_scope("world_maps", "ru") else {
        return Ok(false);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && creator == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct)
        || direct)
}
async fn nodes(
    tx: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
    lock: bool,
) -> Result<Vec<Node>, sqlx::Error> {
    let suffix = if lock { " FOR UPDATE" } else { "" };
    sqlx::query_as(&format!("SELECT id, position_q AS q, position_r AS r, title FROM learning_nodes WHERE map_id=$1 ORDER BY id{suffix}")).bind(map_id).fetch_all(&mut **tx).await
}
async fn snapshot(
    tx: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
    principal_id: Uuid,
    values: &[Node],
) -> Result<(), sqlx::Error> {
    let snapshot = Value::Array(
        values
            .iter()
            .map(|n| json!({"nodeId":n.id,"positionQ":n.q,"positionR":n.r}))
            .collect(),
    );
    sqlx::query("INSERT INTO learning_map_layout_versions (id,map_id,changed_by_principal_id,snapshot) VALUES ($1,$2,$3,$4)").bind(Uuid::new_v4()).bind(map_id).bind(principal_id).bind(snapshot).execute(&mut **tx).await?;
    Ok(())
}
async fn update(
    pool: &PgPool,
    p: &AuthorizedPrincipal,
    node_id: Uuid,
    pos: HexPosition,
) -> Result<Option<HexPosition>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(pid) = principal_id(&mut tx, p).await? else {
        return Ok(None);
    };
    let map: Option<Uuid> =
        sqlx::query_scalar("SELECT map_id FROM learning_nodes WHERE id=$1 FOR UPDATE")
            .bind(node_id)
            .fetch_optional(&mut *tx)
            .await?;
    let Some(map) = map else { return Ok(None) };
    if !allowed(&mut tx, p, pid, map).await? {
        return Ok(None);
    };
    let all = nodes(&mut tx, map, true).await?;
    let Some(current) = all.iter().find(|node| node.id == node_id) else {
        return Ok(None);
    };
    if current.q == pos.q && current.r == pos.r {
        return Ok(Some(pos));
    }
    if all
        .iter()
        .any(|node| node.id != node_id && node.q == pos.q && node.r == pos.r)
    {
        return Ok(None);
    }
    snapshot(&mut tx, map, pid, &all).await?;
    sqlx::query(
        "UPDATE learning_nodes SET position_q=$2,position_r=$3,updated_at=NOW() WHERE id=$1",
    )
    .bind(node_id)
    .bind(pos.q)
    .bind(pos.r)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Some(pos))
}
async fn list(
    pool: &PgPool,
    p: &AuthorizedPrincipal,
    map: Uuid,
    page: u32,
    per: u32,
) -> Result<Option<MapLayoutVersionPage>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(pid) = principal_id(&mut tx, p).await? else {
        return Ok(None);
    };
    if !allowed(&mut tx, p, pid, map).await? {
        return Ok(None);
    };
    let current: Vec<Uuid> =
        sqlx::query_scalar("SELECT id FROM learning_nodes WHERE map_id=$1 ORDER BY id")
            .bind(map)
            .fetch_all(&mut *tx)
            .await?;
    let rows:Vec<(Uuid,Value,String)>=sqlx::query_as("SELECT id,snapshot,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') FROM learning_map_layout_versions WHERE map_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3").bind(map).bind(i64::from(per)).bind(i64::from(page.saturating_sub(1).saturating_mul(per))).fetch_all(&mut *tx).await?;
    let total: i64 =
        sqlx::query_scalar("SELECT count(*) FROM learning_map_layout_versions WHERE map_id=$1")
            .bind(map)
            .fetch_one(&mut *tx)
            .await?;
    tx.commit().await?;
    Ok(Some(MapLayoutVersionPage {
        items: rows
            .into_iter()
            .map(|(id, s, c)| {
                let positions = positions(&s);
                let ids = positions
                    .as_ref()
                    .map(|positions| sorted_ids(positions))
                    .unwrap_or_default();
                MapLayoutVersion {
                    id,
                    node_count: ids.len() as u32,
                    restorable: positions.is_some() && ids == current,
                    created_at: c,
                }
            })
            .collect(),
        page,
        per_page: per,
        total: total as u64,
        last_page: last_page(total, per),
    }))
}
fn sorted_ids(positions: &[(Uuid, HexPosition)]) -> Vec<Uuid> {
    let mut ids = positions.iter().map(|(id, _)| *id).collect::<Vec<_>>();
    ids.sort();
    ids
}

fn last_page(total: i64, per_page: u32) -> u32 {
    let total = u64::try_from(total).unwrap_or(0);
    let per_page = u64::from(per_page);
    u32::try_from(total.div_ceil(per_page).max(1)).unwrap_or(u32::MAX)
}
async fn preview(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_id: Uuid,
    version_id: Uuid,
    page: u32,
    per_page: u32,
) -> Result<Option<MapLayoutPreviewPage>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut transaction, principal).await? else {
        return Ok(None);
    };
    if !allowed(&mut transaction, principal, principal_id, map_id).await? {
        return Ok(None);
    }
    let version: Option<(Value, String)> = sqlx::query_as("SELECT snapshot, to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') FROM learning_map_layout_versions WHERE id=$1 AND map_id=$2")
        .bind(version_id).bind(map_id).fetch_optional(&mut *transaction).await?;
    let Some((snapshot, created_at)) = version else {
        return Ok(None);
    };
    let Some(positions) = positions(&snapshot) else {
        return Ok(None);
    };
    let current = nodes(&mut transaction, map_id, false).await?;
    let offset = usize::try_from(page.saturating_sub(1)).unwrap_or(0)
        * usize::try_from(per_page).unwrap_or(0);
    let items = positions
        .iter()
        .skip(offset)
        .take(per_page as usize)
        .map(|(id, position)| {
            let current_node = current.iter().find(|node| node.id == *id);
            MapLayoutPreviewItem {
                node_id: *id,
                position: *position,
                current_position: current_node.map(|node| HexPosition {
                    q: node.q,
                    r: node.r,
                }),
                title: current_node
                    .map(|node| node.title.clone())
                    .unwrap_or_else(|| "Removed node".to_owned()),
            }
        })
        .collect();
    transaction.commit().await?;
    Ok(Some(MapLayoutPreviewPage {
        version_id,
        created_at,
        items,
        page,
        per_page,
        total: positions.len() as u64,
        last_page: last_page(positions.len() as i64, per_page),
    }))
}
async fn restore(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_id: Uuid,
    version_id: Uuid,
) -> Result<Option<()>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut transaction, principal).await? else {
        return Ok(None);
    };
    if !allowed(&mut transaction, principal, principal_id, map_id).await? {
        return Ok(None);
    }
    let current = nodes(&mut transaction, map_id, true).await?;
    let stored_snapshot: Option<Value> = sqlx::query_scalar(
        "SELECT snapshot FROM learning_map_layout_versions WHERE id=$1 AND map_id=$2",
    )
    .bind(version_id)
    .bind(map_id)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(stored_snapshot) = stored_snapshot else {
        return Ok(None);
    };
    let Some(positions) = positions(&stored_snapshot) else {
        return Ok(None);
    };
    let mut current_ids = current.iter().map(|node| node.id).collect::<Vec<_>>();
    current_ids.sort();
    let snapshot_ids = sorted_ids(&positions);
    let unique = positions
        .iter()
        .map(|(_, p)| (p.q, p.r))
        .collect::<std::collections::HashSet<_>>()
        .len()
        == positions.len();
    if current_ids != snapshot_ids || !unique || snapshot_ids.len() != positions.len() {
        return Ok(None);
    }
    snapshot(&mut transaction, map_id, principal_id, &current).await?;
    let largest_coordinate = current.iter().fold(0_i64, |largest, node| {
        largest
            .max(i64::from(node.q).abs())
            .max(i64::from(node.r).abs())
    });
    let temporary_base = largest_coordinate
        .checked_add(1_000)
        .filter(|base| *base <= i64::from(i32::MAX))
        .ok_or(sqlx::Error::Protocol(
            "node coordinates leave no temporary restore range".into(),
        ))?;
    for (index, node) in current.iter().enumerate() {
        let coordinate = temporary_base
            .checked_add(i64::try_from(index).unwrap_or(i64::MAX))
            .filter(|coordinate| *coordinate <= i64::from(i32::MAX))
            .ok_or(sqlx::Error::Protocol(
                "too many nodes for temporary restore range".into(),
            ))?;
        sqlx::query("UPDATE learning_nodes SET position_q=$2, position_r=$3 WHERE id=$1")
            .bind(node.id)
            .bind(i32::try_from(coordinate).expect("bounded temporary coordinate"))
            .bind(i32::try_from(coordinate).expect("bounded temporary coordinate"))
            .execute(&mut *transaction)
            .await?;
    }
    for (id, position) in positions {
        sqlx::query(
            "UPDATE learning_nodes SET position_q=$2, position_r=$3, updated_at=NOW() WHERE id=$1",
        )
        .bind(id)
        .bind(position.q)
        .bind(position.r)
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await?;
    Ok(Some(()))
}

fn positions(value: &Value) -> Option<Vec<(Uuid, HexPosition)>> {
    value
        .as_array()?
        .iter()
        .map(|item| {
            Some((
                Uuid::parse_str(item.get("nodeId")?.as_str()?).ok()?,
                HexPosition {
                    q: i32::try_from(item.get("positionQ")?.as_i64()?).ok()?,
                    r: i32::try_from(item.get("positionR")?.as_i64()?).ok()?,
                },
            ))
        })
        .collect()
}
