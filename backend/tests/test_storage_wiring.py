"""AC 5: `STORAGE=memory` wires the memory repositories into the app."""

import pytest
from fastapi.testclient import TestClient
from repo_factories import make_company
from test_repositories_protocols import PROTOCOL_OF_TABLE

from app.config import Settings
from app.main import create_app
from app.repositories import memory
from app.repositories.base import Storage
from app.repositories.memory import MemoryStorage


def memory_app(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("STORAGE", "memory")
    return create_app(Settings(_env_file=None))


def test_storage_memory_serves_health_on_the_memory_repositories(monkeypatch: pytest.MonkeyPatch) -> None:
    """TC-5."""
    app = memory_app(monkeypatch)
    with TestClient(app) as client:
        assert client.get("/api/health").json() == {"ok": True}
    assert isinstance(app.state.storage, MemoryStorage)
    assert isinstance(app.state.storage, Storage)
    uow = app.state.storage.unit_of_work()
    for table, protocol in PROTOCOL_OF_TABLE.items():
        repository = getattr(uow, table)
        assert isinstance(repository, protocol)
        assert type(repository).__module__ == memory.__name__


def test_memory_is_the_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("STORAGE", raising=False)
    assert isinstance(create_app(Settings(_env_file=None)).state.storage, MemoryStorage)


def test_the_wired_storage_keeps_data_between_units_of_work(monkeypatch: pytest.MonkeyPatch) -> None:
    storage = memory_app(monkeypatch).state.storage
    company = make_company()
    with storage.unit_of_work() as uow:
        uow.companies.add(company.id, company)
    with storage.unit_of_work() as uow:
        assert uow.companies.get(company.id) == company


def test_each_app_has_its_own_storage(monkeypatch: pytest.MonkeyPatch) -> None:
    company = make_company()
    with memory_app(monkeypatch).state.storage.unit_of_work() as uow:
        uow.companies.add(company.id, company)
    with memory_app(monkeypatch).state.storage.unit_of_work() as uow:
        assert uow.companies.get(company.id) is None


def test_storage_sql_refuses_to_start_until_m4(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("STORAGE", "sql")
    with pytest.raises(RuntimeError, match="STORAGE=sql"):
        create_app(Settings(_env_file=None))
