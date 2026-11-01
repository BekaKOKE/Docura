"""AC 2: the memory implementation satisfies the Protocols. No type checker is agreed, so `isinstance` checks that the
methods exist and the signature comparison checks that they take the same arguments."""

import inspect

import pytest
from test_repositories_protocols import PROTOCOL_OF_TABLE, protocol_methods

from app.repositories import base
from app.repositories.memory import MemoryStorage, MemoryUnitOfWork

TABLES = list(PROTOCOL_OF_TABLE)


def repository(table: str) -> object:
    return getattr(MemoryStorage().unit_of_work(), table)


@pytest.mark.parametrize("table", TABLES)
def test_memory_repository_is_an_instance_of_its_protocol(table: str) -> None:
    assert isinstance(repository(table), PROTOCOL_OF_TABLE[table])


@pytest.mark.parametrize("table", TABLES)
def test_a_protocol_is_not_satisfied_by_just_anything(table: str) -> None:
    # Guards the check above.
    assert not isinstance(object(), PROTOCOL_OF_TABLE[table])


def test_storage_and_unit_of_work_are_instances_of_their_protocols() -> None:
    storage = MemoryStorage()
    assert isinstance(storage, base.Storage)
    assert isinstance(storage.unit_of_work(), base.UnitOfWork)


@pytest.mark.parametrize(
    ("table", "method"),
    [(table, method) for table in TABLES for method in protocol_methods(PROTOCOL_OF_TABLE[table])],
)
def test_memory_method_takes_the_same_arguments_as_the_protocol(table: str, method: str) -> None:
    wanted = inspect.signature(getattr(PROTOCOL_OF_TABLE[table], method))
    found = inspect.signature(getattr(type(repository(table)), method))
    summary = [(p.name, p.kind, p.default) for p in wanted.parameters.values()]
    assert [(p.name, p.kind, p.default) for p in found.parameters.values()] == summary


@pytest.mark.parametrize("table", TABLES)
def test_memory_repository_offers_nothing_the_protocol_does_not(table: str) -> None:
    # A service that used an extra public method would run on memory and break on SQL.
    found = {name for name in dir(type(repository(table))) if not name.startswith("_")} - {"table", "references"}
    assert found == set(protocol_methods(PROTOCOL_OF_TABLE[table]))


def test_unit_of_work_has_a_repository_per_table() -> None:
    declared = set(inspect.get_annotations(base.UnitOfWork))
    assert declared == set(TABLES)
    assert hasattr(MemoryUnitOfWork, "company_id_for_share_token")
