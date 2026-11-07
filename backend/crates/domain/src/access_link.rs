use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AccessLinkPurpose {
    GrantTool,
    GrantItems,
}

impl AccessLinkPurpose {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::GrantTool => "grant_tool",
            Self::GrantItems => "grant_items",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "grant_tool" => Some(Self::GrantTool),
            "grant_items" => Some(Self::GrantItems),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AccessLinkUsagePolicy {
    OneTime,
    Multiple,
    PerUser,
}

impl AccessLinkUsagePolicy {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::OneTime => "one_time",
            Self::Multiple => "multiple",
            Self::PerUser => "per_user",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "one_time" => Some(Self::OneTime),
            "multiple" => Some(Self::Multiple),
            "per_user" => Some(Self::PerUser),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct AccessLinkSummary {
    pub created_at: String,
    pub expires_at: String,
    pub id: Uuid,
    pub is_enabled: bool,
    pub is_expired: bool,
    pub is_redeemed: bool,
    pub note: Option<String>,
    pub purpose: AccessLinkPurpose,
    pub usage_policy: AccessLinkUsagePolicy,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct AccessLinkGrantOption {
    pub id: Uuid,
    pub title: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct AccessLinkAdminData {
    pub items: Vec<AccessLinkGrantOption>,
    pub links: Vec<AccessLinkSummary>,
    pub tools: Vec<AccessLinkGrantOption>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct AccessLinkPreview {
    pub note: Option<String>,
    pub purpose: AccessLinkPurpose,
}
