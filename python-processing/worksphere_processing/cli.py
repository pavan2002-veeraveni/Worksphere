"""CLI entry point for worksphere-process."""

from __future__ import annotations

import argparse
from pathlib import Path

from worksphere_processing.metrics_calculator import ProductivityCalculator
from worksphere_processing.overdue_detector import OverdueDetector
from worksphere_processing.report_generator import ReportGenerator
from worksphere_processing.stream_processor import StreamProcessor


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Process WorkSphere task exports in streaming mode")
    parser.add_argument("input_file", help="Path to tasks CSV or JSONL export")
    parser.add_argument("--output-dir", default="reports", help="Output directory for generated reports")
    parser.add_argument("--skip-invalid", action="store_true", help="Skip invalid records instead of failing")
    args = parser.parse_args(argv)

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    processor = StreamProcessor(on_error="skip" if args.skip_invalid else "raise")
    calculator = ProductivityCalculator()
    detector = OverdueDetector()
    reporter = ReportGenerator()

    metrics = calculator.calculate_productivity(processor.stream_tasks(args.input_file))
    reporter.generate_summary_report(metrics, out_dir / "productivity_summary.json")

    overdue_count = reporter.generate_csv(
        detector.detect_overdue(processor.stream_tasks(args.input_file)),
        out_dir / "overdue_tasks.csv",
    )

    print(
        f"Processed {metrics.tasks_total} tasks "
        f"(completed={metrics.tasks_completed}, overdue={overdue_count}, errors={processor.error_count})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
