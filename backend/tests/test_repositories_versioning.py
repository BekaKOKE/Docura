"""AC 4: a compare-and-set on `documents.version` with a stale version fails and changes nothing."""

import threading
from datetime import timedelta
from uuid import uuid4

import pytest
from repo_factories import make_client, make_company, make_document, make_tenant, save_tenant

from app.repositories.base import NotFoundError, Storage, UniqueViolationError, VersionConflictError
from app.repositories.records import Document


@pytest.fixture
def document(storage: Storage) -> Document:
    """A saved document at version 3."""
    company = make_company()
    client = make_client(company.id)
    made = make_document(company.id, client.id, version=3)
    with storage.unit_of_work() as uow:
        uow.companies.add(company.id, company)
        uow.clients.add(company.id, client)
        return uow.documents.add(company.id, made)


def race(storage: Storage, document: Document, expected: int, workers: int) -> tuple[list[Document], list[Exception]]:
    barrier = threading.Barrier(workers)
    winners: list[Document] = []
    losers: list[Exception] = []

    def attempt(index: int) -> None:
        barrier.wait(timeout=5)
        try:
            with storage.unit_of_work() as uow:
                winners.append(
                    uow.documents.compare_and_set(
                        document.company_id, document.id, expected, {"notes": f"поток {index}"}
                    )
                )
        except VersionConflictError as error:
            losers.append(error)

    threads = [threading.Thread(target=attempt, args=(index,)) for index in range(workers)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=5)
    return winners, losers


def test_stale_then_current_then_two_threads(storage: Storage, document: Document) -> None:
    """TC-4, in the order the test case gives."""
    cid, did = document.company_id, document.id

    with pytest.raises(VersionConflictError), storage.unit_of_work() as uow:
        uow.documents.compare_and_set(cid, did, 2, {"notes": "устарело"})
    with storage.unit_of_work() as uow:
        unchanged = uow.documents.get(cid, did)
    assert unchanged == document  # every field, `version` and `updated_at` included

    with storage.unit_of_work() as uow:
        updated = uow.documents.compare_and_set(cid, did, 3, {"notes": "актуально"})
    assert (updated.version, updated.notes) == (4, "актуально")
    with storage.unit_of_work() as uow:
        assert uow.documents.get(cid, did) == updated

    winners, losers = race(storage, document, expected=4, workers=2)
    assert len(winners) == 1
    assert len(losers) == 1
    with storage.unit_of_work() as uow:
        final = uow.documents.get(cid, did)
    assert final == winners[0]
    assert final.version == 5


@pytest.mark.parametrize("workers", [2, 16])
def test_exactly_one_of_many_threads_wins(storage: Storage, document: Document, workers: int) -> None:
    winners, losers = race(storage, document, expected=3, workers=workers)
    assert len(winners) == 1
    assert len(losers) == workers - 1
    with storage.unit_of_work() as uow:
        assert uow.documents.get(document.company_id, document.id) == winners[0]


def test_a_conflict_caught_inside_the_unit_of_work_changes_nothing(storage: Storage, document: Document) -> None:
    with storage.unit_of_work() as uow:
        with pytest.raises(VersionConflictError):
            uow.documents.compare_and_set(document.company_id, document.id, 2, {"notes": "устарело"})
        assert uow.documents.get(document.company_id, document.id) == document
    with storage.unit_of_work() as uow:
        assert uow.documents.get(document.company_id, document.id) == document


def test_a_conflict_left_uncaught_undoes_the_rest_of_the_unit_of_work(storage: Storage, document: Document) -> None:
    other = make_client(document.company_id)
    with pytest.raises(VersionConflictError), storage.unit_of_work() as uow:
        uow.clients.add(document.company_id, other)
        uow.documents.compare_and_set(document.company_id, document.id, 2, {"notes": "устарело"})
    with storage.unit_of_work() as uow:
        assert uow.clients.get(document.company_id, other.id) is None


def test_a_newer_expected_version_is_a_conflict_too(storage: Storage, document: Document) -> None:
    with pytest.raises(VersionConflictError), storage.unit_of_work() as uow:
        uow.documents.compare_and_set(document.company_id, document.id, 4, {"notes": "из будущего"})


def test_a_successful_set_bumps_by_one_and_moves_updated_at(storage: Storage, document: Document) -> None:
    with storage.unit_of_work() as uow:
        updated = uow.documents.compare_and_set(document.company_id, document.id, 3, {})
    assert updated.version == 4
    assert updated.updated_at >= document.updated_at
    assert updated.updated_at.utcoffset() == timedelta(0)
    assert updated.created_at == document.created_at


@pytest.mark.parametrize("name", ["version", "id", "company_id", "type", "created_by", "created_at", "updated_at"])
def test_the_fields_a_set_may_not_touch_are_refused(storage: Storage, document: Document, name: str) -> None:
    with pytest.raises(ValueError, match=name), storage.unit_of_work() as uow:
        uow.documents.compare_and_set(document.company_id, document.id, 3, {name: getattr(document, name)})
    with storage.unit_of_work() as uow:
        assert uow.documents.get(document.company_id, document.id) == document


def test_an_unknown_field_is_refused(storage: Storage, document: Document) -> None:
    with pytest.raises(TypeError), storage.unit_of_work() as uow:
        uow.documents.compare_and_set(document.company_id, document.id, 3, {"nonsense": 1})


def test_a_float_total_is_refused_and_changes_nothing(storage: Storage, document: Document) -> None:
    with storage.unit_of_work() as uow:
        with pytest.raises(ValueError, match="gross_tiyn"):
            uow.documents.compare_and_set(document.company_id, document.id, 3, {"gross_tiyn": 10.5})
        assert uow.documents.get(document.company_id, document.id) == document


def test_a_number_already_taken_is_refused_and_changes_nothing(storage: Storage) -> None:
    tenant = make_tenant()
    with storage.unit_of_work() as uow:
        save_tenant(uow, tenant)
        other = make_document(tenant.id, tenant.client.id, status="sent", number="КП-2026-0001")
        uow.documents.add(tenant.id, other)
        with pytest.raises(UniqueViolationError) as caught:
            uow.documents.compare_and_set(tenant.id, tenant.document.id, 1, {"number": "КП-2026-0001"})
        assert caught.value.constraint == "documents_number_uq"
        assert uow.documents.get(tenant.id, tenant.document.id) == tenant.document


def test_a_missing_document_is_not_found_rather_than_a_conflict(storage: Storage, document: Document) -> None:
    with pytest.raises(NotFoundError), storage.unit_of_work() as uow:
        uow.documents.compare_and_set(document.company_id, uuid4(), 3, {"notes": "нет такого"})
