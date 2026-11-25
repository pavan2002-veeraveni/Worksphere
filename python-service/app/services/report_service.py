"""Report generation service - produces CSV and JSON reports with tenant scoping."""

from __future__ import annotations

import csv
import json
import os
import tempfile
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import text

from app.core.logging_config import get_logger
from app.models.schemas import ReportRequest

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = get_logger(__name__)

_report_registry: dict[str, dict] = {}

REPORTS_DIR = os.path.join(tempfile.gettempdir(), "worksphere_reports")
os.makedirs(REPORTS_DIR, exist_ok=True)


def _register_report(report_id: str, org_id: str, status: str, path: str | None = None, fmt: str = "json") -> None:
    _report_registry[report_id] = {
        "org_id": org_id,
        "status": status,
        "path": path,
        "format": fmt,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def get_report_meta(report_id: str) -> dict | None:
    return _report_registry.get(report_id)


async def _fetch_project_health_rows(db: AsyncSession, org_id: str, project_id: str | None):
    where = "WHERE p.org_id = :org_id"
    params: dict = {"org_id": org_id}
    if project_id:
        where += " AND p.id = :project_id"
        params["project_id"] = project_id

    query = text(f"""
        SELECT
            p.id                                                            AS project_id,
            p.name                                                          AS project_name,
            COUNT(t.id)                                                     AS total_tasks,
            COUNT(t.id) FILTER (WHERE t.status = 'done')                    AS completed_tasks,
            COUNT(t.id) FILTER (WHERE t.status NOT IN ('done', 'cancelled')
                                AND t.due_date IS NOT NULL
                                AND t.due_date < CURRENT_DATE)              AS overdue_tasks
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id
        {where}
        GROUP BY p.id, p.name
    """)
    result = await db.execute(query, params)
    return result.mappings().all()


async def _fetch_workload_rows(db: AsyncSession, org_id: str):
    query = text("""
        SELECT
            t.assignee_id,
            COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), 'Unknown') AS name,
            COUNT(*)                                      AS assigned,
            COUNT(*) FILTER (WHERE t.status = 'done')        AS completed,
            COUNT(*) FILTER (WHERE t.status = 'in_progress') AS in_progress
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = t.assignee_id
        WHERE p.org_id = :org_id AND t.assignee_id IS NOT NULL
        GROUP BY t.assignee_id, u.first_name, u.last_name
    """)
    result = await db.execute(query, {"org_id": org_id})
    return result.mappings().all()


async def _fetch_tasks_export_rows(db: AsyncSession, org_id: str, project_id: str | None):
    where = "WHERE p.org_id = :org_id"
    params: dict = {"org_id": org_id}
    if project_id:
        where += " AND t.project_id = :project_id"
        params["project_id"] = project_id

    query = text(f"""
        SELECT t.id, t.project_id, t.title, t.status, t.priority,
               t.assignee_id, t.created_at, t.updated_at, t.due_date,
               t.estimated_hours, t.actual_hours
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        {where}
        ORDER BY t.created_at
    """)
    result = await db.execute(query, params)
    return result.mappings().all()


async def generate_report(db: AsyncSession, request: ReportRequest) -> str:
    """Generate a CSV or JSON report for the given tenant and return its ID."""
    if request.format not in ("json", "csv"):
        raise ValueError(f"Unsupported format: {request.format}. Must be 'json' or 'csv'.")

    report_id = str(uuid.uuid4())
    org_id = str(request.org_id)
    _register_report(report_id, org_id, "processing", fmt=request.format)

    project_id = str(request.project_id) if request.project_id else None

    try:
        if request.report_type == "project_health":
            rows = await _fetch_project_health_rows(db, org_id, project_id)
            columns = ["project_id", "project_name", "total_tasks", "completed_tasks", "overdue_tasks"]
        elif request.report_type == "workload":
            rows = await _fetch_workload_rows(db, org_id)
            columns = ["assignee_id", "name", "assigned", "completed", "in_progress"]
        elif request.report_type == "tasks_export":
            rows = await _fetch_tasks_export_rows(db, org_id, project_id)
            columns = [
                "id", "project_id", "title", "status", "priority",
                "assignee_id", "created_at", "updated_at", "due_date",
                "estimated_hours", "actual_hours",
            ]
        else:
            _register_report(report_id, org_id, "failed", fmt=request.format)
            raise ValueError(f"Unknown report_type: {request.report_type}")

        ext = "csv" if request.format == "csv" else "json"
        file_path = os.path.join(REPORTS_DIR, f"{report_id}.{ext}")

        if request.format == "csv":
            _write_csv(file_path, rows, columns)
        else:
            _write_json(file_path, rows)

        _register_report(report_id, org_id, "completed", file_path, fmt=request.format)
        logger.info("Report %s generated at %s", report_id, file_path)

    except Exception:
        logger.exception("Report generation failed for %s", report_id)
        _register_report(report_id, org_id, "failed", fmt=request.format)
        raise

    return report_id


def _write_csv(path: str, rows, columns: list[str]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({c: _serialise(row.get(c)) for c in columns})


def _write_json(path: str, rows) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("[\n")
        for idx, row in enumerate(rows):
            line = json.dumps({k: _serialise(v) for k, v in row.items()})
            if idx > 0:
                fh.write(",\n")
            fh.write(line)
        fh.write("\n]\n")


def _serialise(value):
    if isinstance(value, datetime):
        return value.isoformat()
    if hasattr(value, "__str__") and not isinstance(value, (str, int, float, bool, type(None))):
        return str(value)
    return value
