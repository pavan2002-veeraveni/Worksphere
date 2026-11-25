"""Shared pytest fixtures for worksphere_processing tests."""

from pathlib import Path

import pytest


@pytest.fixture
def sample_tasks_csv() -> Path:
    return Path(__file__).resolve().parent.parent / "sample_data" / "tasks_export.csv"


@pytest.fixture
def sample_activities_csv() -> Path:
    return Path(__file__).resolve().parent.parent / "sample_data" / "activities_export.csv"
