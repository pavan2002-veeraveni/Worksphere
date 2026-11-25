# WorkSphere — Complete Codebase Guide

A folder-by-folder map explaining every module in the WorkSphere repository.

---

## Top-Level Repository Structure

```text
Saas Model/
├── backend/                  # Node.js + Express + TypeScript REST API, Socket.IO & BullMQ workers
├── frontend/                 # Next.js 14 App Router + React 18 + Tailwind CSS frontend
├── database/                 # PostgreSQL Knex migrations (001..005) and deterministic dev seeds
├── python-service/           # Python FastAPI analytics & reporting microservice
├── python-processing/        # Streaming Python package (worksphere_processing) & CLI
├── nginx/                    # Production reverse proxy (rate limiting, TLS, CORS, WS upgrade)
├── scripts/                  # DB setup helper, pg_dump backup, restore, and healthcheck scripts
├── docs/                     # Architecture diagrams, OpenAPI YAML, Postman collection, runbooks
├── .github/                  # GitHub Actions CI/CD, rollback workflow, templates, CODEOWNERS
├── docker-compose.yml        # Full-stack multi-container dev topology (+ MailHog profile)
├── docker-compose.prod.yml   # Production network isolation & build target overlay
└── .env.example              # Safe environment variable template (no committed secrets)
```

---

## 1. Frontend (`frontend/`)

- **`src/app/(auth)/`**: Unauthenticated login & registration flows.
  - `login/page.tsx`: Role-based login portal with `Role` dropdown (`Auto-Detect`, `Platform Admin`, `Organization Owner`, `Project Manager`, `Team Member`, `Auditor`), strict role verification, and Step 2 multi-workspace selector.
  - `register/page.tsx`: User registration with Zod validation.
- **`src/app/(dashboard)/`**: Protected workspace routes guarded by `src/middleware.ts`, `(dashboard)/layout.tsx`, and `RoleGuard.tsx`.
  - `dashboard/page.tsx`: Role-aware overview KPIs, recent activity feed, and quick actions.
  - `projects/page.tsx` & `projects/[id]/page.tsx`: Project list filtering, creation modal, and detail tabs (`Overview`, `Tasks` Kanban board, `Milestones`, `Settings`).
  - `tasks/page.tsx`: Board/List views with `"Assigned to Me"` toggle and `TaskDetail` modal (optimistic lock conflict detection + comments).
  - `teams/page.tsx`: Teams grid, team creation, organization member directory, and colleague invitation form.
  - `workflows/page.tsx`: Event-driven workflow rule management (`platform_admin`, `owner`, `project_manager`).
  - `analytics/page.tsx`: FastAPI-backed completion rate, team workload distribution, and top projects dashboard.
  - `audit-logs/page.tsx`: Compliance audit log viewer (`platform_admin`, `owner`, `auditor`).
  - `settings/page.tsx`: User profile, active role badge, and owner-scoped organization rename form.
  - `admin/page.tsx`: Platform Administrator global multi-tenant telemetry console (`isPlatformAdmin` only).
- **`src/lib/`**:
  - `api.ts`: Axios client attaching Bearer JWT + `X-Org-ID`, handling single-flight refresh token rotation and preserving `status`/`code`/`response` on `ApiClientError`.
  - `auth.ts`: Token storage helpers (`localStorage` + `ws_authenticated` cookie) and `/auth/*` API calls.
  - `roles.ts`: `ROLE_METADATA`, `resolveRoleLogin`, `getEffectiveRole`, `canAccessRoute`, and `resolvePostLoginDestination`.
- **`src/store/` & `src/hooks/`**: Redux Toolkit (`authSlice`, `uiSlice`) + TanStack Query hooks (`useAuth`, `useProjects`, `useTasks`, `useNotifications` with Socket.IO live invalidation).
- **`tests/`**: Jest + React Testing Library specs (`tests/components/*.test.tsx`) and Playwright E2E specs (`tests/e2e/*.spec.ts`).

---

## 2. Backend Core API (`backend/`)

- **`src/app.ts` & `src/server.ts`**: Express app factory (security middleware, Swagger UI at `/api-docs`, versioned `/api/v1` router, `/health`, `/ready`, `/metrics`) and HTTP + Socket.IO server with `SIGTERM`/`SIGINT` graceful shutdown.
- **`src/config/`**: Environment configuration (`index.ts`), Knex PostgreSQL pool (`database.ts`), Redis client (`redis.ts`), Swagger JSDoc builder (`swagger.ts`).
- **`src/middleware/`**: `authenticate.ts`, `tenantContext.ts`, `authorize.ts`, `validate.ts`, `requestId.ts`, `errorHandler.ts`.
- **`src/routes/v1/` & `src/validators/`**: Modular v1 routes & Zod schemas for `auth`, `organizations`, `projects`, `tasks`, `teams`, `notifications`, `workflow-rules`, `integrations`, `admin`, and `activity` / `audit-log`.
- **`src/controllers/`, `src/services/`, `src/repositories/`**: Clean controller → service → repository separation; transactions wrap mutations alongside `activityService` + `auditService`.
- **`src/utils/`**: `optimisticLock.ts` (`version` checks throwing `409 ConflictError`), `idempotency.ts` (`withIdempotency` atomic claims), `logger.ts` (Winston JSON + request context), `metrics.ts` (Prometheus + JSON counters), `ApiError.ts`, `apiResponse.ts`, `pagination.ts`.
- **`src/jobs/` & `src/websocket/`**: BullMQ queues (`queue.ts`), standalone scheduler (`scheduler.ts`), dead-letter persistence (`deadLetterHandler.ts`), 4 background workers (`notificationWorker`, `reminderWorker`, `analyticsWorker`, `webhookWorker`), and tenant-verified Socket.IO rooms (`socketManager.ts`).
- **`src/integrations/`**: `emailService.ts`, `storageService.ts`, `stripeService.ts`, `webhookService.ts`, `calendarService.ts` (RFC 5545 `.ics` export).
- **`tests/`**: Supertest integration & unit suites (`auth.test.ts`, `tenant-and-concurrency.test.ts`, `core-modules.test.ts`, `idempotency-and-webhooks.test.ts`, `health-and-failure-paths.test.ts`) backed by `tests/helpers/mockDb.ts`.

---

## 3. Database (`database/`)

- **`migrations/`**: Five sequential schema migrations creating all 22 tables, check constraints, foreign keys, and query indexes.
- **`seeds/001_seed_data.ts`**: Deterministic dev data creating 2 tenant organizations (`Acme Corp`, `Globex Inc`), 5 users spanning all 5 roles, teams, projects, milestones, tasks, subtasks, comments, and activity history.

---

## 4. Python Analytics & Processing (`python-service/` & `python-processing/`)

- **`python-service/app/`**: FastAPI app (`main.py`), API routes (`api/analytics.py`, `api/health.py`), Pydantic v2 schemas (`models/schemas.py`), API-key guard (`core/security.py`), async SQLAlchemy queries (`services/analytics_service.py`, `services/report_service.py`).
- **`python-processing/worksphere_processing/`**: Lazy generator CSV/JSONL parser (`stream_processor.py`), validation (`validators.py`), KPI & team metrics (`metrics_calculator.py`), overdue detector (`overdue_detector.py`), CSV/JSON writer (`report_generator.py`), CLI entry point (`cli.py`), plus `benchmark.py` for memory profiling.

---

## 5. Operations, Security & CI/CD

- **`nginx/nginx.conf`**: Reverse proxy routing `/`, `/api/`, `/socket.io/`, `/api-docs`, and `/analytics/` with rate limiting, security headers, and `X-Org-ID` CORS support.
- **`scripts/`**: `ensure-db.js` (idempotent local Postgres bootstrap), `backup.sh` (`pg_dump` custom compressed archive + 30-day retention), `restore.sh`, and `healthcheck.sh`.
- **`.github/workflows/`**: `ci-cd.yml` (lint, typecheck, backend/frontend/Python tests with PostgreSQL/Redis services, npm/Safety/Trivy security scans, multi-stage Docker builds, Playwright E2E, staging, gated production deploy) and `rollback.yml`.
