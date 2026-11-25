"""Pydantic data models for WorkSphere streaming exports."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class TaskRecord(BaseModel):
    """Normalized task record parsed from a task export stream."""

    id: str
    org_id: str | None = None
    project_id: str
    title: str = Field(min_length=1)
    status: Literal["todo", "in_progress", "in_review", "done", "cancelled"]
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    assignee_id: str | None = None
    created_at: datetime
    updated_at: datetime
    due_date: date | None = None
    estimated_hours: float | None = Field(default=None, ge=0)
    actual_hours: float | None = Field(default=None, ge=0)

    @field_validator("assignee_id", "org_id", mode="before")
    @classmethod
    def _empty_str_to_none(cls, v: Any) -> Any:
        if v == "":
            return None
        return v

    @field_validator("due_date", "estimated_hours", "actual_hours", mode="before")
    @classmethod
    def _empty_optional_to_none(cls, v: Any) -> Any:
        if v == "" or v is None:
            return None
        return v


class ActivityRecord(BaseModel):
    """Normalized activity event parsed from an activity export stream."""

    id: str
    task_id: str
    actor_id: str
    action: str
    timestamp: datetime
    changes: dict[str, Any] = Field(default_factory=dict)


class ProductivityMetrics(BaseModel):
    """Aggregated productivity metrics across a task stream."""

    tasks_total: int = 0
    tasks_completed: int = 0
    tasks_cancelled: int = 0
    overdue_count: int = 0
    avg_completion_time_hours: float = 0.0
    on_time_rate: float = 0.0
    throughput_per_day: float = 0.0


class TeamMemberMetrics(BaseModel):
    """Aggregated metrics per assignee."""

    user_id: str
    tasks_assigned: int = 0
    tasks_completed: int = 0
    avg_hours_per_task: float = 0.0
    utilization_rate: float = 0.0


class OverdueItem(BaseModel):
    """Details about an overdue task."""

    task_id: str
    project_id: str
    title: str
    assignee_id: str | None = None
    due_date: date
    days_overdue: int = Field(ge=1)
    priority: Literal["low", "medium", "high", "critical"]
