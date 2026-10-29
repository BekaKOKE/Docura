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
