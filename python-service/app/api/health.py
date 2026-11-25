"""Health, readiness, and metrics endpoints for the FastAPI analytics service."""

from __future__ import annotations

import time

import redis.asyncio as aioredis
from fastapi import APIRouter, Response, status
from redis.exceptions import RedisError

from app.core.config import settings
from app.core.database import check_db_health
from app.core.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["Health"])

_start_time = time.monotonic()


async def _check_redis_health() -> bool:
    """Ping Redis if available, returning True when healthy."""
    try:
        client = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=2, socket_timeout=2)
        try:
            pong = await client.ping()
            return bool(pong)
        finally:
            await client.aclose()
    except (RedisError, OSError, TimeoutError):
        return False


@router.get("/health", summary="Liveness check")
async def health() -> dict:
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "uptime_seconds": round(time.monotonic() - _start_time, 2),
    }


@router.get("/ready", summary="Readiness check (PostgreSQL and Redis)")
async def readiness(response: Response) -> dict:
    db_ok = await check_db_health()
    redis_ok = await _check_redis_health()

    all_ready = db_ok and redis_ok
    if not all_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "ready" if all_ready else "degraded",
        "checks": {
            "database": "up" if db_ok else "down",
            "redis": "up" if redis_ok else "down",
        },
    }


@router.get("/metrics", summary="Basic service metrics")
async def metrics() -> dict:
    return {
        "service": settings.APP_NAME,
        "uptime_seconds": round(time.monotonic() - _start_time, 2),
    }
