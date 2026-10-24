# Architecture and Tech Stack Standards

## Microservice Architecture
- Core services are written in Python (FastAPI) or Go, communicating via gRPC internally and REST / GraphQL externally.
- All HTTP endpoints must provide strict Pydantic or OpenAPI schema definitions.
- Asynchronous tasks and event communication use Apache Kafka with Avro schema registry validation.

## Caching and Database Standards
- Use PostgreSQL as the relational source of truth with foreign key constraints and migration versioning via Alembic.
- Caching is managed via Redis clusters. All cached keys must specify an explicit Time-To-Live (TTL) to avoid memory exhaustion.
- Vector search queries are handled by ChromaDB for local experimentation and dedicated vector clusters in production.

## Telemetry & Observability
- All services must emit distributed traces using the OpenTelemetry SDK.
- Prometheus monitors error rates, p95/p99 request latencies, and CPU/memory utilization.
