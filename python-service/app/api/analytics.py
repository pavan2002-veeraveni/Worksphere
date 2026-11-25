"""Analytics API endpoints with API key auth and tenant scoping."""

from __future__ import annotations

from datetime import date, timedelta
from typing import TYPE_CHECKING, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse

from app.core.database import get_db_session
from app.core.security import verify_api_key
from app.models.schemas import (
    AnalyticsSummary,
    CycleTimeResponse,
    DeliveryMetrics,
    ProjectHealthResponse,
    ReportRequest,
    ReportStatus,
    TimeRange,
    WorkloadResponse,
)
from app.services import analytics_service, report_service

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession
else:
    AsyncSession = Any

router = APIRouter(
    prefix="/api/v1/analytics",
    tags=["Analytics"],
    dependencies=[Depends(verify_api_key)],
)


@router.get(
    "/projects/{project_id}/health",
    response_model=ProjectHealthResponse,
    summary="Get project health metrics",
)
async def get_project_health(
    project_id: UUID,
    org_id: UUID = Query(..., description="Tenant organization UUID"),
    db: AsyncSession = Depends(get_db_session),
) -> ProjectHealthResponse:
    try:
        return await analytics_service.calculate_project_health(db, org_id, project_id)
    except analytics_service.ProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get(
    "/workload",
    response_model=WorkloadResponse,
    summary="Get organization team workload distribution",
)
async def get_workload(
    org_id: UUID = Query(..., description="Tenant organization UUID"),
    db: AsyncSession = Depends(get_db_session),
) -> WorkloadResponse:
    return await analytics_service.calculate_workload(db, org_id)


@router.get(
    "/projects/{project_id}/cycle-time",
    response_model=CycleTimeResponse,
    summary="Get task cycle-time metrics for a project",
)
async def get_cycle_time(
    project_id: UUID,
    org_id: UUID = Query(..., description="Tenant organization UUID"),
    db: AsyncSession = Depends(get_db_session),
) -> CycleTimeResponse:
    try:
        return await analytics_service.calculate_cycle_time(db, org_id, project_id)
    except analytics_service.ProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get(
    "/projects/{project_id}/delivery",
    response_model=DeliveryMetrics,
    summary="Get project velocity, throughput, and burndown metrics",
)
async def get_delivery_metrics(
    project_id: UUID,
    org_id: UUID = Query(..., description="Tenant organization UUID"),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
) -> DeliveryMetrics:
    today = date.today()
    resolved_end = end_date or today
    resolved_start = start_date or (resolved_end - timedelta(days=14))
    if resolved_start > resolved_end:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start_date must be less than or equal to end_date",
        )
    try:
        return await analytics_service.calculate_delivery_metrics(
            db,
            org_id,
            project_id,
            TimeRange(start_date=resolved_start, end_date=resolved_end),
        )
    except analytics_service.ProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get(
    "/summary",
    response_model=AnalyticsSummary,
    summary="Get organization-wide analytics summary",
)
async def get_summary(
    org_id: UUID = Query(..., description="Tenant organization UUID"),
    db: AsyncSession = Depends(get_db_session),
) -> AnalyticsSummary:
    return await analytics_service.generate_summary(db, org_id)


@router.post(
    "/reports/generate",
    response_model=ReportStatus,
    status_code=status.HTTP_201_CREATED,
    summary="Generate an analytics export report",
)
async def generate_report(
    payload: ReportRequest,
    db: AsyncSession = Depends(get_db_session),
) -> ReportStatus:
    try:
        report_id = await report_service.generate_report(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    meta = report_service.get_report_meta(report_id)
    return ReportStatus(
        report_id=UUID(report_id),
        status=meta["status"] if meta else "completed",
        download_url=f"/api/v1/analytics/reports/{report_id}?org_id={payload.org_id}",
    )


@router.get(
    "/reports/{report_id}",
    summary="Download a previously generated report",
)
async def download_report(
    report_id: UUID,
    org_id: UUID = Query(..., description="Tenant organization UUID"),
):
    meta = report_service.get_report_meta(str(report_id))
    if meta is None or meta["org_id"] != str(org_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    if meta["status"] != "completed" or not meta["path"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Report status is {meta['status']}")

    media_type = "text/csv" if meta["format"] == "csv" else "application/json"
    filename = f"worksphere-report-{report_id}.{meta['format']}"
    return FileResponse(path=meta["path"], media_type=media_type, filename=filename)
