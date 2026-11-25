"""Tests for OverdueDetector accuracy, prioritization, and edge cases."""

from datetime import date, datetime, timezone

from worksphere_processing.models import TaskRecord
from worksphere_processing.overdue_detector import OverdueDetector
from worksphere_processing.stream_processor import StreamProcessor


def test_detect_and_prioritize_overdue_on_sample(sample_tasks_csv):
    processor = StreamProcessor()
    detector = OverdueDetector()

    overdue_items = list(
        detector.detect_overdue(
            processor.stream_tasks(sample_tasks_csv),
            reference_date=date(2026, 2, 1),
        )
    )
    assert len(overdue_items) == 8

    prioritized = detector.prioritize_overdue(overdue_items)
    assert prioritized[0].priority == "critical"

    summary = detector.generate_summary(overdue_items)
    assert summary["total_overdue"] == 8
    assert summary["most_overdue"] is not None


def test_due_today_and_no_due_date_are_not_overdue():
    ref = date(2026, 3, 10)
    now = datetime(2026, 3, 1, 10, 0, tzinfo=timezone.utc)
    tasks = [
        TaskRecord(
            id="t-today",
            project_id="p1",
            title="Due today",
            status="in_progress",
            priority="high",
            created_at=now,
            updated_at=now,
            due_date=ref,
        ),
        TaskRecord(
            id="t-nodue",
            project_id="p1",
            title="No due date",
            status="todo",
            priority="low",
            created_at=now,
            updated_at=now,
            due_date=None,
        ),
        TaskRecord(
            id="t-done-past",
            project_id="p1",
            title="Completed past due",
            status="done",
            priority="critical",
            created_at=now,
            updated_at=now,
            due_date=date(2026, 3, 1),
        ),
    ]
    detector = OverdueDetector()
    assert list(detector.detect_overdue(tasks, reference_date=ref)) == []
