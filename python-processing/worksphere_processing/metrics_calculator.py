"""Streaming productivity, team workload, velocity, and cycle-time calculators."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from datetime import date, datetime, timezone

from worksphere_processing.models import (
    ActivityRecord,
    ProductivityMetrics,
    TaskRecord,
    TeamMemberMetrics,
)


class ProductivityCalculator:
    """Computes metrics in single-pass streaming loops using O(distinct_users) memory."""

    def calculate_productivity(
        self,
        task_stream: Iterable[TaskRecord],
        reference_date: date | None = None,
    ) -> ProductivityMetrics:
        ref = reference_date or datetime.now(timezone.utc).date()

        total = 0
        completed = 0
        cancelled = 0
        overdue = 0
        on_time_completed = 0
        completed_with_due = 0
        total_completion_hours = 0.0
        min_date: date | None = None
        max_date: date | None = None

        for task in task_stream:
            total += 1
            created_d = task.created_at.date()
            updated_d = task.updated_at.date()
            min_date = created_d if min_date is None or created_d < min_date else min_date
            max_date = updated_d if max_date is None or updated_d > max_date else max_date

            if task.status == "done":
                completed += 1
                delta_hours = max(0.0, (task.updated_at - task.created_at).total_seconds() / 3600.0)
                total_completion_hours += delta_hours
                if task.due_date is not None:
                    completed_with_due += 1
                    if task.updated_at.date() <= task.due_date:
                        on_time_completed += 1
            elif task.status == "cancelled":
                cancelled += 1
            elif task.due_date is not None and task.due_date < ref:
                overdue += 1

        avg_completion = total_completion_hours / completed if completed > 0 else 0.0
        on_time_rate = on_time_completed / completed_with_due if completed_with_due > 0 else (1.0 if completed > 0 else 0.0)
        span_days = max((max_date - min_date).days + 1, 1) if (min_date and max_date) else 1
        throughput = completed / span_days if total > 0 else 0.0

        return ProductivityMetrics(
            tasks_total=total,
            tasks_completed=completed,
            tasks_cancelled=cancelled,
            overdue_count=overdue,
            avg_completion_time_hours=round(avg_completion, 2),
            on_time_rate=round(on_time_rate, 4),
            throughput_per_day=round(throughput, 4),
        )

    def calculate_team_metrics(self, task_stream: Iterable[TaskRecord]) -> list[TeamMemberMetrics]:
        """Accumulate per-assignee statistics in a single pass."""
        stats: dict[str, dict[str, float | int]] = defaultdict(
            lambda: {"assigned": 0, "completed": 0, "hours": 0.0}
        )

        for task in task_stream:
            if not task.assignee_id:
                continue
            bucket = stats[task.assignee_id]
            bucket["assigned"] += 1
            if task.status == "done":
                bucket["completed"] += 1
            if task.actual_hours is not None:
                bucket["hours"] += float(task.actual_hours)
            elif task.estimated_hours is not None and task.status == "done":
                bucket["hours"] += float(task.estimated_hours)

        result: list[TeamMemberMetrics] = []
        for user_id, s in sorted(stats.items(), key=lambda kv: kv[1]["assigned"], reverse=True):
            assigned = int(s["assigned"])
            completed = int(s["completed"])
            total_hrs = float(s["hours"])
            result.append(
                TeamMemberMetrics(
                    user_id=user_id,
                    tasks_assigned=assigned,
                    tasks_completed=completed,
                    avg_hours_per_task=round(total_hrs / assigned, 2) if assigned > 0 else 0.0,
                    utilization_rate=round(completed / assigned, 4) if assigned > 0 else 0.0,
                )
            )
        return result

    def calculate_velocity(self, activity_stream: Iterable[ActivityRecord], days: int = 14) -> float:
        """Calculate completed tasks per day from status-change activities."""
        if days <= 0:
            raise ValueError("days must be positive")
        completed_tasks: set[str] = set()
        for act in activity_stream:
            status_change = act.changes.get("status")
            if isinstance(status_change, dict) and status_change.get("to") == "done":
                completed_tasks.add(act.task_id)
            elif act.action == "task.completed":
                completed_tasks.add(act.task_id)
        return round(len(completed_tasks) / days, 4)

    def calculate_cycle_time(self, activity_stream: Iterable[ActivityRecord]) -> dict[str, float]:
        """Compute average hours spent per task status across chronologically ordered events."""
        last_seen: dict[str, tuple[str, datetime]] = {}
        totals: dict[str, float] = defaultdict(float)
        counts: dict[str, int] = defaultdict(int)

        for act in activity_stream:
            status_change = act.changes.get("status")
            if not isinstance(status_change, dict):
                continue
            from_status = status_change.get("from")
            to_status = status_change.get("to")
            if not to_status:
                continue

            if act.task_id in last_seen:
                prev_status, prev_ts = last_seen[act.task_id]
                elapsed_hours = max(0.0, (act.timestamp - prev_ts).total_seconds() / 3600.0)
                key = str(from_status or prev_status)
                totals[key] += elapsed_hours
                counts[key] += 1

            last_seen[act.task_id] = (str(to_status), act.timestamp)

        return {
            status: round(totals[status] / counts[status], 2)
            for status in totals
            if counts[status] > 0
        }
