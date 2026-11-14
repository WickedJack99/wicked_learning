use axum::{Json, extract::State};
use axum_login::AuthSession;
use std::collections::BTreeMap;

use serde::Serialize;
use uuid::Uuid;
use wicked_learning_application::account_profile::{AccountProfile, AccountProfileQuery};
use wicked_learning_application::current_user::{CurrentUser, CurrentUserQuery};
use wicked_learning_domain::learner_state::LearnerAppearance;
use wicked_learning_persistence::account_profile::PostgresAccountProfileRepository;
use wicked_learning_persistence::current_user::PostgresCurrentUserRepository;

use crate::{AppState, error::ApiError, identity::IdentityBackend};

#[derive(Serialize)]
pub struct CurrentUserResponse {
    pub appearance: LearnerAppearance,
    pub avatar_url: Option<String>,
    pub capabilities: Vec<String>,
    pub email: String,
    pub name: String,
    pub settings_access: BTreeMap<String, bool>,
    pub subject_id: Uuid,
    pub roles: Vec<String>,
    pub username: Option<String>,
}

pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<CurrentUserResponse>, ApiError> {
    let subject = auth_session
        .user
        .ok_or_else(ApiError::authentication_required)?;
    let subject_id = subject.subject_id();
    let repository = PostgresCurrentUserRepository::new(&state.application_database);
    let current_user = CurrentUserQuery::new(&repository)
        .execute(subject_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::forbidden)?;
    let profile_repository = PostgresAccountProfileRepository::new(
        &state.application_database,
        &state.identity_database,
    );
    let profile = AccountProfileQuery::new(&profile_repository)
        .execute(subject_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::forbidden)?;

    Ok(Json(current_user_response(
        current_user,
        subject.normalized_email().to_owned(),
        profile,
    )))
}

fn current_user_response(
    current_user: CurrentUser,
    email: String,
    profile: AccountProfile,
) -> CurrentUserResponse {
    CurrentUserResponse {
        appearance: current_user.appearance,
        avatar_url: profile
            .profile_image_id
            .map(|id| format!("/api/v1/profile-images/{id}")),
        capabilities: current_user
            .principal
            .capabilities
            .iter()
            .filter(|capability| !capability.starts_with("role_permission:"))
            .cloned()
            .collect(),
        email,
        name: profile.display_name,
        settings_access: settings_access(&current_user.principal),
        subject_id: current_user.principal.subject_id,
        roles: current_user.principal.roles,
        username: profile.public_username,
    }
}

/// Source-Settings visibility projection. Scopes stay server-side and each
/// selected API route still performs its full authorization check.
fn settings_access(
    principal: &wicked_learning_domain::identity_access::AuthorizedPrincipal,
) -> BTreeMap<String, bool> {
    [
        "ai",
        "assets",
        "companion",
        "competence_topics",
        "content_api",
        "group_members",
        "groups",
        "journal_feedback",
        "journal_settings",
        "languages",
        "learner_support_signals",
        "learning_concepts",
        "organization_moderation",
        "platform_feedback",
        "presentation",
        "roles",
        "sounds",
        "users",
        "world_activities",
        "world_map_access",
        "world_maps",
        "world_nodes",
    ]
    .into_iter()
    .map(|resource| {
        (
            resource.to_owned(),
            principal.has_permission(resource, "ro"),
        )
    })
    .collect()
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;
    use wicked_learning_application::{account_profile::AccountProfile, current_user::CurrentUser};
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal, learner_state::LearnerAppearance,
    };

    use super::{current_user_response, settings_access};

    #[test]
    fn projects_settings_visibility_without_leaking_scope() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::nil(),
            roles: vec!["world_author".to_owned()],
            capabilities: vec![
                "role_permission:world_maps:ru:assigned".to_owned(),
                "role_permission:world_nodes:ro:own".to_owned(),
            ],
        };

        let access = settings_access(&principal);

        assert_eq!(access.get("world_maps"), Some(&true));
        assert_eq!(access.get("world_nodes"), Some(&true));
        assert_eq!(access.get("world_activities"), Some(&false));
    }

    #[test]
    fn projects_only_the_current_subjects_source_account_chrome() {
        let subject_id = Uuid::new_v4();
        let profile_image_id = Uuid::new_v4();
        let response = current_user_response(
            CurrentUser {
                appearance: LearnerAppearance::Dark,
                principal: AuthorizedPrincipal {
                    subject_id,
                    roles: vec!["learner".to_owned()],
                    capabilities: vec!["role_permission:world_maps:ro:all".to_owned()],
                },
            },
            "learner@example.test".to_owned(),
            AccountProfile {
                display_name: "Learner Name".to_owned(),
                email: "learner@example.test".to_owned(),
                public_username: Some("learner_name".to_owned()),
                profile_image_id: Some(profile_image_id),
            },
        );

        assert_eq!(response.name, "Learner Name");
        assert_eq!(response.username.as_deref(), Some("learner_name"));
        assert_eq!(
            response.avatar_url.as_deref(),
            Some(format!("/api/v1/profile-images/{profile_image_id}").as_str()),
        );
        assert_eq!(response.subject_id, subject_id);
        assert_eq!(response.email, "learner@example.test");
    }
}
