"""Streaming CSV and JSONL file processor using lazy Python generators."""

from __future__ import annotations

import csv
import json
from collections.abc import Generator, Iterable, Iterator
from pathlib import Path
from typing import Any, Callable, TypeVar

from worksphere_processing.models import ActivityRecord, TaskRecord
from worksphere_processing.validators import (
    ValidationError,
    validate_activity_record,
    validate_task_record,
)

T = TypeVar("T")


class StreamProcessor:
    """Reads and parses large CSV / JSON-Lines datasets strictly via generators.

    No intermediate full-file list is ever constructed in memory.
    """

    def __init__(self, on_error: str = "raise"):
        if on_error not in ("raise", "skip"):
            raise ValueError("on_error must be 'raise' or 'skip'")
        self.on_error = on_error
        self.error_count = 0
        self.errors: list[dict[str, Any]] = []

    def process_csv(self, file_path: str | Path) -> Generator[dict[str, Any], None, None]:
        """Lazily yield each row from a CSV file as a dictionary."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Export file not found: {path}")

        with path.open("r", encoding="utf-8", newline="") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                yield row

    def process_jsonl(self, file_path: str | Path) -> Generator[dict[str, Any], None, None]:
        """Lazily yield each parsed JSON object from a JSON Lines (.jsonl) file."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Export file not found: {path}")

        with path.open("r", encoding="utf-8") as fh:
            for line_num, raw_line in enumerate(fh, start=1):
                line = raw_line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    if not isinstance(obj, dict):
                        raise ValidationError("JSON line must be an object", row_number=line_num)
                    yield obj
                except (json.JSONDecodeError, ValidationError) as exc:
                    self._handle_error(line_num, exc)

    def stream_tasks(self, file_path: str | Path) -> Generator[TaskRecord, None, None]:
        """Stream validated TaskRecord instances from CSV or JSONL without buffering."""
        path = Path(file_path)
        raw_stream = self.process_jsonl(path) if path.suffix.lower() in (".jsonl", ".ndjson") else self.process_csv(path)
        yield from self.validate_and_parse(raw_stream, validate_task_record)

    def stream_activities(self, file_path: str | Path) -> Generator[ActivityRecord, None, None]:
        """Stream validated ActivityRecord instances from CSV or JSONL without buffering."""
        path = Path(file_path)
        raw_stream = self.process_jsonl(path) if path.suffix.lower() in (".jsonl", ".ndjson") else self.process_csv(path)
        yield from self.validate_and_parse(raw_stream, validate_activity_record)

    def validate_and_parse(
        self,
        raw_stream: Iterable[dict[str, Any]],
        validator_fn: Callable[[dict[str, Any], int | None], T],
    ) -> Generator[T, None, None]:
        """Validate each item lazily; skip or raise depending on configuration."""
        for idx, raw in enumerate(raw_stream, start=1):
            try:
                yield validator_fn(raw, idx)
            except ValidationError as exc:
                self._handle_error(idx, exc)

    @staticmethod
    def chunk_iterator(iterable: Iterable[T], chunk_size: int) -> Generator[list[T], None, None]:
        """Yield bounded lists of at most chunk_size items from any iterable."""
        if chunk_size <= 0:
            raise ValueError("chunk_size must be positive")
        iterator: Iterator[T] = iter(iterable)
        while True:
            chunk: list[T] = []
            try:
                for _ in range(chunk_size):
                    chunk.append(next(iterator))
            except StopIteration:
                if chunk:
                    yield chunk
                break
            yield chunk

    def _handle_error(self, row_number: int, exc: Exception) -> None:
        self.error_count += 1
        self.errors.append({"row": row_number, "error": str(exc)})
        if self.on_error == "raise":
            if isinstance(exc, ValidationError):
                raise exc
            raise ValidationError(str(exc), row_number=row_number) from exc
