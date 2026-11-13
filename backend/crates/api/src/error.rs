use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;

#[derive(Serialize)]
pub struct ProblemResponse {
    pub code: &'static str,
    pub title: &'static str,
}

pub struct ApiError {
    code: &'static str,
    status: StatusCode,
    title: &'static str,
}

impl ApiError {
    pub fn not_found() -> Self {
        Self {
            code: "not_found",
            status: StatusCode::NOT_FOUND,
            title: "The requested resource was not found.",
        }
    }

    pub fn service_unavailable() -> Self {
        Self {
            code: "dependency_unavailable",
            status: StatusCode::SERVICE_UNAVAILABLE,
            title: "A required service is unavailable.",
        }
    }

    pub fn internal_server_error() -> Self {
        Self {
            code: "internal_error",
            status: StatusCode::INTERNAL_SERVER_ERROR,
            title: "The request could not be completed.",
        }
    }

    pub fn forbidden() -> Self {
        Self {
            code: "forbidden",
            status: StatusCode::FORBIDDEN,
            title: "The request is not allowed.",
        }
    }

    pub fn invalid_credentials() -> Self {
        Self {
            code: "invalid_credentials",
            status: StatusCode::UNAUTHORIZED,
            title: "The email address or password is not valid.",
        }
    }

    pub fn authentication_required() -> Self {
        Self {
            code: "authentication_required",
            status: StatusCode::UNAUTHORIZED,
            title: "Authentication is required.",
        }
    }

    pub fn password_confirmation_required() -> Self {
        Self {
            code: "password_confirmation_required",
            status: StatusCode::FORBIDDEN,
            title: "Password confirmation is required.",
        }
    }

    pub fn password_confirmation_rejected() -> Self {
        Self {
            code: "password_confirmation_rejected",
            status: StatusCode::UNPROCESSABLE_ENTITY,
            title: "The password could not be confirmed.",
        }
    }

    pub fn invalid_request() -> Self {
        Self {
            code: "invalid_request",
            status: StatusCode::BAD_REQUEST,
            title: "The request is not valid.",
        }
    }

    pub fn conflict() -> Self {
        Self {
            code: "conflict",
            status: StatusCode::CONFLICT,
            title: "The resource changed before this request could be saved.",
        }
    }

    pub fn registration_rejected() -> Self {
        Self {
            code: "registration_rejected",
            status: StatusCode::UNPROCESSABLE_ENTITY,
            title: "The account could not be created with these details.",
        }
    }

    pub fn password_update_rejected() -> Self {
        Self {
            code: "password_update_rejected",
            status: StatusCode::UNPROCESSABLE_ENTITY,
            title: "The password could not be updated with these details.",
        }
    }

    pub fn password_reset_request_rejected() -> Self {
        Self {
            code: "password_reset_request_rejected",
            status: StatusCode::UNPROCESSABLE_ENTITY,
            title: "A password reset link could not be sent for this email address.",
        }
    }

    pub fn password_reset_rejected() -> Self {
        Self {
            code: "password_reset_rejected",
            status: StatusCode::UNPROCESSABLE_ENTITY,
            title: "The password reset link or replacement password is not valid.",
        }
    }

    pub fn two_factor_setup_rejected() -> Self {
        Self {
            code: "two_factor_setup_rejected",
            status: StatusCode::UNPROCESSABLE_ENTITY,
            title: "The two-factor authentication setup could not be confirmed.",
        }
    }

    pub fn two_factor_challenge_rejected() -> Self {
        Self {
            code: "two_factor_challenge_rejected",
            status: StatusCode::UNAUTHORIZED,
            title: "The two-factor authentication code is not valid.",
        }
    }

    pub fn profile_update_rejected() -> Self {
        Self {
            code: "profile_update_rejected",
            status: StatusCode::UNPROCESSABLE_ENTITY,
            title: "The profile could not be updated with these details.",
        }
    }

    pub fn account_deletion_rejected() -> Self {
        Self {
            code: "account_deletion_rejected",
            status: StatusCode::UNPROCESSABLE_ENTITY,
            title: "The account could not be deleted with this password.",
        }
    }

    pub fn profile_image_rejected() -> Self {
        Self {
            code: "profile_image_rejected",
            status: StatusCode::UNPROCESSABLE_ENTITY,
            title: "The profile image could not be accepted.",
        }
    }

    pub fn journal_feedback_rejected() -> Self {
        Self {
            code: "journal_feedback_rejected",
            status: StatusCode::UNPROCESSABLE_ENTITY,
            title: "The journal feedback request cannot be completed.",
        }
    }

    pub fn ai_review_rejected() -> Self {
        Self {
            code: "ai_review_rejected",
            status: StatusCode::UNPROCESSABLE_ENTITY,
            title: "The activity review could not be completed safely.",
        }
    }

    pub fn content_plan_rejected() -> Self {
        Self {
            code: "content_plan_rejected",
            status: StatusCode::UNPROCESSABLE_ENTITY,
            title: "The ContentPlan draft could not be completed safely.",
        }
    }

    pub fn activity_template_rejected() -> Self {
        Self {
            code: "activity_template_rejected",
            status: StatusCode::UNPROCESSABLE_ENTITY,
            title: "NPC dialogue activities cannot be saved as reusable templates.",
        }
    }

    pub fn companion_turn_rejected() -> Self {
        Self {
            code: "companion_turn_rejected",
            status: StatusCode::UNPROCESSABLE_ENTITY,
            title: "The Learning Companion request cannot be completed safely.",
        }
    }

    pub fn too_many_requests() -> Self {
        Self {
            code: "rate_limited",
            status: StatusCode::TOO_MANY_REQUESTS,
            title: "Too many requests were made. Try again later.",
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(ProblemResponse {
                code: self.code,
                title: self.title,
            }),
        )
            .into_response()
    }
}
