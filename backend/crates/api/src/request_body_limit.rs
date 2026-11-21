use axum::{
    body::Body,
    extract::{MatchedPath, Request},
    http::Method,
    middleware::Next,
    response::Response,
};
use tower::{Layer, ServiceExt};
use tower_http::limit::RequestBodyLimitLayer;

/// Preserve the existing global ceiling except for the source map upload.
/// MatchedPath comes from Axum's router, not a client-provided header.
pub async fn enforce(request: Request, next: Next) -> Response {
    let scoped_upload = request.method() == Method::POST
        && request
            .extensions()
            .get::<MatchedPath>()
            .is_some_and(|path| {
                path.as_str() == "/api/v1/admin/world-builder/maps/{map_id}/visual-media"
            });
    let maximum = if scoped_upload {
        crate::admin_world_map_visual_media::MAX_MAP_VISUAL_BYTES
    } else {
        crate::account_profile_image::MAX_PROFILE_IMAGE_BYTES
    } + 16 * 1024;
    match RequestBodyLimitLayer::new(maximum)
        .layer(next.map_request(
            |request: axum::http::Request<tower_http::body::Limited<Body>>| request.map(Body::new),
        ))
        .oneshot(request)
        .await
    {
        Ok(response) => response.map(Body::new),
        Err(error) => match error {},
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use axum::{Router, middleware, routing::post};

    #[tokio::test]
    async fn only_the_matched_post_upload_gets_the_source_ceiling() {
        let app = Router::new()
            .route(
                "/api/v1/admin/world-builder/maps/{map_id}/visual-media",
                post(|| async { StatusCode::NO_CONTENT }),
            )
            .route("/ordinary", post(|| async { StatusCode::NO_CONTENT }))
            .layer(middleware::from_fn(enforce));
        for (method, path, size, status) in [
            (
                "POST",
                "/api/v1/admin/world-builder/maps/example/visual-media",
                6 * 1024 * 1024,
                StatusCode::NO_CONTENT,
            ),
            (
                "POST",
                "/api/v1/admin/world-builder/maps/example/visual-media",
                51 * 1024 * 1024,
                StatusCode::PAYLOAD_TOO_LARGE,
            ),
            (
                "GET",
                "/api/v1/admin/world-builder/maps/example/visual-media",
                6 * 1024 * 1024,
                StatusCode::PAYLOAD_TOO_LARGE,
            ),
            (
                "POST",
                "/ordinary",
                6 * 1024 * 1024,
                StatusCode::PAYLOAD_TOO_LARGE,
            ),
        ] {
            let request = Request::builder()
                .method(method)
                .uri(path)
                .header("content-length", size)
                .body(Body::empty())
                .unwrap();
            assert_eq!(app.clone().oneshot(request).await.unwrap().status(), status);
        }
    }
}
