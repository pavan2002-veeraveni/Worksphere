# WorkSphere — Multi-Tenant Project Management & Workflow Automation Platform

WorkSphere is an enterprise multi-tenant SaaS platform built for organizations to plan projects, assign tasks, collaborate in real time, automate rule-driven workflows, and track team delivery metrics with strict tenant isolation.

## Architecture Overview

| Layer | Technology | Responsibility |
| --- | --- | --- |
| **Frontend** | Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, TanStack Query, Redux Toolkit, React Hook Form + Zod | Role-aware UI (`platform_admin`, `owner`, `project_manager`, `team_member`, `auditor`), Kanban boards, forms, Socket.IO client |
| **Core API** | Node.js, Express, TypeScript, Knex.js, Zod, BullMQ, Socket.IO, Winston | Versioned REST API (`/api/v1`), JWT + refresh token rotation, RBAC & tenant isolation, optimistic locking, workflow engine, webhooks |
| **Analytics Service** | Python 3, FastAPI, Pydantic v2, SQLAlchemy Async | Independently deployable analytics microservice (`/api/v1/analytics/*`) for project health, workload, cycle time, burndown, reports |
| **Streaming Package** | Python `worksphere_processing` | Memory-efficient generator/iterator CSV & JSONL export processor, productivity metrics, overdue detector, report writer |
| **Data & Cache** | PostgreSQL 16, Redis 7 | System of record (normalized multi-tenant schema, transactions, audit logs, DLQ) + BullMQ queues & caching |
| **Infra & CI/CD** | Docker, Docker Compose, Nginx, GitHub Actions | Multi-stage non-root containers, TLS reverse proxy, automated lint/test/security/build/deploy/rollback |

See [Architecture & ER Diagrams](docs/architecture/architecture.md), [15-Assessment Matrix](docs/assessments/README.md), [Deployment Guide](docs/DEPLOYMENT.md), and [Incident Response Runbooks](docs/INCIDENT_RESPONSE.md).

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 20+ and npm 10+
- Python 3.10+
- PostgreSQL 16 & Redis 7 (or Docker Compose)

### 1. Configure Environment
```bash
cp .env.example .env
```

### 2. Start via Docker Compose (Full Stack)
```bash
docker compose --profile dev up -d --build
docker compose exec api npx knex migrate:latest
docker compose exec api npx knex seed:run
```

Services:
- **Frontend**: `http://localhost:3000`
- **Express Core API**: `http://localhost:4000/api/v1` (Swagger UI: `http://localhost:4000/api-docs`)
- **FastAPI Analytics**: `http://localhost:8000` (Swagger UI: `http://localhost:8000/docs`)
- **MailHog UI (dev email)**: `http://localhost:8025`

### 3. Run Services Individually
```bash
# Backend API
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev

# Python Analytics Service
cd python-service && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000

# Python Streaming Package CLI
cd python-processing && pip install -e . && worksphere-process sample_data/tasks_export.csv --output-dir ./reports
```

---

## Automated Tests

```bash
# Backend unit & Supertest API integration tests (auth, RBAC, tenant isolation, 409 concurrency, idempotency, webhooks)
cd backend && npm test

# Frontend component tests & Playwright E2E
cd frontend && npm test
cd frontend && npx playwright test

# FastAPI analytics tests
cd python-service && pytest

# Streaming processing package tests & memory benchmark
cd python-processing && pytest && python benchmark.py
```

---

## Seed Credentials (Development Only)
All seeded accounts use password: `Password123!`
- **Platform Admin & Acme Owner**: `admin@worksphere.io`
- **Acme Project Manager / Globex Auditor**: `alice@acme.com`
- **Acme Team Member**: `bob@acme.com`
- **Globex Owner**: `carol@globex.com`
- **Globex Project Manager**: `dave@globex.com`

---

## Key Engineering Trade-offs & Decisions
1. **Knex.js vs Prisma/TypeORM**: Knex gives explicit SQL control over PostgreSQL `UPDATE ... WHERE id = ? AND version = ? RETURNING *` optimistic locks, `INSERT ... ON CONFLICT DO NOTHING` idempotency claims, and partial indexes without ORM abstraction overhead.
2. **Optimistic Locking (`version`) on Projects & Tasks**: Prevents silent concurrent overwrites (`HTTP 409 Conflict` with `currentVersion`) without holding long database row locks during user think-time.
3. **Database-backed Idempotency (`processed_events`)**: Redis/BullMQ guarantees at-least-once delivery; atomic PostgreSQL uniqueness claims guarantee at-most-once side effects for notifications and Stripe webhooks even across worker restarts.
4. **Streaming Python Generators**: `worksphere_processing` avoids `pandas` or in-memory lists, keeping peak heap usage flat (< 0.1 MB for 50,000 records).
