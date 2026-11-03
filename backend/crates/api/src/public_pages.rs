use axum::{
    Json,
    extract::{Path, State},
};
use wicked_learning_application::public_page::{PublicPageQuery, PublicPageSlug};
use wicked_learning_domain::platform_presentation::PublicPage;
use wicked_learning_persistence::public_page::PostgresPublicPageRepository;

use crate::{AppState, error::ApiError};

pub async fn show(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<PublicPage>, ApiError> {
    let slug = PublicPageSlug::parse(&slug).ok_or_else(ApiError::not_found)?;
    let repository = PostgresPublicPageRepository::new(&state.application_database);

    PublicPageQuery::new(&repository)
        .execute(&slug)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
