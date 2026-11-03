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
