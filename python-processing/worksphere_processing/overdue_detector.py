"""Streaming overdue task detector and prioritizer."""

from __future__ import annotations

from collections import Counter
from collections.abc import Generator, Iterable
from datetime import date, datetime, timezone
from typing import Any

from worksphere_processing.models import OverdueItem, TaskRecord

_PRIORITY_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1}


class OverdueDetector:
    """Identifies and prioritizes overdue tasks from a stream of TaskRecord objects."""

    def detect_overdue(
        self,
        task_stream: Iterable[TaskRecord],
        reference_date: date | None = None,
    ) -> Generator[OverdueItem, None, None]:
        """Lazily yield OverdueItem entries for incomplete tasks past their due_date."""
        ref = reference_date or datetime.now(timezone.utc).date()
        for task in task_stream:
            if task.status in ("done", "cancelled") or task.due_date is None:
                continue
            if task.due_date < ref:
                yield OverdueItem(
                    task_id=task.id,
                    project_id=task.project_id,
                    title=task.title,
                    assignee_id=task.assignee_id,
                    due_date=task.due_date,
                    days_overdue=(ref - task.due_date).days,
                    priority=task.priority,
                )

    def prioritize_overdue(self, overdue_stream: Iterable[OverdueItem]) -> list[OverdueItem]:
        """Sort overdue tasks by priority descending, then days_overdue descending."""
        return sorted(
            overdue_stream,
            key=lambda item: (_PRIORITY_RANK.get(item.priority, 0), item.days_overdue),
            reverse=True,
        )

    def generate_summary(self, overdue_stream: Iterable[OverdueItem]) -> dict[str, Any]:
        """Produce aggregate overdue statistics in a single pass."""
        total = 0
        by_priority: Counter[str] = Counter()
        most_overdue: OverdueItem | None = None

        for item in overdue_stream:
            total += 1
            by_priority[item.priority] += 1
            if most_overdue is None or item.days_overdue > most_overdue.days_overdue:
                most_overdue = item

        return {
            "total_overdue": total,
            "by_priority": dict(by_priority),
            "most_overdue": most_overdue.model_dump(mode="json") if most_overdue else None,
        }
