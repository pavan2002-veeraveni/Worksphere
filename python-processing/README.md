# WorkSphere Streaming Processing Package (`worksphere-processing`)

Memory-efficient Python package for streaming large task and activity exports, calculating productivity metrics, detecting overdue work, and generating CSV/JSONL reports without loading entire datasets into memory.

## Design Philosophy

- **Generator-first architecture**: `StreamProcessor` yields parsed, Pydantic-validated records one row at a time via Python generators (`yield` / `yield from`).
- **Single-pass streaming aggregations**: `ProductivityCalculator` and `OverdueDetector` accumulate only bounded counters and per-user summaries ($O(U)$ memory where $U$ is unique users), rather than storing all $N$ task records in memory.
- **Strict validation & controlled error recovery**: Configure `StreamProcessor(on_error="raise")` for fail-fast pipelines or `on_error="skip"` to log and bypass malformed rows while continuing the stream.

## Installation

```bash
cd python-processing
pip install -e .
```

## Quick Usage

```python
from worksphere_processing import (
    OverdueDetector,
    ProductivityCalculator,
    ReportGenerator,
    StreamProcessor,
)

processor = StreamProcessor(on_error="skip")
calculator = ProductivityCalculator()
detector = OverdueDetector()
reporter = ReportGenerator()

metrics = calculator.calculate_productivity(processor.stream_tasks("sample_data/tasks_export.csv"))
reporter.generate_summary_report(metrics, "out/summary.json")

overdue_stream = detector.detect_overdue(processor.stream_tasks("sample_data/tasks_export.csv"))
reporter.generate_csv(overdue_stream, "out/overdue.csv")
```

### CLI Usage

```bash
worksphere-process sample_data/tasks_export.csv --output-dir ./reports --skip-invalid
```

## Running Tests & Benchmark

```bash
pytest
python benchmark.py
```
