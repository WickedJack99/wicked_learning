FROM rust:1.88-bookworm AS builder

WORKDIR /src

COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations

RUN cargo build --release --locked

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates wget \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system wicked \
    && useradd --system --gid wicked --create-home wicked \
    && install --directory --owner wicked --group wicked /var/lib/wicked-learning/media

COPY --from=builder /src/target/release/wicked-learning-api /usr/local/bin/wicked-learning-api

ENV LISTEN_ADDRESS=0.0.0.0:3000
ENV MEDIA_ROOT=/var/lib/wicked-learning/media

USER wicked

EXPOSE 3000

ENTRYPOINT ["wicked-learning-api"]
