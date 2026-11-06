use axum::{
    body::{Body, Bytes},
    extract::State,
    http::{HeaderValue, header},
    response::Response,
};
use axum_login::AuthSession;
use futures_util::{StreamExt, future, stream};
use wicked_learning_application::learner_journal_export::{LearnerJournalExportQuery, format_page};
use wicked_learning_persistence::learner_journal_export::PostgresLearnerJournalExportRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

pub async fn download(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Response, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerJournalExportRepository::new(&state.application_database);
    let pages = LearnerJournalExportQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::forbidden)?;

    let page_chunks = pages.scan(true, |is_first_page, page| {
        let chunk = page.map(|page| {
            let separator = if *is_first_page { "" } else { "\n\n---\n\n" };
            *is_first_page = false;
            Bytes::from(format!("{separator}{}", format_page(&page)))
        });
        future::ready(Some(chunk))
    });
    let body = Body::from_stream(
        page_chunks.chain(stream::once(future::ready(Ok(Bytes::from_static(b"\n"))))),
    );
    let mut response = Response::new(body);
    let headers = response.headers_mut();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/markdown; charset=UTF-8"),
    );
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_static("attachment; filename=\"learning-journal.md\""),
    );
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );

    Ok(response)
}
