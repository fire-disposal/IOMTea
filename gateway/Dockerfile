FROM rust:1.85-alpine AS builder
RUN apk add --no-cache musl-dev pkgconfig openssl-dev
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null; rm -rf src
COPY src src/
RUN cargo build --release --bin iomtea-gateway

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/target/release/iomtea-gateway /usr/local/bin/iomtea-gateway
EXPOSE 5858
ENTRYPOINT ["iomtea-gateway"]
