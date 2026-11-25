# WorkSphere Incident Response Runbooks & Chaos Drill Evidence

This document covers all 6 mandatory operational drills for **Assessment 15 – Architecture and Incident Response**, including root-cause analysis (RCA), detection signals, mitigation steps, and regression test verification.

---

## Drill 1: Database Latency & Connection Pool Exhaustion
- **Simulation**: Inject slow query latency (`pg_sleep` or connection pool saturation) causing `acquireTimeoutMillis` failures.
- **Detection**:
  - `GET /ready` transitions to `HTTP 503` with `{"status": "degraded", "checks": {"database": "down"}}`.
  - Structured Winston JSON logs show pool acquisition timeouts correlated by `X-Request-ID`.
- **Immediate Mitigation**:
  1. Check active locks/long queries via `pg_stat_activity`.
  2. Verify Knex pool bounds (`DATABASE_POOL_MAX`, `acquireTimeoutMillis: 15000`).
  3. Scale read-heavy analytics calls to the FastAPI read pool or shed non-critical jobs.
- **Automated Verification**: `backend/tests/integration/health-and-failure-paths.test.ts` verifies `/ready` returns `503` when DB health check fails.

## Drill 2: Redis Outage / Queue Unavailability
- **Simulation**: Stop Redis container (`docker compose stop redis`).
- **Detection**:
  - `GET /ready` reports `{"checks": {"redis": "down"}}` (`503`).
  - Core REST API (`GET/POST/PUT /projects`, `/tasks`) **remains operational** because `enqueueJob()` catches queue unavailability gracefully and `notificationService` falls back to synchronous idempotent persistence.
- **Recovery**:
  1. Restart Redis (`docker compose start redis`).
  2. Re-run `./scripts/healthcheck.sh` to confirm `redis: up`.
  3. Retry any jobs recorded in `dead_letter_jobs` via `POST /api/v1/integrations/dead-letter/:id/retry`.

## Drill 3: Duplicate Background Jobs / Worker Restart Mid-Flight
- **Simulation**: Replay the same notification job payload 3 consecutive times (`processNotificationJob(payload)`).
- **Root Cause Risk**: BullMQ provides at-least-once delivery; worker crashes after sending email but before acking Redis cause duplicate job execution.
- **Defense Implemented**:
  - `backend/src/utils/idempotency.ts` (`withIdempotency`) performs an atomic `INSERT INTO processed_events (event_id, ...) ON CONFLICT (event_id) DO NOTHING RETURNING id`.
  - Only the first execution claims the event key; retries immediately skip and log `Duplicate notification job skipped via idempotency guard`.
- **Automated Verification**: `backend/tests/unit/idempotency-and-webhooks.test.ts` asserts 3 identical executions produce **exactly 1** notification row.

## Drill 4: External Email / Downstream Service Failure
- **Simulation**: Invalid SMTP host or unreachable FastAPI analytics service (`ECONNREFUSED`).
- **Behavior**:
  - `emailService.ts` retries 3 times with exponential backoff and 5–10s socket timeouts, preventing hung event loops.
  - After BullMQ `attempts: 3` exhaustion, `deadLetterHandler.recordFailure()` writes the full payload, error message, and stack trace to PostgreSQL `dead_letter_jobs`.
  - `analyticsProxyService.ts` fails fast with HTTP `503 SERVICE_UNAVAILABLE` without crashing Express.
- **Recovery Path**: Inspect `GET /api/v1/integrations/dead-letter` and replay after SMTP recovery with `POST /api/v1/integrations/dead-letter/:id/retry`.

## Drill 5: Stale / Concurrent Task Updates (Capstone Challenge)
- **Scenario**: User A and User B fetch Task `v1` simultaneously and both submit updates.
- **Root Cause Risk**: Last-write-wins overwrites silently erase User A's work and corrupt activity timelines.
- **Defense Implemented**:
  - `withOptimisticLock()` executes `UPDATE tasks SET ..., version = version + 1 WHERE id = $1 AND version = $2 RETURNING *` inside a PostgreSQL transaction.
  - Winner transitions task to `v2` and appends exact field diff to `activity_log` + `audit_events` atomically.
  - Loser receives `HTTP 409 Conflict` (`OPTIMISTIC_LOCK_CONFLICT`) containing `currentVersion` and `currentRecord` so the React UI (`TaskDetail.tsx`) alerts the user rather than overwriting silently.
- **Automated Verification**: `backend/tests/integration/tenant-and-concurrency.test.ts` fires `Promise.all` concurrent `PUT /api/v1/tasks/:id` requests and asserts `[200, 409]` + intact `activity_log`.

## Drill 6: Attempted Cross-Tenant Access
- **Scenario**: Authenticated owner of Globex Inc sends `X-Org-ID` for Acme Corp, or uses Globex `X-Org-ID` while requesting an Acme `projectId`.
- **Defense Implemented**:
  - `tenantContext.ts` verifies `(org_id, user_id)` membership in `organization_members` on every request -> returns `403 TENANT_ACCESS_DENIED`.
  - All repository queries (`projectRepository`, `taskRepository`, `teamRepository`) and FastAPI SQL queries (`JOIN projects p ON p.id = t.project_id WHERE p.org_id = :org_id`) scope by `org_id` -> mismatched entity IDs return `404`.
- **Automated Verification**: Tested in both `backend/tests/integration/tenant-and-concurrency.test.ts` and `python-service/tests/test_analytics.py`.
