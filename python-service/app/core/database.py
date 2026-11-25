"""Async SQLAlchemy database engine and session management."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING, Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

_engine: Any = None
_session_factory: Any = None


def _prepare_async_database_url(raw_url: str) -> tuple[str, dict[str, Any]]:
    """Normalize PostgreSQL URLs for asyncpg and translate sslmode query flags."""
    url = raw_url.strip()
    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://") :]
    elif url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]

    connect_args: dict[str, Any] = {}
    parsed = urlparse(url)
    if parsed.query:
        kept_params: list[tuple[str, str]] = []
        for k, v in parse_qsl(parsed.query, keep_blank_values=True):
            lower_k = k.lower()
            if lower_k == "sslmode":
                if v.lower() in {"require", "verify-ca", "verify-full", "prefer"}:
                    connect_args["ssl"] = "require"
            elif lower_k == "channel_binding":
                continue
            else:
                kept_params.append((k, v))
        url = urlunparse(parsed._replace(query=urlencode(kept_params)))

    return url, connect_args


def get_engine() -> AsyncEngine:
    """Lazily create and return the async SQLAlchemy engine."""
    global _engine
    if _engine is None:
        from sqlalchemy.ext.asyncio import create_async_engine

        url, connect_args = _prepare_async_database_url(settings.DATABASE_URL)
        kwargs: dict[str, Any] = {"echo": False, "pool_pre_ping": True}
        if connect_args:
            kwargs["connect_args"] = connect_args
        if not url.startswith("sqlite"):
            kwargs["pool_size"] = settings.DB_POOL_SIZE
            kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW
        _engine = create_async_engine(url, **kwargs)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the async session factory."""
    global _session_factory
    if _session_factory is None:
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        _session_factory = async_sessionmaker(
            get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async database session."""
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_db_health() -> bool:
    """Check database connectivity by executing a simple query."""
    try:
        factory = get_session_factory()
        async with factory() as session:
            result = await session.execute(text("SELECT 1"))
            return result.scalar() == 1
    except (SQLAlchemyError, OSError, TimeoutError):
        return False


async def dispose_engine() -> None:
    """Dispose the database engine and release all connections."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None
