# WorkSphere — 15 Assessments Evidence & Implementation Matrix

This guide maps every mandatory Orion LMS assessment (Assessments 01–15) and the Capstone Challenge to its exact source files, automated tests, design trade-offs, and clearly distinguishes fully implemented capabilities from local sandbox adapters.

| # | Assessment | Key Implementation Paths | Automated Test Coverage |
| --- | --- | --- | --- |
| 01 | Frontend architecture | `frontend/src/app/`, `frontend/src/components/`, `frontend/src/store/` | `frontend/tests/components/*.test.tsx`, `frontend/tests/e2e/*.spec.ts` |
| 02 | Node.js/Express core API | `backend/src/routes/v1/`, `controllers/`, `services/`, `repositories/`, `validators/` | `backend/tests/integration/core-modules.test.ts` |
| 03 | PostgreSQL data model | `database/migrations/001..005`, `database/seeds/001_seed_data.ts`, `backend/knexfile.ts` | Verified by schema migrations & integration suite |
| 04 | Auth & authorization | `backend/src/services/authService.ts`, `middleware/authenticate.ts`, `authorize.ts`, `tenantContext.ts` | `backend/tests/integration/auth.test.ts`, `tenant-and-concurrency.test.ts` |
| 05 | Advanced Python processing | `python-processing/worksphere_processing/` (`stream_processor.py`, `metrics_calculator.py`, `overdue_detector.py`, `report_generator.py`) | `python-processing/tests/` + `benchmark.py` |
| 06 | FastAPI analytics service | `python-service/app/` (`main.py`, `api/analytics.py`, `services/analytics_service.py`, `report_service.py`) | `python-service/tests/test_analytics.py`, `test_health.py` |
| 07 | Real-time & job queues | `backend/src/websocket/socketManager.ts`, `backend/src/jobs/` (`queue.ts`, `workers/*`, `deadLetterHandler.ts`, `utils/idempotency.ts`) | `backend/tests/unit/idempotency-and-webhooks.test.ts` |
| 08 | Third-party integrations | `backend/src/integrations/` (`emailService.ts`, `storageService.ts`, `stripeService.ts`, `webhookService.ts`, `calendarService.ts`) | `backend/tests/unit/idempotency-and-webhooks.test.ts`, `core-modules.test.ts` |
| 09 | Docker & environments | `docker-compose.yml`, `docker-compose.prod.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `python-service/Dockerfile`, `.env.example` | Multi-stage non-root configs + health checks |
| 10 | Git & collaboration | `.github/CODEOWNERS`, `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/`, local Git commit history | Branch/PR review standards documented |
| 11 | CI/CD pipeline | `.github/workflows/ci-cd.yml`, `.github/workflows/rollback.yml` | Lint, typecheck, unit, security scan, Docker build, staging, gated prod, rollback |
| 12 | Testing strategy | `backend/tests/`, `frontend/tests/`, `python-service/tests/`, `python-processing/tests/` | Unit, API/Supertest, Python/HTTPX, RTL, Playwright E2E |
| 13 | API documentation | `backend/src/config/swagger.ts`, `/api-docs`, FastAPI `/docs`, `docs/api/openapi-backend.yaml`, `docs/api/worksphere.postman_collection.json` | Schema-validated endpoints |
| 14 | Production deployment | `nginx/nginx.conf`, `scripts/backup.sh`, `scripts/restore.sh`, `scripts/healthcheck.sh`, `docs/DEPLOYMENT.md` | Backup/restore & health scripts |
| 15 | Architecture & incident response | `docs/architecture/architecture.md`, `docs/INCIDENT_RESPONSE.md`, `backend/src/utils/optimisticLock.ts` | `backend/tests/integration/health-and-failure-paths.test.ts`, `tenant-and-concurrency.test.ts` |

## Explicit Sandbox / Mock Boundaries
In accordance with cohort guidelines (no real payment credentials or external SaaS keys):
- **Stripe (`stripeService.ts`)**: Uses Stripe SDK signature validation (`constructEvent`) for webhooks, and transparently falls back to deterministic sandbox IDs (`cus_sandbox_*`, `sub_sandbox_*`) when `STRIPE_SECRET_KEY` is the placeholder key.
- **Email (`emailService.ts`)**: Connects to SMTP / MailHog when `SMTP_HOST` is configured; falls back to Nodemailer's `jsonTransport` in test/unconfigured environments.
- **Object Storage (`storageService.ts`)**: Issues S3 PUT/GET/DELETE requests when `S3_ENDPOINT` + credentials are present; falls back to local signed filesystem storage under `backend/uploads/` otherwise.
- **Database Tests Locally**: Backend Jest suite runs against an in-memory transactional query adapter (`backend/tests/helpers/mockDb.ts`) when PostgreSQL is not running locally, while Knex migrations/seeds target PostgreSQL 16 in Docker/CI.
