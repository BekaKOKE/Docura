"""Settings read from the environment (and an optional `.env`). Every value has a development default."""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # memory = in-memory repositories, sql = SQLAlchemy repositories.
    storage: Literal["memory", "sql"] = "memory"
    database_url: str = "sqlite:///./docura.db"
    jwt_secret: str = "dev-secret-change-me"
    # Where the client's phone opens a share link; it must be reachable from that phone.
    public_base_url: str = "http://localhost:5173"
    # Comma separated in the environment: CORS_ORIGINS=http://a:5173,http://b:5173
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
