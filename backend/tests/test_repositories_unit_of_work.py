"""AC 3: an error inside a unit of work rolls back every change made in it."""

import threading
from dataclasses import replace
from datetime import date
from uuid import uuid4

import pytest
from repo_factories import (
    COUNTER,
    dump_tenant,
    make_client,
    make_company,
    make_document,
    make_line,
    make_payment,
    make_tenant,
    save_tenant,
)

from app.repositories.base import Storage, UniqueViolationError
from app.repositories.records import Client


class Boom(Exception):
    pass


def test_an_error_undoes_a_client_and_a_document(storage: Storage) -> None:
    """TC-3."""
    company = make_company()
    with storage.unit_of_work() as uow:
        uow.companies.add(company.id, company)

    client = make_client(company.id)
    document = make_document(company.id, client.id)
    with pytest.raises(Boom), storage.unit_of_work() as uow:
        uow.clients.add(company.id, client)
        uow.documents.add(company.id, document)
        assert uow.clients.get(company.id, client.id) is not None  # visible inside the unit of work
        raise Boom

    with storage.unit_of_work() as uow:
        assert uow.clients.get(company.id, client.id) is None
        assert uow.documents.get(company.id, document.id) is None
        assert uow.clients.search(company.id).total == 0
        assert uow.documents.search(company.id).total == 0


def test_an_error_undoes_new_rows_in_every_table(storage: Storage) -> None:
    tenant = make_tenant()
    with pytest.raises(Boom), storage.unit_of_work() as uow:
        save_tenant(uow, tenant)
        raise Boom

    with storage.unit_of_work() as uow:
        assert uow.users.get(tenant.user.id) is None
        assert uow.users.get_by_email(tenant.user.email) is None
        assert uow.users.list_memberships(tenant.user.id) == []
        assert uow.company_id_for_share_token(tenant.link.token) is None
        assert uow.companies.get(tenant.id) is None
        snapshot = dump_tenant(uow, tenant)
    assert snapshot["counter"] == 0
    assert snapshot["documents"].total == 0
    for name in ("memberships", "lines", "payments", "events"):
        assert snapshot[name] == []
    assert snapshot["link"] is None
    assert snapshot["signature"] is None


def test_an_error_undoes_changes_to_existing_rows_in_every_table(storage: Storage) -> None:
    tenant = make_tenant()
    with storage.unit_of_work() as uow:
        save_tenant(uow, tenant)
        before = dump_tenant(uow, tenant)

    with pytest.raises(Boom), storage.unit_of_work() as uow:
        uow.users.update(replace(tenant.user, full_name="Другой"))
        uow.companies.update(tenant.id, replace(tenant.company, legal_name="Другая"))
        uow.clients.update(tenant.id, replace(tenant.client, name="Другой"))
        uow.articles.update(tenant.id, replace(tenant.article, unit_price_tiyn=999))
        uow.documents.compare_and_set(tenant.id, tenant.document.id, 1, {"status": "sent", "number": "КП-2026-0001"})
        uow.document_lines.replace_for_document(tenant.id, tenant.document.id, [])
        uow.document_counters.next_number(tenant.id, *COUNTER)
        uow.share_links.update(tenant.id, replace(tenant.link, view_count=7))
        uow.payments.delete(tenant.id, tenant.payment.id)
        uow.document_events.add(tenant.id, replace(tenant.event, id=uuid4()))
        raise Boom

    with storage.unit_of_work() as uow:
        assert dump_tenant(uow, tenant) == before


def test_an_error_undoes_a_cascading_delete(storage: Storage) -> None:
    tenant = make_tenant()
    with storage.unit_of_work() as uow:
        save_tenant(uow, tenant)
        before = dump_tenant(uow, tenant)

    with pytest.raises(Boom), storage.unit_of_work() as uow:
        uow.documents.delete(tenant.id, tenant.document.id)
        raise Boom

    with storage.unit_of_work() as uow:
        assert dump_tenant(uow, tenant) == before


def test_rollback_also_covers_exceptions_that_are_not_errors(storage: Storage) -> None:
    company = make_company()
    with pytest.raises(KeyboardInterrupt), storage.unit_of_work() as uow:
        uow.companies.add(company.id, company)
        raise KeyboardInterrupt

    with storage.unit_of_work() as uow:
        assert uow.companies.get(company.id) is None


def test_a_clean_exit_commits(storage: Storage) -> None:
    tenant = make_tenant()
    with storage.unit_of_work() as uow:
        save_tenant(uow, tenant)
        expected = dump_tenant(uow, tenant)

    with storage.unit_of_work() as uow:
        assert dump_tenant(uow, tenant) == expected
        assert expected["clients"].total == 1
        assert expected["counter"] == 1


def test_a_rolled_back_number_is_taken_again_so_numbering_has_no_gaps(storage: Storage) -> None:
    company = make_company()
    with storage.unit_of_work() as uow:
        uow.companies.add(company.id, company)
        assert uow.document_counters.next_number(company.id, "quote", 2026) == 1

    with pytest.raises(Boom), storage.unit_of_work() as uow:
        assert uow.document_counters.next_number(company.id, "quote", 2026) == 2
        raise Boom

    with storage.unit_of_work() as uow:
        assert uow.document_counters.last_number(company.id, "quote", 2026) == 1
        assert uow.document_counters.next_number(company.id, "quote", 2026) == 2


def test_units_of_work_do_not_nest(storage: Storage) -> None:
    company = make_company()
    with storage.unit_of_work() as uow:
        uow.companies.add(company.id, company)
        with pytest.raises(RuntimeError, match="nest"), storage.unit_of_work():
            pass
        # The refused inner one took nothing with it: the outer one carries on and commits.
        assert uow.companies.get(company.id) is not None

    with storage.unit_of_work() as uow:
        assert uow.companies.get(company.id) is not None


def test_repositories_refuse_to_work_outside_a_unit_of_work(storage: Storage) -> None:
    unit = storage.unit_of_work()
    with pytest.raises(RuntimeError, match="unit_of_work"):
        unit.users.get(make_company().id)

    with unit as uow:
        repository = uow.clients
    with pytest.raises(RuntimeError, match="unit_of_work"):
        repository.search(make_company().id)


def test_changing_a_record_changes_nothing_until_it_is_saved(storage: Storage) -> None:
    tenant = make_tenant()
    with storage.unit_of_work() as uow:
        save_tenant(uow, tenant)

    tenant.document.client_snapshot["name"] = "изменено после сохранения"
    with storage.unit_of_work() as uow:
        loaded = uow.documents.get(tenant.id, tenant.document.id)
        assert loaded.client_snapshot == {"name": "Қайрат"}
        loaded.client_snapshot["name"] = "изменено после чтения"
        assert uow.documents.get(tenant.id, tenant.document.id).client_snapshot == {"name": "Қайрат"}
        found = uow.documents.search(tenant.id).items[0]
        found.company_snapshot["legalName"] = "изменено в списке"
        assert uow.documents.get(tenant.id, tenant.document.id).company_snapshot == {"legalName": "ИП Әсем"}


def test_a_rollback_keeps_what_committed_before_it(storage: Storage) -> None:
    company = make_company()
    first = make_client(company.id, name="Первый")
    with storage.unit_of_work() as uow:
        uow.companies.add(company.id, company)
        uow.clients.add(company.id, first)

    with pytest.raises(Boom), storage.unit_of_work() as uow:
        uow.clients.add(company.id, make_client(company.id, name="Второй"))
        raise Boom

    with storage.unit_of_work() as uow:
        assert [row.id for row in uow.clients.search(company.id).items] == [first.id]


def test_a_second_thread_waits_and_never_sees_uncommitted_rows(storage: Storage) -> None:
    company = make_company()
    with storage.unit_of_work() as uow:
        uow.companies.add(company.id, company)

    client = make_client(company.id)
    started = threading.Event()
    seen: list[Client | None] = []

    def reader() -> None:
        started.set()
        with storage.unit_of_work() as other:
            seen.append(other.clients.get(company.id, client.id))

    thread = threading.Thread(target=reader)
    with pytest.raises(Boom), storage.unit_of_work() as uow:
        uow.clients.add(company.id, client)
        thread.start()
        started.wait(timeout=5)
        thread.join(timeout=0.05)
        assert thread.is_alive()  # it is blocked by this unit of work
        raise Boom
    thread.join(timeout=5)

    assert seen == [None]


def test_the_lock_is_released_after_an_error(storage: Storage) -> None:
    with pytest.raises(Boom), storage.unit_of_work():
        raise Boom

    finished: list[bool] = []

    def other_thread() -> None:
        with storage.unit_of_work():
            finished.append(True)

    thread = threading.Thread(target=other_thread)
    thread.start()
    thread.join(timeout=5)
    assert finished == [True]


def test_parallel_numbers_are_unique_and_gap_free(storage: Storage) -> None:
    company = make_company()
    with storage.unit_of_work() as uow:
        uow.companies.add(company.id, company)

    workers = 16
    barrier = threading.Barrier(workers)
    numbers: list[int] = []

    def take_number() -> None:
        barrier.wait(timeout=5)
        with storage.unit_of_work() as uow:
            numbers.append(uow.document_counters.next_number(company.id, "invoice", 2026))

    threads = [threading.Thread(target=take_number) for _ in range(workers)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=5)

    assert sorted(numbers) == list(range(1, workers + 1))


def test_parallel_failures_and_successes_do_not_mix(storage: Storage) -> None:
    tenant = make_tenant()
    with storage.unit_of_work() as uow:
        save_tenant(uow, tenant)

    workers = 16
    barrier = threading.Barrier(workers)

    def work(index: int) -> None:
        barrier.wait(timeout=5)
        try:
            with storage.unit_of_work() as uow:
                payment = make_payment(
                    tenant.id, tenant.document.id, amount_tiyn=index + 1, paid_on=date(2026, 11, index + 1)
                )
                uow.payments.add(tenant.id, payment)
                if index % 2:
                    raise Boom
        except Boom:
            pass

    threads = [threading.Thread(target=work, args=(index,)) for index in range(workers)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=5)

    with storage.unit_of_work() as uow:
        amounts = [row.amount_tiyn for row in uow.payments.list_for_document(tenant.id, tenant.document.id)]
    assert sorted(amounts) == sorted([tenant.payment.amount_tiyn, *(i + 1 for i in range(0, workers, 2))])


def test_replacing_lines_with_a_bad_one_keeps_the_old_ones_even_if_the_error_is_caught(storage: Storage) -> None:
    tenant = make_tenant()
    with storage.unit_of_work() as uow:
        save_tenant(uow, tenant)
        bad = [make_line(tenant.id, tenant.document.id), make_line(tenant.id, tenant.document.id)]  # same position
        with pytest.raises(UniqueViolationError, match="document_lines_position_uq"):
            uow.document_lines.replace_for_document(tenant.id, tenant.document.id, bad)
        assert [row.id for row in uow.document_lines.list_for_document(tenant.id, tenant.document.id)] == [
            tenant.line.id
        ]
