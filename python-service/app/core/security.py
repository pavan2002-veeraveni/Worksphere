"""API key security dependency for FastAPI."""

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from app.core.config import settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(
    api_key: str | None = Security(api_key_header),
) -> str:
    """FastAPI dependency that validates the X-API-Key header.

    Raises:
        HTTPException: 401 if the key is missing or does not match.
    """
    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key. Provide X-API-Key header.",
        )
    if api_key != settings.API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key.",
        )
    return api_key
