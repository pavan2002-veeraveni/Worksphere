"""Streaming CSV, JSON Lines, and human-readable summary report generator."""

from __future__ import annotations

import csv
import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from worksphere_processing.models import ProductivityMetrics


class ReportGenerator:
    """Writes structured reports iteratively so memory usage remains constant."""

    @staticmethod
    def _to_dict(item: Any) -> dict[str, Any]:
        if isinstance(item, BaseModel):
            return item.model_dump(mode="json")
        if isinstance(item, dict):
            return item
        raise TypeError(f"Unsupported record type: {type(item).__name__}")

    def generate_csv(
        self,
        data_stream: Iterable[BaseModel | dict[str, Any]],
        output_path: str | Path,
        columns: list[str] | None = None,
    ) -> int:
        """Stream records to a CSV file, returning the number of rows written."""
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        count = 0

        with path.open("w", encoding="utf-8", newline="") as fh:
            writer: csv.DictWriter | None = None
            fieldnames = list(columns) if columns else None

            if fieldnames:
                writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
                writer.writeheader()

            for item in data_stream:
                row = self._to_dict(item)
                if writer is None:
                    fieldnames = list(row.keys())
                    writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
                    writer.writeheader()
                writer.writerow(row)
                count += 1

        return count

    def generate_jsonl(
        self,
        data_stream: Iterable[BaseModel | dict[str, Any]],
        output_path: str | Path,
    ) -> int:
        """Stream records to a JSON Lines file, returning the number of records written."""
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        count = 0

        with path.open("w", encoding="utf-8") as fh:
            for item in data_stream:
                row = self._to_dict(item)
                fh.write(json.dumps(row, default=str) + "\n")
                count += 1

        return count

    def generate_summary_report(
        self,
        metrics: ProductivityMetrics,
        output_path: str | Path,
    ) -> Path:
        """Write a formatted JSON + text productivity summary report."""
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "report_type": "productivity_summary",
            "metrics": metrics.model_dump(mode="json"),
        }
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return path
