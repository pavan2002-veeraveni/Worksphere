"""Tests for streaming CSV, JSONL, and summary ReportGenerator."""

import csv
import json
from datetime import date

from worksphere_processing.metrics_calculator import ProductivityCalculator
from worksphere_processing.overdue_detector import OverdueDetector
from worksphere_processing.report_generator import ReportGenerator
from worksphere_processing.stream_processor import StreamProcessor


def test_generate_csv_and_column_filtering(sample_tasks_csv, tmp_path):
    processor = StreamProcessor()
    detector = OverdueDetector()
    reporter = ReportGenerator()

    out_csv = tmp_path / "overdue.csv"
    overdue_gen = detector.detect_overdue(
        processor.stream_tasks(sample_tasks_csv),
        reference_date=date(2026, 2, 1),
    )
    written = reporter.generate_csv(overdue_gen, out_csv, columns=["task_id", "title", "priority"])
    assert written == 8

    with out_csv.open("r", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    assert len(rows) == 8
    assert set(rows[0].keys()) == {"task_id", "title", "priority"}


def test_generate_jsonl_and_summary(sample_tasks_csv, tmp_path):
    processor = StreamProcessor()
    calc = ProductivityCalculator()
    reporter = ReportGenerator()

    metrics = calc.calculate_productivity(
        processor.stream_tasks(sample_tasks_csv),
        reference_date=date(2026, 2, 1),
    )
    team = calc.calculate_team_metrics(processor.stream_tasks(sample_tasks_csv))

    out_jsonl = tmp_path / "team.jsonl"
    written = reporter.generate_jsonl(team, out_jsonl)
    assert written == len(team)
    lines = out_jsonl.read_text(encoding="utf-8").strip().splitlines()
    assert json.loads(lines[0])["user_id"]

    summary_path = reporter.generate_summary_report(metrics, tmp_path / "summary.json")
    summary_data = json.loads(summary_path.read_text(encoding="utf-8"))
    assert summary_data["metrics"]["tasks_total"] == 20


def test_generate_csv_empty_data_with_columns(tmp_path):
    reporter = ReportGenerator()
    out_csv = tmp_path / "empty.csv"
    written = reporter.generate_csv([], out_csv, columns=["a", "b"])
    assert written == 0
    assert out_csv.read_text(encoding="utf-8").strip() == "a,b"
