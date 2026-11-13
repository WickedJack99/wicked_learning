use std::{
    sync::OnceLock,
    time::{Duration, Instant},
};

use axum::{
    body::Body,
    extract::{MatchedPath, Request},
    http::{StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
};
use futures_util::TryStreamExt;
use metrics::{Unit, counter, describe_counter, describe_histogram, histogram};
use metrics_exporter_prometheus::{PrometheusBuilder, PrometheusHandle};

const HTTP_REQUESTS: &str = "wicked_learning_http_requests_total";
const HTTP_REQUEST_DURATION_SECONDS: &str = "wicked_learning_http_request_duration_seconds";
const HTTP_RESPONSE_BODY_BYTES_TOTAL: &str = "wicked_learning_http_response_body_bytes_total";
const HTTP_RESPONSE_BODY_BYTES: &str = "wicked_learning_http_response_body_bytes";

static PROMETHEUS_HANDLE: OnceLock<PrometheusHandle> = OnceLock::new();

pub fn initialize() -> Result<(), String> {
    if PROMETHEUS_HANDLE.get().is_some() {
        return Ok(());
    }

    let handle = PrometheusBuilder::new()
        .install_recorder()
        .map_err(|error| format!("could not install Prometheus metrics recorder: {error}"))?;

    describe_counter!(
        HTTP_REQUESTS,
        "HTTP responses grouped by method, matched route, and status code."
    );
    describe_histogram!(
        HTTP_REQUEST_DURATION_SECONDS,
        Unit::Seconds,
        "HTTP request duration grouped by method, matched route, and status code."
    );
    describe_counter!(
        HTTP_RESPONSE_BODY_BYTES_TOTAL,
        Unit::Bytes,
        "HTTP response bytes streamed to the client, grouped by method, matched route, and status code."
    );
    describe_histogram!(
        HTTP_RESPONSE_BODY_BYTES,
        Unit::Bytes,
        "Known HTTP response body size grouped by method, matched route, and status code."
    );

    PROMETHEUS_HANDLE
        .set(handle)
        .map_err(|_| "Prometheus metrics recorder was initialized concurrently".to_owned())?;

    Ok(())
}

pub fn spawn_upkeep() {
    let Some(handle) = PROMETHEUS_HANDLE.get().cloned() else {
        return;
    };

    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        loop {
            interval.tick().await;
            handle.run_upkeep();
        }
    });
}

pub async fn scrape() -> Response {
    let Some(handle) = PROMETHEUS_HANDLE.get() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            "Prometheus metrics recorder is unavailable",
        )
            .into_response();
    };

    (
        [
            (header::CACHE_CONTROL, "no-store"),
            (
                header::CONTENT_TYPE,
                "text/plain; version=0.0.4; charset=utf-8",
            ),
        ],
        handle.render(),
    )
        .into_response()
}

pub async fn record_http_metrics(request: Request, next: Next) -> Response {
    let method = request.method().as_str().to_owned();
    let route = request
        .extensions()
        .get::<MatchedPath>()
        .map_or("unmatched", MatchedPath::as_str)
        .to_owned();
    let started_at = Instant::now();
    let response = next.run(request).await;

    if route != "/metrics" {
        let status = response.status().as_u16().to_string();

        counter!(
            HTTP_REQUESTS,
            "method" => method.clone(),
            "route" => route.clone(),
            "status" => status.clone(),
        )
        .increment(1);
        histogram!(
            HTTP_REQUEST_DURATION_SECONDS,
            "method" => method.clone(),
            "route" => route.clone(),
            "status" => status.clone(),
        )
        .record(started_at.elapsed().as_secs_f64());

        let response_body_bytes = counter!(
            HTTP_RESPONSE_BODY_BYTES_TOTAL,
            "method" => method.clone(),
            "route" => route.clone(),
            "status" => status.clone(),
        );

        if let Some(content_length) = response
            .headers()
            .get(header::CONTENT_LENGTH)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.parse::<u64>().ok())
        {
            histogram!(
                HTTP_RESPONSE_BODY_BYTES,
                "method" => method,
                "route" => route,
                "status" => status,
            )
            .record(content_length as f64);
        }

        let (parts, body) = response.into_parts();
        let stream = body.into_data_stream().inspect_ok(move |chunk| {
            response_body_bytes.increment(chunk.len() as u64);
        });

        return Response::from_parts(parts, Body::from_stream(stream));
    }

    response
}
