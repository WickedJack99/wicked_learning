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

    pub fn invalid_request() -> Self {
        Self {
            code: "invalid_request",
            status: StatusCode::BAD_REQUEST,
            title: "The request is not valid.",
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
