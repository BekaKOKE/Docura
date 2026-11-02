"""Settings read from the environment (and an optional `.env`). Every value has a development default; the one for
`JWT_SECRET` is random, so a secret known from this repository can never sign a token."""

import secrets
from functools import lru_cache
from typing import Annotated, Literal, Self

from pydantic import PrivateAttr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # memory = in-memory repositories, sql = SQLAlchemy repositories.
    storage: Literal["memory", "sql"] = "memory"
    database_url: str = "sqlite:///./docura.db"
    # Empty means not set: a new random secret per process, and tokens that don't survive a restart.
    jwt_secret: str = ""
    # Where the client's phone opens a share link; it must be reachable from that phone.
    public_base_url: str = "http://localhost:5173"
    # Comma separated in the environment: CORS_ORIGINS=http://a:5173,http://b:5173
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    _jwt_secret_is_random: bool = PrivateAttr(default=False)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def _fill_in_jwt_secret(self) -> Self:
        if not self.jwt_secret.strip():
            self.jwt_secret = secrets.token_urlsafe(32)
            self._jwt_secret_is_random = True
        return self

    @property
    def jwt_secret_is_random(self) -> bool:
        return self._jwt_secret_is_random


@lru_cache
def get_settings() -> Settings:
    return Settings()
