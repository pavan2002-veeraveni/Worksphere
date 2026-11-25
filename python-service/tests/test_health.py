"""Tests for health, readiness, and metrics endpoints."""

from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint():
    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "healthy"
    assert "version" in body
    assert "X-Request-ID" in res.headers


def test_ready_endpoint_healthy():
    client = TestClient(app)
    with (
        patch("app.api.health.check_db_health", new=AsyncMock(return_value=True)),
        patch("app.api.health._check_redis_health", new=AsyncMock(return_value=True)),
    ):
        res = client.get("/ready")
    assert res.status_code == 200
    assert res.json() == {"status": "ready", "checks": {"database": "up", "redis": "up"}}


def test_ready_endpoint_degraded_returns_503():
    client = TestClient(app)
    with (
        patch("app.api.health.check_db_health", new=AsyncMock(return_value=False)),
        patch("app.api.health._check_redis_health", new=AsyncMock(return_value=True)),
    ):
        res = client.get("/ready")
    assert res.status_code == 503
    assert res.json() == {"status": "degraded", "checks": {"database": "down", "redis": "up"}}


def test_metrics_endpoint():
    client = TestClient(app)
    res = client.get("/metrics")
    assert res.status_code == 200
    assert "uptime_seconds" in res.json()
