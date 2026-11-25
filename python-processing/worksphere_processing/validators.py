"""Input validators for streaming records and query bounds."""

from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any

from dateutil import parser as date_parser
from pydantic import ValidationError as PydanticValidationError

from worksphere_processing.models import ActivityRecord, TaskRecord


class ValidationError(Exception):
    """Raised when an input record or parameter fails validation."""

    def __init__(self, message: str, row_number: int | None = None, details: Any = None):
        super().__init__(message)
        self.row_number = row_number
        self.details = details


def validate_task_record(raw_data: dict[str, Any], row_number: int | None = None) -> TaskRecord:
    """Validate and coerce a raw dictionary into a TaskRecord."""
    if not isinstance(raw_data, dict):
        raise ValidationError("Record must be a mapping", row_number=row_number)

    normalized = dict(raw_data)
    for dt_field in ("created_at", "updated_at"):
        val = normalized.get(dt_field)
        if isinstance(val, str) and val.strip():
            try:
                normalized[dt_field] = date_parser.isoparse(val.strip())
            except ValueError as exc:
                raise ValidationError(
                    f"Invalid datetime in field '{dt_field}': {val}",
                    row_number=row_number,
                ) from exc

    due_val = normalized.get("due_date")
    if isinstance(due_val, str) and due_val.strip():
        try:
            normalized["due_date"] = date_parser.isoparse(due_val.strip()).date()
        except ValueError as exc:
            raise ValidationError(
                f"Invalid date in field 'due_date': {due_val}",
                row_number=row_number,
            ) from exc

    try:
        return TaskRecord.model_validate(normalized)
    except PydanticValidationError as exc:
        raise ValidationError(
            f"Invalid task record: {exc.errors()}",
            row_number=row_number,
            details=exc.errors(),
        ) from exc


def validate_activity_record(raw_data: dict[str, Any], row_number: int | None = None) -> ActivityRecord:
    """Validate and coerce a raw dictionary into an ActivityRecord."""
    if not isinstance(raw_data, dict):
        raise ValidationError("Activity record must be a mapping", row_number=row_number)

    normalized = dict(raw_data)
    ts_val = normalized.get("timestamp")
    if isinstance(ts_val, str) and ts_val.strip():
        try:
            normalized["timestamp"] = date_parser.isoparse(ts_val.strip())
        except ValueError as exc:
            raise ValidationError(
                f"Invalid timestamp: {ts_val}",
                row_number=row_number,
            ) from exc

    changes_val = normalized.get("changes")
    if isinstance(changes_val, str):
        if not changes_val.strip():
            normalized["changes"] = {}
        else:
            try:
                normalized["changes"] = json.loads(changes_val)
            except json.JSONDecodeError as exc:
                raise ValidationError(
                    f"Invalid JSON in changes column: {changes_val}",
                    row_number=row_number,
                ) from exc

    try:
        return ActivityRecord.model_validate(normalized)
    except PydanticValidationError as exc:
        raise ValidationError(
            f"Invalid activity record: {exc.errors()}",
            row_number=row_number,
            details=exc.errors(),
        ) from exc


def validate_date_range(start: date | datetime, end: date | datetime) -> tuple[date, date]:
    """Ensure start <= end and return normalized date objects."""
    start_d = start.date() if isinstance(start, datetime) else start
    end_d = end.date() if isinstance(end, datetime) else end
    if start_d > end_d:
        raise ValidationError(f"start_date ({start_d}) must not exceed end_date ({end_d})")
    return start_d, end_d
