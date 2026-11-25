"""Application configuration using Pydantic Settings."""

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """WorkSphere Analytics service configuration."""

    APP_NAME: str = "WorkSphere Analytics"
    APP_VERSION: str = "1.0.0"
    LOG_LEVEL: str = "INFO"

    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://worksphere_user:devpassword@localhost:5432/worksphere",
        validation_alias=AliasChoices("DATABASE_URL", "ANALYTICS_DATABASE_URL", "WORKSPHERE_DATABASE_URL"),
    )
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        validation_alias=AliasChoices("REDIS_URL", "WORKSPHERE_REDIS_URL"),
    )

    API_KEY: str = Field(
        default="ws-analytics-default-key",
        validation_alias=AliasChoices("API_KEY", "ANALYTICS_SERVICE_API_KEY", "WORKSPHERE_API_KEY"),
    )

    JWT_SECRET: str = Field(
        default="dev-jwt-secret-change-in-production",
        validation_alias=AliasChoices("JWT_SECRET", "WORKSPHERE_JWT_SECRET"),
    )

    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:4000", "http://localhost:8080"]

    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10

    model_config = {
        "env_file": (".env", "../.env"),
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }


settings = Settings()
