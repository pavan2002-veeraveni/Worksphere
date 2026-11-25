# Production Deployment, Security & Backup Verification Guide

## 1. Environment Topology

- **Reverse Proxy**: Nginx (`nginx/nginx.conf`) terminates TLS 1.2/1.3, enforces HSTS/CSP/X-Frame-Options headers, rate-limits `/api/v1/auth/` (`5 req/s`) and `/api/` (`30 req/s`), and proxies WebSockets (`/socket.io/`).
- **Private Internal Network**: `docker-compose.prod.yml` isolates `postgres`, `redis`, `worker`, and `python-service` inside `worksphere-internal` (`internal: true`) with zero host port bindings.
- **Non-Root Containers**: All Dockerfiles (`backend/Dockerfile`, `frontend/Dockerfile`, `python-service/Dockerfile`) execute under unprivileged `worksphere` (`uid=1001`) users with explicit `HEALTHCHECK` probes.
- **Secrets Management**: Secrets are supplied solely via runtime `.env` / GitHub Environment Secrets / cloud secret manager. Only `.env.example` with placeholders is committed.

## 2. Deployment Commands

```bash
# 1. Copy and configure production secrets
cp .env.example .env

# 2. Build and start stack with production overlay
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 3. Run database migrations & optional initial seed
docker compose exec api npx knex migrate:latest --env production

# 4. Verify service health
./scripts/healthcheck.sh
```

## 3. Backup & Restore Verification

```bash
# Create compressed pg_dump backup (custom format, level 9 compression)
./scripts/backup.sh production

# Verify restore onto staging / verification database
./scripts/restore.sh ./backups/worksphere_production_YYYYMMDD_HHMMSS.sql.gz staging
```

## 4. Monitoring & Observability

- **Express API**: `GET /health`, `GET /ready`, `GET /metrics` (Prometheus text & JSON), structured Winston JSON logs with `X-Request-ID`, `userId`, `orgId`, and PII/token redaction.
- **FastAPI Analytics**: `GET /health`, `GET /ready`, `GET /metrics`, structured JSON logs with `request_id`.
- **CI/CD Approval Gate & Rollback**: `.github/workflows/ci-cd.yml` builds/scans images, runs staging deployment on `develop`, requires manual approval for `production` environment on `main`, and `.github/workflows/rollback.yml` provides one-click rollback by commit SHA.
