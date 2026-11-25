"""Tests for ProductivityCalculator metrics, team breakdown, velocity, and cycle time."""

from datetime import date
import pytest

from worksphere_processing.metrics_calculator import ProductivityCalculator
from worksphere_processing.stream_processor import StreamProcessor


def test_calculate_productivity_on_sample_data(sample_tasks_csv):
    processor = StreamProcessor()
    calc = ProductivityCalculator()
    metrics = calc.calculate_productivity(
        processor.stream_tasks(sample_tasks_csv),
        reference_date=date(2026, 2, 1),
    )
    assert metrics.tasks_total == 20
    assert metrics.tasks_completed == 10
    assert metrics.tasks_cancelled == 1
    assert metrics.overdue_count == 8  # task-016 due 2026-12-31 is not overdue
    assert metrics.avg_completion_time_hours > 0
    assert 0.0 <= metrics.on_time_rate <= 1.0


def test_calculate_team_metrics(sample_tasks_csv):
    processor = StreamProcessor()
    calc = ProductivityCalculator()
    team = calc.calculate_team_metrics(processor.stream_tasks(sample_tasks_csv))
    by_user = {m.user_id: m for m in team}
    assert "user-alice" in by_user
    assert by_user["user-alice"].tasks_assigned == 8
    assert by_user["user-alice"].tasks_completed == 6


def test_calculate_velocity_and_cycle_time(sample_activities_csv):
    processor = StreamProcessor()
    calc = ProductivityCalculator()
    velocity = calc.calculate_velocity(processor.stream_activities(sample_activities_csv), days=10)
    assert velocity == 1.0  # 10 unique tasks completed in sample

    cycle_times = calc.calculate_cycle_time(processor.stream_activities(sample_activities_csv))
    assert "todo" in cycle_times
    assert "in_progress" in cycle_times
    assert cycle_times["todo"] > 0


def test_zero_tasks_returns_zero_metrics():
    calc = ProductivityCalculator()
    metrics = calc.calculate_productivity([])
    assert metrics.tasks_total == 0
    assert metrics.tasks_completed == 0
    assert metrics.avg_completion_time_hours == 0.0

    with pytest.raises(ValueError):
        calc.calculate_velocity([], days=0)
