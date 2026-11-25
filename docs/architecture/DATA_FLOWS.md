# WorkSphere — Service & Data-Flow Diagrams

This document details how requests, mutations, asynchronous jobs, webhooks, and analytics data flow across WorkSphere services.

---

## 1. Role-Based Login, Workspace Selection & Token Rotation

```mermaid
sequenceDiagram
    actor User
    participant LoginUI as Next.js LoginPage & roles.ts
    participant Redux as Redux AuthSlice & localStorage
    participant API as Express /api/v1/auth
    participant DB as PostgreSQL

    User->>LoginUI: Select Role Dropdown & Submit Credentials
    LoginUI->>API: POST /api/v1/auth/login (email, password)
    API->>DB: Verify bcrypt hash + query organization_members roles
    DB-->>API: User + TokenPair + organizations[{id, name, role}]
    API-->>LoginUI: 200 OK { user, tokens, organizations }

    LoginUI->>LoginUI: resolveRoleLogin(user, selectedRole)
    alt Role Mismatch
        LoginUI->>API: POST /auth/logout (revoke token immediately)
        LoginUI->>Redux: clearAuth() & show authorized roles hint
    else Auto-Detect with Multiple Workspaces
        LoginUI-->>User: Render Step 2 Workspace & Role Session Picker
        User->>LoginUI: Select Organization / Role Card
        LoginUI->>Redux: setAuthSession(user, currentOrg, activeRole)
        LoginUI-->>User: Redirect to role landing route (/admin, /dashboard, /projects, /tasks, /audit-logs)
    else Single Authorized Match
        LoginUI->>Redux: setAuthSession(user, currentOrg, activeRole)
        LoginUI-->>User: Redirect to role landing route
    end

    Note over LoginUI,API: Token Refresh Reuse Detection
    User->>API: POST /auth/refresh-token (replayed old token)
    API->>DB: Token already revoked_at IS NOT NULL
    API->>DB: Revoke ALL active refresh_tokens for user_id
    API-->>LoginUI: 401 REFRESH_TOKEN_REUSED -> force sign-out
```

---

## 2. Concurrent Task Update (Optimistic Locking) & Atomic Audit Trail

```mermaid
sequenceDiagram
    participant UA as User A Browser (Task v1)
    participant UB as User B Browser (Task v1)
    participant API as Express TaskService
    participant DB as PostgreSQL Transaction
    participant WS as Socket.IO Server
    participant Q as Notification / Workflow Engine

    par Concurrent Edits on Same Task
        UA->>API: PUT /api/v1/tasks/:id { status: "in_progress", version: 1 }
        UB->>API: PUT /api/v1/tasks/:id { status: "done", version: 1 }
    end

    API->>DB: BEGIN TX -> UPDATE tasks SET status='in_progress', version=2 WHERE id=:id AND version=1
    DB-->>API: 1 row returned (version = 2)
    API->>DB: INSERT activity_log (field diff) + INSERT audit_events; COMMIT
    API->>WS: Emit task:updated to org, project, and task rooms
    API->>Q: Enqueue idempotent notification & evaluate workflow_rules
    API-->>UA: 200 OK { version: 2 }

    API->>DB: BEGIN TX -> UPDATE tasks SET status='done', version=2 WHERE id=:id AND version=1
    DB-->>API: 0 rows updated (current version is 2)
    API->>DB: ROLLBACK (no audit/activity written)
    API-->>UB: 409 Conflict (OPTIMISTIC_LOCK_CONFLICT, currentVersion: 2)
    UB->>UB: TaskDetail catches 409 -> displays warning & refreshes latest version
```

---

## 3. Workflow Automation, Idempotent Jobs & Dead-Letter Recovery

```mermaid
flowchart TD
    Event["Domain Event: task.created / task.status_changed / task.assigned / comment.created"] --> Engine["workflowEngine.evaluateRules(orgId, event, context)"]
    Engine --> QueryRules["Load active workflow_rules & matching conditions"]
    QueryRules --> ExecActions{"Action Type"}
    ExecActions -->|"change_status / assign_to / create_subtask"| TaskMut["Mutate tasks table"]
    ExecActions -->|"send_notification"| NotifSvc["notificationService.enqueueIdempotentNotification"]
    ExecActions -->|"outgoing_webhooks"| HookQueue["Enqueue webhook job -> BullMQ"]

    NotifSvc --> CheckRedis{"Redis / BullMQ Enabled?"}
    CheckRedis -->|"Yes"| BullQueue["BullMQ Notification Queue (attempts: 3, exp backoff)"]
    CheckRedis -->|"No (Local Fallback)"| SyncFallback["dbInsertIdempotentNotification"]

    BullQueue --> WorkerProc["notificationWorker.processNotificationJob"]
    WorkerProc --> Claim["withIdempotency: INSERT INTO processed_events ON CONFLICT DO NOTHING"]
    SyncFallback --> Claim

    Claim -->|"Conflict (Already Processed)"| Skip["Skip duplicate execution"]
    Claim -->|"Claimed"| Notify["Insert notifications row + Socket.IO push + Email (SMTP/jsonTransport)"]

    WorkerProc -->|"Failed after 3 retries"| DLQ["deadLetterHandler -> INSERT INTO dead_letter_jobs"]
    DLQ --> Recover["Owner triggers POST /integrations/dead-letter/:id/retry"]
```

---

## 4. Third-Party Integrations & Outgoing Webhooks Data Flow

```mermaid
sequenceDiagram
    participant Owner as Org Owner
    participant API as Express IntegrationController
    participant Stripe as Stripe Sandbox / API
    participant S3 as S3 / Signed Local Storage
    participant Hook as External Webhook Receiver

    Note over Owner,Stripe: Subscription & Signed Webhook Idempotency
    Owner->>API: POST /api/v1/integrations/billing/subscribe
    API->>Stripe: Create customer + subscription (sandbox fallback if placeholder key)
    API-->>Owner: 201 Created { subscriptionId, status }
    Stripe->>API: POST /api/v1/integrations/stripe/webhook (raw body + Stripe-Signature)
    API->>API: stripe.webhooks.constructEvent() + withIdempotency("stripe:" + event.id)
    API-->>Stripe: 200 OK { received: true, duplicate: false/true }

    Note over Owner,S3: Task Attachment Upload & Timing-Safe Download
    Owner->>API: POST /api/v1/tasks/:id/attachments (multipart/form-data)
    API->>S3: Upload file (S3 PUT with retry or local uploads/)
    API-->>Owner: 201 Created { storage_key, downloadUrl (HMAC signed, 15m TTL) }

    Note over API,Hook: Outgoing Signed Webhooks
    API->>Hook: POST webhookUrl + X-WorkSphere-Signature (HMAC-SHA256 timestamp.payload)
    Hook-->>API: HTTP 2xx -> record status "delivered" in webhook_deliveries
```

---

## 5. FastAPI Analytics Service & Streaming Python ETL Pipeline

```mermaid
flowchart LR
    subgraph OnlineAnalytics["Real-Time HTTP Analytics Path"]
        FE["Next.js /analytics Page"] -->|"GET /api/v1/integrations/analytics/*"| Proxy["Express analyticsProxyService (5s timeout, 2 attempts)"]
        Proxy -->|"X-API-Key + ?org_id=..."| FastAPI["FastAPI Service (:8000)"]
        FastAPI -->|"Tenant-Scoped Async SQLAlchemy"| PG[("PostgreSQL")]
        FastAPI -->|"GET /reports/:id"| Files["Generated CSV / JSON Exports"]
    end

    subgraph OfflineStreaming["Constant-Memory Streaming ETL (worksphere_processing)"]
        CSV["Large Task / Activity Export (CSV or JSONL)"] --> Stream["StreamProcessor Generators (yield row-by-row)"]
        Stream --> Valid["Pydantic Validators (raise or skip errors)"]
        Valid --> Calc["ProductivityCalculator & OverdueDetector"]
        Calc --> Out["ReportGenerator (productivity_summary.json, overdue_tasks.csv)"]
    end
```
