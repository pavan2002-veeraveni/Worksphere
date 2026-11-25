"""Benchmark script demonstrating constant-memory streaming over 50,000 task records."""

from __future__ import annotations

import json
import tempfile
import time
import tracemalloc
from pathlib import Path

from worksphere_processing import ProductivityCalculator, StreamProcessor


def run_benchmark(num_records: int = 50_000) -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        jsonl_path = Path(tmp) / "benchmark_tasks.jsonl"
        with jsonl_path.open("w", encoding="utf-8") as fh:
            for i in range(num_records):
                fh.write(
                    json.dumps(
                        {
                            "id": f"task-{i}",
                            "project_id": f"proj-{i % 10}",
                            "title": f"Benchmark Task #{i}",
                            "status": "done" if i % 3 == 0 else "in_progress",
                            "priority": "high" if i % 5 == 0 else "medium",
                            "assignee_id": f"user-{i % 25}",
                            "created_at": "2026-01-01T08:00:00Z",
                            "updated_at": "2026-01-05T16:00:00Z",
                            "due_date": "2026-01-10",
                            "estimated_hours": 8.0,
                            "actual_hours": 7.5,
                        }
                    )
                    + "\n"
                )

        processor = StreamProcessor()
        calc = ProductivityCalculator()

        tracemalloc.start()
        t0 = time.perf_counter()
        metrics = calc.calculate_productivity(processor.stream_tasks(jsonl_path))
        elapsed = time.perf_counter() - t0
        _current, peak_bytes = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        return {
            "records": metrics.tasks_total,
            "completed": metrics.tasks_completed,
            "elapsed_seconds": round(elapsed, 3),
            "records_per_second": round(num_records / max(elapsed, 0.001), 1),
            "peak_memory_mb": round(peak_bytes / (1024 * 1024), 3),
        }


if __name__ == "__main__":
    print(json.dumps(run_benchmark(), indent=2))
