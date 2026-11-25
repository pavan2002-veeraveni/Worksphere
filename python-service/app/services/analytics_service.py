"""Analytics business-logic service layer.

All queries enforce tenant isolation by joining through projects and filtering on org_id.
"""

from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import text

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging_config import get_logger
from app.models.schemas import (
    AnalyticsSummary,
    BurndownPoint,
    CycleTimeResponse,
    DeliveryMetrics,
    MemberWorkload,
    ProjectHealthResponse,
    TimeRange,
    WorkloadResponse,
)

logger = get_logger(__name__)


class ProjectNotFoundError(Exception):
    """Raised when a project does not exist or does not belong to the tenant."""


async def _ensure_project_in_org(db: AsyncSession, org_id: UUID, project_id: UUID) -> None:
    """Verify the project belongs to the given organization for tenant isolation."""
    query = text("SELECT id FROM projects WHERE id = :project_id AND org_id = :org_id")
    result = await db.execute(query, {"project_id": str(project_id), "org_id": str(org_id)})
    if result.first() is None:
        raise ProjectNotFoundError(f"Project {project_id} not found for organization {org_id}")


async def calculate_project_health(
    db: AsyncSession,
    org_id: UUID,
    project_id: UUID,
) -> ProjectHealthResponse:
    """Compute health metrics for a single project.

    Health score weighting:
    - Completion rate: 40 %
    - Overdue penalty: 30 % (inverted - fewer overdue -> higher score)
    - Cycle time:      30 % (capped contribution; shorter -> better)
    """
    await _ensure_project_in_org(db, org_id, project_id)

    task_query = text("""
        SELECT
            COUNT(*)                                                           AS total_tasks,
            COUNT(*) FILTER (WHERE t.status = 'done')                          AS completed_tasks,
            COUNT(*) FILTER (WHERE t.status NOT IN ('done', 'cancelled')
                             AND t.due_date IS NOT NULL
                             AND t.due_date < CURRENT_DATE)                    AS overdue_tasks
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE p.org_id = :org_id AND t.project_id = :project_id
    """)
    result = await db.execute(task_query, {"org_id": str(org_id), "project_id": str(project_id)})
    row = result.mappings().first()

    total_tasks = int(row["total_tasks"]) if row else 0
    completed_tasks = int(row["completed_tasks"]) if row else 0
    overdue_tasks = int(row["overdue_tasks"]) if row else 0

    completion_rate = completed_tasks / total_tasks if total_tasks > 0 else 0.0

    cycle_query = text("""
        SELECT AVG(EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 3600.0) AS avg_cycle
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE p.org_id = :org_id
          AND t.project_id = :project_id
          AND t.status = 'done'
    """)
    cycle_result = await db.execute(cycle_query, {"org_id": str(org_id), "project_id": str(project_id)})
    cycle_row = cycle_result.mappings().first()
    avg_cycle_time_hours = (
        float(cycle_row["avg_cycle"])
        if cycle_row and cycle_row["avg_cycle"] is not None
        else None
    )

    completion_component = completion_rate * 40.0

    if total_tasks > 0:
        overdue_ratio = overdue_tasks / total_tasks
        overdue_component = (1.0 - overdue_ratio) * 30.0
    else:
        overdue_component = 30.0

    if avg_cycle_time_hours is not None and avg_cycle_time_hours > 0:
        capped = min(avg_cycle_time_hours, 500.0)
        cycle_component = max(0.0, (1.0 - capped / 500.0)) * 30.0
    else:
        cycle_component = 15.0

    health_score = round(min(100.0, max(0.0, completion_component + overdue_component + cycle_component)), 2)

    return ProjectHealthResponse(
        project_id=project_id,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        overdue_tasks=overdue_tasks,
        completion_rate=round(completion_rate, 4),
        health_score=health_score,
        avg_cycle_time_hours=round(avg_cycle_time_hours, 2) if avg_cycle_time_hours is not None else None,
    )


async def calculate_workload(
    db: AsyncSession,
    org_id: UUID,
) -> WorkloadResponse:
    """Aggregate tasks by assignee to produce a workload view scoped to org_id."""
    query = text("""
        SELECT
            t.assignee_id                                                     AS user_id,
            COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), 'Unknown') AS name,
            COUNT(*)                                                          AS assigned_tasks,
            COUNT(*) FILTER (WHERE t.status = 'done')                         AS completed_tasks,
            COUNT(*) FILTER (WHERE t.status = 'in_progress')                  AS in_progress_tasks
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = t.assignee_id
        WHERE p.org_id = :org_id
          AND t.assignee_id IS NOT NULL
        GROUP BY t.assignee_id, u.first_name, u.last_name
        ORDER BY assigned_tasks DESC
    """)
    result = await db.execute(query, {"org_id": str(org_id)})
    rows = result.mappings().all()

    members: list[MemberWorkload] = []
    for r in rows:
        assigned = int(r["assigned_tasks"])
        completed = int(r["completed_tasks"])
        utilization = completed / assigned if assigned > 0 else 0.0
        members.append(
            MemberWorkload(
                user_id=r["user_id"],
                name=r["name"],
                assigned_tasks=assigned,
                completed_tasks=completed,
                in_progress_tasks=int(r["in_progress_tasks"]),
                utilization_rate=round(utilization, 4),
            )
        )

    return WorkloadResponse(org_id=org_id, members=members)


async def calculate_cycle_time(
    db: AsyncSession,
    org_id: UUID,
    project_id: UUID,
) -> CycleTimeResponse:
    """Analyze activity_log for status transitions and compute average hours per status."""
    await _ensure_project_in_org(db, org_id, project_id)

    query = text("""
        WITH ordered_events AS (
            SELECT
                al.task_id,
                COALESCE(al.changes->'status'->>'to', al.action) AS status_name,
                al.created_at,
                LEAD(al.created_at) OVER (
                    PARTITION BY al.task_id ORDER BY al.created_at
                ) AS next_at
            FROM activity_log al
            JOIN tasks t ON t.id = al.task_id
            JOIN projects p ON p.id = t.project_id
            WHERE p.org_id = :org_id
              AND t.project_id = :project_id
              AND al.task_id IS NOT NULL
        )
        SELECT
            status_name,
            AVG(EXTRACT(EPOCH FROM (next_at - created_at)) / 3600.0) AS avg_hours
        FROM ordered_events
        WHERE next_at IS NOT NULL
        GROUP BY status_name
    """)
    result = await db.execute(query, {"org_id": str(org_id), "project_id": str(project_id)})
    rows = result.mappings().all()

    by_status: dict[str, float] = {}
    total_hours = 0.0
    count = 0
    for r in rows:
        avg = float(r["avg_hours"]) if r["avg_hours"] is not None else 0.0
        by_status[str(r["status_name"])] = round(max(0.0, avg), 2)
        total_hours += max(0.0, avg)
        count += 1

    avg_total_hours = round(total_hours / count, 2) if count > 0 else 0.0

    return CycleTimeResponse(
        project_id=project_id,
        avg_total_hours=avg_total_hours,
        by_status=by_status,
    )


async def calculate_delivery_metrics(
    db: AsyncSession,
    org_id: UUID,
    project_id: UUID,
    time_range: TimeRange,
) -> DeliveryMetrics:
    """Compute velocity, throughput, and burndown within a time window."""
    await _ensure_project_in_org(db, org_id, project_id)

    completed_query = text("""
        SELECT COUNT(*) AS completed
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE p.org_id = :org_id
          AND t.project_id = :project_id
          AND t.status = 'done'
          AND t.updated_at::date BETWEEN :start AND :end
    """)
    result = await db.execute(completed_query, {
        "org_id": str(org_id),
        "project_id": str(project_id),
        "start": time_range.start_date.isoformat(),
        "end": time_range.end_date.isoformat(),
    })
    completed_this_period = int(result.scalar() or 0)

    remaining_query = text("""
        SELECT COUNT(*) AS remaining
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE p.org_id = :org_id
          AND t.project_id = :project_id
          AND t.status NOT IN ('done', 'cancelled')
    """)
    remaining_result = await db.execute(remaining_query, {
        "org_id": str(org_id),
        "project_id": str(project_id),
    })
    remaining = int(remaining_result.scalar() or 0)

    days = max((time_range.end_date - time_range.start_date).days + 1, 1)
    velocity = round(completed_this_period / days, 4)
    throughput_per_day = velocity

    burndown_query = text("""
        SELECT
            t.updated_at::date AS completion_date,
            COUNT(*)           AS completed_count
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE p.org_id = :org_id
          AND t.project_id = :project_id
          AND t.status = 'done'
          AND t.updated_at::date BETWEEN :start AND :end
        GROUP BY t.updated_at::date
        ORDER BY t.updated_at::date
    """)
    bd_result = await db.execute(burndown_query, {
        "org_id": str(org_id),
        "project_id": str(project_id),
        "start": time_range.start_date.isoformat(),
        "end": time_range.end_date.isoformat(),
    })
    bd_rows = bd_result.mappings().all()

    total_at_start = completed_this_period + remaining
    ideal_per_day = total_at_start / days if days > 0 else 0.0

    burndown: list[BurndownPoint] = []
    running_remaining = total_at_start
    day_index = 0
    completed_map = {str(r["completion_date"]): int(r["completed_count"]) for r in bd_rows}

    current = time_range.start_date
    while current <= time_range.end_date:
        done_today = completed_map.get(str(current), 0)
        running_remaining = max(0, running_remaining - done_today)
        ideal = max(0.0, total_at_start - ideal_per_day * day_index)
        burndown.append(BurndownPoint(date=current, remaining=running_remaining, ideal=round(ideal, 2)))
        current += timedelta(days=1)
        day_index += 1

    return DeliveryMetrics(
        project_id=project_id,
        velocity=velocity,
        throughput_per_day=throughput_per_day,
        completed_this_period=completed_this_period,
        remaining=remaining,
        burndown=burndown,
    )


async def generate_summary(
    db: AsyncSession,
    org_id: UUID,
) -> AnalyticsSummary:
    """Aggregate analytics across all projects for an organization."""
    proj_query = text("""
        SELECT
            COUNT(*)                                   AS total_projects,
            COUNT(*) FILTER (WHERE status = 'active')  AS active_projects
        FROM projects
        WHERE org_id = :org_id
    """)
    proj_result = await db.execute(proj_query, {"org_id": str(org_id)})
    proj_row = proj_result.mappings().first()

    task_query = text("""
        SELECT
            COUNT(*)                                                        AS total_tasks,
            COUNT(*) FILTER (WHERE t.status = 'done')                       AS completed_tasks,
            COUNT(*) FILTER (WHERE t.status NOT IN ('done', 'cancelled')
                             AND t.due_date IS NOT NULL
                             AND t.due_date < CURRENT_DATE)                 AS overdue_tasks
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE p.org_id = :org_id
    """)
    task_result = await db.execute(task_query, {"org_id": str(org_id)})
    task_row = task_result.mappings().first()

    total_tasks = int(task_row["total_tasks"]) if task_row else 0
    completed_tasks = int(task_row["completed_tasks"]) if task_row else 0
    overdue_tasks = int(task_row["overdue_tasks"]) if task_row else 0
    avg_completion_rate = completed_tasks / total_tasks if total_tasks > 0 else 0.0

    top_query = text("""
        SELECT
            p.id                                              AS project_id,
            p.name                                            AS project_name,
            COUNT(t.id)                                       AS total,
            COUNT(t.id) FILTER (WHERE t.status = 'done')      AS completed
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id
        WHERE p.org_id = :org_id
        GROUP BY p.id, p.name
        ORDER BY completed DESC, total DESC
        LIMIT 5
    """)
    top_result = await db.execute(top_query, {"org_id": str(org_id)})
    top_rows = top_result.mappings().all()

    top_projects = [
        {
            "project_id": str(r["project_id"]),
            "name": r["project_name"],
            "total_tasks": int(r["total"]),
            "completed_tasks": int(r["completed"]),
            "completion_rate": round(int(r["completed"]) / int(r["total"]), 4) if int(r["total"]) > 0 else 0.0,
        }
        for r in top_rows
    ]

    return AnalyticsSummary(
        org_id=org_id,
        total_projects=int(proj_row["total_projects"]) if proj_row else 0,
        active_projects=int(proj_row["active_projects"]) if proj_row else 0,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        overdue_tasks=overdue_tasks,
        avg_completion_rate=round(avg_completion_rate, 4),
        top_projects=top_projects,
    )
