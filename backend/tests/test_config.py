import logging
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

ENV_NAMES = ["STORAGE", "DATABASE_URL", "JWT_SECRET", "PUBLIC_BASE_URL", "CORS_ORIGINS"]


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ENV_NAMES:
        monkeypatch.delenv(name, raising=False)


def test_defaults_without_any_environment() -> None:
    settings = Settings(_env_file=None)
    assert settings.storage == "memory"
    assert settings.database_url == "sqlite:///./docura.db"
    assert settings.jwt_secret
    assert settings.public_base_url == "http://localhost:5173"
    assert settings.cors_origins == ["http://localhost:5173", "http://127.0.0.1:5173"]


def test_the_app_starts_with_the_defaults() -> None:
    with TestClient(create_app(Settings(_env_file=None))) as client:
        assert client.get("/api/health").json() == {"ok": True}


def test_environment_overrides_every_value(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("STORAGE", "sql")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./x.db")
    monkeypatch.setenv("JWT_SECRET", "s")
    monkeypatch.setenv("PUBLIC_BASE_URL", "http://192.168.1.10:5173")
    monkeypatch.setenv("CORS_ORIGINS", "http://192.168.1.10:5173")
    settings = Settings(_env_file=None)
    assert settings.storage == "sql"
    assert settings.database_url == "sqlite:///./x.db"
    assert settings.jwt_secret == "s"
    assert settings.public_base_url == "http://192.168.1.10:5173"
    assert settings.cors_origins == ["http://192.168.1.10:5173"]


def test_cors_origins_are_comma_separated(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://a:5173, http://b:5173 ,")
    assert Settings(_env_file=None).cors_origins == ["http://a:5173", "http://b:5173"]


def test_storage_accepts_only_memory_or_sql(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("STORAGE", "redis")
    with pytest.raises(ValueError):
        Settings(_env_file=None)


def test_cors_follows_the_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://192.168.1.10:5173")
    with TestClient(create_app(Settings(_env_file=None))) as client:
        allowed = client.get("/api/health", headers={"Origin": "http://192.168.1.10:5173"})
        denied = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert allowed.headers["access-control-allow-origin"] == "http://192.168.1.10:5173"
    assert "access-control-allow-origin" not in denied.headers


def test_no_fixed_jwt_secret_is_the_default() -> None:
    first, second = Settings(_env_file=None), Settings(_env_file=None)
    assert first.jwt_secret_is_random
    assert len(first.jwt_secret) >= 32
    assert first.jwt_secret != second.jwt_secret


@pytest.mark.parametrize("blank", ["", "   "])
def test_a_blank_jwt_secret_counts_as_unset(monkeypatch: pytest.MonkeyPatch, blank: str) -> None:
    monkeypatch.setenv("JWT_SECRET", blank)
    settings = Settings(_env_file=None)
    assert settings.jwt_secret_is_random
    assert settings.jwt_secret.strip()


def test_a_set_jwt_secret_is_kept_and_short_ones_are_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET", "s")
    settings = Settings(_env_file=None)
    assert settings.jwt_secret == "s"
    assert not settings.jwt_secret_is_random


def test_startup_warns_when_the_jwt_secret_is_random(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING, logger="app.main"):
        create_app(Settings(_env_file=None))
    assert "JWT_SECRET is not set" in caplog.text
    assert "survive a restart" in caplog.text
    assert "Production must set it" in caplog.text


def test_startup_is_quiet_when_the_jwt_secret_is_set(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setenv("JWT_SECRET", "a-secret-for-this-test")
    with caplog.at_level(logging.WARNING, logger="app.main"):
        create_app(Settings(_env_file=None))
    assert "JWT_SECRET" not in caplog.text


def test_the_env_example_ships_no_usable_secret() -> None:
    example = (Path(__file__).parents[1] / ".env.example").read_text(encoding="utf-8")
    assert "JWT_SECRET=" in example.splitlines()
