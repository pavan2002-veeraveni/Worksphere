"""Pytest fixtures for WorkSphere Analytics FastAPI tests."""

from __future__ import annotations

from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import get_db_session
from app.main import app


ORG_A = UUID("b0000000-0000-0000-0000-000000000001")
ORG_B = UUID("b0000000-0000-0000-0000-000000000002")
PROJECT_A1 = UUID("d0000000-0000-0000-0000-000000000001")
PROJECT_B1 = UUID("d0000000-0000-0000-0000-000000000004")
USER_1 = UUID("a0000000-0000-0000-0000-000000000002")
USER_2 = UUID("a0000000-0000-0000-0000-000000000003")


class FakeMappingsResult:
    def __init__(self, rows: list[dict]):
        self._rows = rows

    def first(self):
        return self._rows[0] if self._rows else None

    def all(self):
        return self._rows


class FakeExecuteResult:
    def __init__(self, rows: list[dict] | None = None, scalar_val=None):
        self._rows = rows or []
        self._scalar = scalar_val

    def mappings(self):
        return FakeMappingsResult(self._rows)

    def first(self):
        return self._rows[0] if self._rows else None

    def scalar(self):
        return self._scalar


@pytest.fixture
def api_headers() -> dict[str, str]:
    return {"X-API-Key": settings.API_KEY}


@pytest.fixture
def make_client():
    """Return a factory creating a TestClient with a scripted mock DB session."""

    def _factory(execute_handler):
        mock_session = AsyncMock()
        mock_session.execute.side_effect = execute_handler

        async def _override_db():
            yield mock_session

        app.dependency_overrides[get_db_session] = _override_db
        client = TestClient(app)
        return client

    yield _factory
    app.dependency_overrides.clear()
