"""Tests for StreamProcessor covering CSV, JSONL, errors, empty files, and lazy memory usage."""

import inspect
import json
import tracemalloc

import pytest

from worksphere_processing.stream_processor import StreamProcessor
from worksphere_processing.validators import ValidationError


def test_stream_tasks_csv_is_generator_and_parses_all_rows(sample_tasks_csv):
    processor = StreamProcessor()
    gen = processor.stream_tasks(sample_tasks_csv)
    assert inspect.isgenerator(gen)
    tasks = list(gen)
    assert len(tasks) == 20
    assert tasks[0].id == "task-001"
    assert tasks[0].status == "done"


def test_stream_tasks_jsonl(tmp_path):
    jsonl = tmp_path / "tasks.jsonl"
    records = [
        {
            "id": f"t-{i}",
            "project_id": "p-1",
            "title": f"Task {i}",
            "status": "todo",
            "priority": "medium",
            "created_at": "2026-01-01T10:00:00Z",
            "updated_at": "2026-01-01T10:00:00Z",
        }
        for i in range(5)
    ]
    jsonl.write_text("\n".join(json.dumps(r) for r in records) + "\n", encoding="utf-8")

    processor = StreamProcessor()
    parsed = list(processor.stream_tasks(jsonl))
    assert len(parsed) == 5
    assert parsed[4].id == "t-4"


def test_malformed_rows_raise_or_skip(tmp_path):
    csv_file = tmp_path / "bad.csv"
    csv_file.write_text(
        "id,project_id,title,status,priority,created_at,updated_at\n"
        "t1,p1,Valid,todo,high,2026-01-01T00:00:00Z,2026-01-01T00:00:00Z\n"
        "t2,p1,BadStatus,not_a_status,high,2026-01-01T00:00:00Z,2026-01-01T00:00:00Z\n",
        encoding="utf-8",
    )

    strict = StreamProcessor(on_error="raise")
    with pytest.raises(ValidationError):
        list(strict.stream_tasks(csv_file))

    lenient = StreamProcessor(on_error="skip")
    good = list(lenient.stream_tasks(csv_file))
    assert len(good) == 1
    assert lenient.error_count == 1


def test_empty_file_yields_nothing(tmp_path):
    empty = tmp_path / "empty.csv"
    empty.write_text("id,project_id,title,status,priority,created_at,updated_at\n", encoding="utf-8")
    processor = StreamProcessor()
    assert list(processor.stream_tasks(empty)) == []


def test_missing_file_raises_not_found(tmp_path):
    processor = StreamProcessor()
    with pytest.raises(FileNotFoundError):
        list(processor.stream_tasks(tmp_path / "missing.csv"))


def test_chunk_iterator_and_constant_memory(tmp_path):
    large_jsonl = tmp_path / "large.jsonl"
    with large_jsonl.open("w", encoding="utf-8") as fh:
        for i in range(5000):
            fh.write(
                json.dumps(
                    {
                        "id": f"t-{i}",
                        "project_id": "p-1",
                        "title": f"Task {i} payload " + ("x" * 100),
                        "status": "done" if i % 2 == 0 else "todo",
                        "priority": "medium",
                        "created_at": "2026-01-01T00:00:00Z",
                        "updated_at": "2026-01-02T00:00:00Z",
                    }
                )
                + "\n"
            )

    processor = StreamProcessor()
    tracemalloc.start()
    count = 0
    for chunk in processor.chunk_iterator(processor.stream_tasks(large_jsonl), 100):
        count += len(chunk)
    _current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    assert count == 5000
    # Peak memory during streaming 5000 records stays tiny (< 5 MB)
    assert peak < 5 * 1024 * 1024
