"""Pydantic v2 schemas for the WorkSphere Analytics API."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared / helper models
# ---------------------------------------------------------------------------

class TimeRange(BaseModel):
    """Date range filter."""
    start_date: date
    end_date: date


class PaginationParams(BaseModel):
    """Pagination query parameters."""
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)


# ---------------------------------------------------------------------------
# Project health
# ---------------------------------------------------------------------------

class ProjectHealthResponse(BaseModel):
    """Health metrics for a single project."""
    project_id: UUID
    total_tasks: int
    completed_tasks: int
    overdue_tasks: int
    completion_rate: float = Field(ge=0.0, le=1.0)
    health_score: float = Field(ge=0.0, le=100.0)
    avg_cycle_time_hours: float | None = None


# ---------------------------------------------------------------------------
# Workload
# ---------------------------------------------------------------------------

class MemberWorkload(BaseModel):
    """Workload stats for a single team member."""
    user_id: UUID
    name: str
    assigned_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    utilization_rate: float = Field(ge=0.0, le=1.0)


class WorkloadResponse(BaseModel):
    """Workload distribution across the organisation."""
    org_id: UUID
    members: list[MemberWorkload]


# ---------------------------------------------------------------------------
# Cycle time
# ---------------------------------------------------------------------------

class CycleTimeResponse(BaseModel):
    """Cycle-time analytics for a project."""
    project_id: UUID
    avg_total_hours: float
    by_status: dict[str, float]


# ---------------------------------------------------------------------------
# Delivery metrics
# ---------------------------------------------------------------------------

class BurndownPoint(BaseModel):
    """Single point on a burndown chart."""
    date: date
    remaining: int
    ideal: float


class DeliveryMetrics(BaseModel):
    """Velocity and burndown for a project within a time window."""
    project_id: UUID
    velocity: float
    throughput_per_day: float
    completed_this_period: int
    remaining: int
    burndown: list[BurndownPoint]


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

class AnalyticsSummary(BaseModel):
    """High-level analytics summary for an organisation."""
    org_id: UUID
    total_projects: int
    active_projects: int
    total_tasks: int
    completed_tasks: int
    overdue_tasks: int
    avg_completion_rate: float
    top_projects: list[dict]


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

class ReportRequest(BaseModel):
    """Request to generate an analytics report."""
    org_id: UUID
    project_id: UUID | None = None
    report_type: str = Field(description="One of: project_health, workload, tasks_export")
    format: str = Field(default="json", description="Output format: json or csv")


class ReportStatus(BaseModel):
    """Status of an asynchronous report generation job."""
    report_id: UUID
    status: str = Field(description="pending | processing | completed | failed")
    download_url: str | None = None


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------

class ErrorResponse(BaseModel):
    """Standard error payload."""
    detail: str
    error_code: str
