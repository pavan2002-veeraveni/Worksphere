# WorkSphere — Database Entity-Relationship (ER) & Schema Guide

PostgreSQL 16 acts as the **single system of record** across WorkSphere, managed via **5 deterministic Knex migrations** (`database/migrations/001` through `005`) comprising **22 normalized tables**.

---

## 1. Core Multi-Tenant & Work Hierarchy ER Diagram (`001`–`003`)

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERS : has
    USERS ||--o{ ORGANIZATION_MEMBERS : joins
    ORGANIZATIONS ||--o{ INVITATIONS : issues
    USERS ||--o{ REFRESH_TOKENS : owns
    ORGANIZATIONS ||--o{ TEAMS : organizes
    TEAMS ||--o{ TEAM_MEMBERS : includes
    USERS ||--o{ TEAM_MEMBERS : belongs_to
    ORGANIZATIONS ||--o{ PROJECTS : owns
    TEAMS ||--o{ PROJECTS : assigned_to
    USERS ||--o{ PROJECTS : creates
    PROJECTS ||--o{ MILESTONES : tracks
    PROJECTS ||--o{ TASKS : contains
    MILESTONES ||--o{ TASKS : groups
    TASKS ||--o{ TASKS : subtask_of
    USERS ||--o{ TASKS : assigned_or_reported
    TASKS ||--o{ COMMENTS : discusses
    COMMENTS ||--o{ COMMENTS : replies_to
    TASKS ||--o{ ATTACHMENTS : stores
    COMMENTS ||--o{ ATTACHMENTS : attaches_to
    TASKS ||--o{ TASK_WATCHERS : watched_by
    USERS ||--o{ TASK_WATCHERS : watches

    ORGANIZATIONS {
        uuid id PK
        string name
        string slug UK
        string plan
        jsonb settings
        timestamp created_at
    }

    USERS {
        uuid id PK
        string email UK
        string password_hash
        string first_name
        string last_name
        boolean is_platform_admin
        boolean is_active
        timestamp last_login_at
    }

    ORGANIZATION_MEMBERS {
        uuid id PK
        uuid org_id FK
        uuid user_id FK
        string role
        uuid invited_by FK
        timestamp joined_at
    }

    INVITATIONS {
        uuid id PK
        uuid org_id FK
        string email
        string role
        string token UK
        string status
        timestamp expires_at
    }

    REFRESH_TOKENS {
        uuid id PK
        uuid user_id FK
        string token_hash UK
        timestamp expires_at
        timestamp revoked_at
    }

    TEAMS {
        uuid id PK
        uuid org_id FK
        string name
        text description
    }

    TEAM_MEMBERS {
        uuid id PK
        uuid team_id FK
        uuid user_id FK
        string role
    }

    PROJECTS {
        uuid id PK
        uuid org_id FK
        uuid team_id FK
        uuid created_by FK
        string name
        string status
        string priority
        date start_date
        date end_date
        int version
    }

    MILESTONES {
        uuid id PK
        uuid project_id FK
        string name
        date due_date
        string status
        int sort_order
    }

    TASKS {
        uuid id PK
        uuid project_id FK
        uuid milestone_id FK
        uuid parent_task_id FK
        uuid assignee_id FK
        uuid reporter_id FK
        string title
        string status
        string priority
        date due_date
        decimal estimated_hours
        decimal actual_hours
        int version
    }

    COMMENTS {
        uuid id PK
        uuid task_id FK
        uuid author_id FK
        uuid parent_comment_id FK
        text content
        boolean is_edited
    }

    ATTACHMENTS {
        uuid id PK
        uuid task_id FK
        uuid comment_id FK
        uuid uploaded_by FK
        string file_name
        bigint file_size
        string mime_type
        string storage_key
    }

    TASK_WATCHERS {
        uuid task_id PK
        uuid user_id PK
    }
```

---

## 2. Activity, Audit, Workflow, Idempotency & Integration ER Diagram (`004`–`005`)

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ ACTIVITY_LOG : records
    PROJECTS ||--o{ ACTIVITY_LOG : scopes
    TASKS ||--o{ ACTIVITY_LOG : tracks
    ORGANIZATIONS ||--o{ AUDIT_EVENTS : audits
    ORGANIZATIONS ||--o{ NOTIFICATIONS : scopes
    USERS ||--o{ NOTIFICATIONS : receives
    ORGANIZATIONS ||--o{ WORKFLOW_RULES : configures
    PROJECTS ||--o{ WORKFLOW_RULES : optional_scope
    ORGANIZATIONS ||--o{ OUTGOING_WEBHOOKS : registers
    OUTGOING_WEBHOOKS ||--o{ WEBHOOK_DELIVERIES : logs
    ORGANIZATIONS ||--o| SUBSCRIPTIONS : bills
    ORGANIZATIONS ||--o{ DEAD_LETTER_JOBS : tracks_failures

    ACTIVITY_LOG {
        uuid id PK
        uuid org_id FK
        uuid project_id FK
        uuid task_id FK
        uuid actor_id FK
        string action
        string entity_type
        uuid entity_id
        jsonb changes
        jsonb metadata
        timestamp created_at
    }

    AUDIT_EVENTS {
        uuid id PK
        uuid org_id FK
        uuid actor_id FK
        string action
        string resource_type
        uuid resource_id
        inet ip_address
        uuid request_id
        jsonb old_values
        jsonb new_values
        timestamp created_at
    }

    NOTIFICATIONS {
        uuid id PK
        uuid org_id FK
        uuid user_id FK
        string type
        string title
        text message
        boolean is_read
        jsonb metadata
    }

    WORKFLOW_RULES {
        uuid id PK
        uuid org_id FK
        uuid project_id FK
        string name
        string trigger_event
        jsonb conditions
        jsonb actions
        boolean is_active
    }

    PROCESSED_EVENTS {
        uuid id PK
        string event_id UK
        string event_type
        timestamp processed_at
        jsonb result
    }

    OUTGOING_WEBHOOKS {
        uuid id PK
        uuid org_id FK
        string name
        text url
        text_array events
        string secret
        boolean is_active
    }

    WEBHOOK_DELIVERIES {
        uuid id PK
        uuid webhook_id FK
        uuid org_id FK
        string event_type
        string delivery_id UK
        int status_code
        string status
        int attempt_count
    }

    SUBSCRIPTIONS {
        uuid id PK
        uuid org_id UK
        string stripe_customer_id
        string stripe_subscription_id
        string plan
        string status
    }

    DEAD_LETTER_JOBS {
        uuid id PK
        string queue_name
        string job_id
        string job_name
        uuid org_id FK
        jsonb payload
        text error_message
        int attempts_made
        string status
    }
```

---

## 3. Constraints, Indexes & Concurrency Decisions

| Migration | Table(s) | Key Constraints & Indexes | Design Rationale |
| --- | --- | --- | --- |
| `001` | `organizations`, `users`, `organization_members`, `invitations`, `refresh_tokens` | `UNIQUE(org_id, user_id)`, `CHECK(role IN ('owner','project_manager','team_member','auditor'))`, `CHECK(status IN ('pending','accepted','expired','revoked'))` | Prevents duplicate memberships; stores SHA-256 hashes of refresh tokens for instant reuse detection |
| `002` | `teams`, `team_members`, `projects`, `milestones` | `UNIQUE(team_id, user_id)`, `idx_projects_org_status`, `idx_projects_team`, `idx_milestones_project`, `version` integer | Composite `(org_id, status)` index accelerates filtered tenant listings; `version` enables conflict-safe project updates |
| `003` | `tasks`, `comments`, `attachments`, `task_watchers` | `CHECK(status ...)`, `CHECK(priority ...)`, `idx_tasks_project_status`, `idx_tasks_assignee`, `idx_tasks_parent`, `PRIMARY KEY(task_id, user_id)` | Self-referential `parent_task_id` and `parent_comment_id` model subtasks and threaded replies without extra join tables |
| `004` | `activity_log`, `audit_events`, `notifications`, `workflow_rules`, `processed_events` | `idx_activity_org_created`, `idx_activity_task`, `idx_audit_org_created`, `idx_notifications_user_read`, `UNIQUE(event_id)` on `processed_events` | `UNIQUE(event_id)` provides atomic idempotency claims (`INSERT ... ON CONFLICT DO NOTHING`) across workers |
| `005` | `outgoing_webhooks`, `webhook_deliveries`, `subscriptions`, `dead_letter_jobs` | `UNIQUE(delivery_id)`, `UNIQUE(org_id)` on `subscriptions`, `idx_webhooks_org_active`, `idx_dlq_queue_status` | Persists webhook delivery telemetry, single active subscription per org, and retryable dead-letter payloads |
