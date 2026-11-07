use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct OrganizationDirectory {
    pub organizations: Vec<OrganizationSummary>,
    pub pagination: OrganizationPagination,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct OrganizationPagination {
    pub current_page: i64,
    pub last_page: i64,
    pub per_page: i64,
    pub total: i64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct OrganizationSummary {
    pub description: Option<String>,
    pub governance_type: String,
    pub id: String,
    pub icon_url: Option<String>,
    pub member_count: i64,
    pub name: String,
    pub slogan: Option<String>,
    pub slug: String,
    pub viewer_join_request: Option<OrganizationJoinRequest>,
    pub viewer_membership: Option<OrganizationMembership>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct OrganizationDetail {
    pub can_moderate_messages: bool,
    pub can_send_messages: bool,
    pub description: Option<String>,
    pub governance_type: String,
    pub id: String,
    pub icon_url: Option<String>,
    pub is_leader: bool,
    pub leader_count: i64,
    pub leadership_rotated_at: Option<String>,
    pub member_count: i64,
    pub members: Vec<OrganizationMembership>,
    pub members_pagination: OrganizationPagination,
    pub messages: Vec<OrganizationMessage>,
    pub messages_pagination: Option<OrganizationPagination>,
    pub name: String,
    pub pending_join_requests: Vec<OrganizationJoinRequest>,
    pub pending_join_requests_pagination: Option<OrganizationPagination>,
    pub slogan: Option<String>,
    pub slug: String,
    pub viewer_join_request: Option<OrganizationJoinRequest>,
    pub viewer_membership: Option<OrganizationMembership>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct OrganizationIdentity {
    pub id: String,
    pub name: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct OrganizationMembership {
    pub id: String,
    pub joined_at: String,
    pub role: String,
    pub user: OrganizationIdentity,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct OrganizationJoinRequest {
    pub created_at: String,
    pub id: String,
    pub message: Option<String>,
    pub requester: OrganizationIdentity,
    pub status: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct OrganizationMessage {
    pub body: String,
    pub can_delete: bool,
    pub can_hide: bool,
    pub created_at: String,
    pub hidden_at: Option<String>,
    pub id: String,
    pub user: OrganizationIdentity,
}
