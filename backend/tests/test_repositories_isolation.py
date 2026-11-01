"""Tenancy: another company's id behaves exactly like an id that doesn't exist, on every method that takes one."""

from collections.abc import Callable
from dataclasses import dataclass, replace
from typing import Any
from uuid import uuid4

import pytest
from repo_factories import (
    COUNTER,
    Tenant,
    dump_tenant,
    make_article,
    make_client,
    make_document,
    make_event,
    make_line,
    make_link,
    make_payment,
    make_signature,
    make_tenant,
    save_tenant,
)

from app.repositories.base import NotFoundError, Storage
from app.repositories.records import Membership


@dataclass(frozen=True)
class World:
    storage: Storage
    mine: Tenant
    other: Tenant
    missing: Tenant  # never saved: its ids exist nowhere


@pytest.fixture
def world(storage: Storage) -> World:
    mine, other = make_tenant(), make_tenant()
    with storage.unit_of_work() as uow:
        save_tenant(uow, mine)
        save_tenant(uow, other)
    return World(storage=storage, mine=mine, other=other, missing=make_tenant())


# Each read is given the unit of work, my company's id and the tenant whose ids it asks for.
READS: dict[str, Callable[[Any, Any, Tenant], Any]] = {
    "memberships.get": lambda uow, me, t: uow.memberships.get(me, t.user.id),
    "clients.get": lambda uow, me, t: uow.clients.get(me, t.client.id),
    "articles.get": lambda uow, me, t: uow.articles.get(me, t.article.id),
    "documents.get": lambda uow, me, t: uow.documents.get(me, t.document.id),
    "documents.get_by_client_request_id": lambda uow, me, t: uow.documents.get_by_client_request_id(
        me, t.document.client_request_id
    ),
    "payments.get_by_client_request_id": lambda uow, me, t: uow.payments.get_by_client_request_id(
        me, t.payment.client_request_id
    ),
    "document_lines.list_for_document": lambda uow, me, t: uow.document_lines.list_for_document(me, t.document.id),
    "share_links.get": lambda uow, me, t: uow.share_links.get(me, t.link.id),
    "share_links.get_by_token": lambda uow, me, t: uow.share_links.get_by_token(me, t.link.token),
    "share_links.get_for_document": lambda uow, me, t: uow.share_links.get_for_document(me, t.document.id),
    "signatures.get_for_document": lambda uow, me, t: uow.signatures.get_for_document(me, t.document.id),
    "payments.get": lambda uow, me, t: uow.payments.get(me, t.payment.id),
    "payments.list_for_document": lambda uow, me, t: uow.payments.list_for_document(me, t.document.id),
    "document_events.list_for_document": lambda uow, me, t: uow.document_events.list_for_document(me, t.document.id),
}

# Each write is given the same, and must raise NotFoundError. `w` is my own tenant, for writes that mix the two.
WRITES: dict[str, Callable[[Any, Any, Tenant, Tenant], Any]] = {
    "companies.add under another id": lambda uow, me, t, w: uow.companies.add(me, t.company),
    "companies.update of another": lambda uow, me, t, w: uow.companies.update(me, t.company),
    "memberships.add for another company": lambda uow, me, t, w: uow.memberships.add(
        me, Membership(company_id=t.id, user_id=w.user.id)
    ),
    "clients.add for another company": lambda uow, me, t, w: uow.clients.add(me, make_client(t.id)),
    "clients.update as it is": lambda uow, me, t, w: uow.clients.update(me, t.client),
    "clients.update claiming it": lambda uow, me, t, w: uow.clients.update(me, replace(t.client, company_id=me)),
    "clients.delete": lambda uow, me, t, w: uow.clients.delete(me, t.client.id),
    "articles.add for another company": lambda uow, me, t, w: uow.articles.add(me, make_article(t.id)),
    "articles.update as it is": lambda uow, me, t, w: uow.articles.update(me, t.article),
    "articles.update claiming it": lambda uow, me, t, w: uow.articles.update(me, replace(t.article, company_id=me)),
    "documents.add for another company": lambda uow, me, t, w: uow.documents.add(me, make_document(t.id, t.client.id)),
    "documents.add with their client": lambda uow, me, t, w: uow.documents.add(me, make_document(me, t.client.id)),
    "documents.add from their quote": lambda uow, me, t, w: uow.documents.add(
        me, make_document(me, w.client.id, type="invoice", source_document_id=t.document.id)
    ),
    "documents.compare_and_set": lambda uow, me, t, w: uow.documents.compare_and_set(me, t.document.id, 1, {}),
    "documents.compare_and_set to their client": lambda uow, me, t, w: uow.documents.compare_and_set(
        me, w.document.id, 1, {"client_id": t.client.id}
    ),
    "documents.delete": lambda uow, me, t, w: uow.documents.delete(me, t.document.id),
    "document_lines.replace on their document": lambda uow, me, t, w: uow.document_lines.replace_for_document(
        me, t.document.id, []
    ),
    "document_lines.replace with their company": lambda uow, me, t, w: uow.document_lines.replace_for_document(
        me, w.document.id, [make_line(t.id, w.document.id)]
    ),
    "document_lines.replace with their article": lambda uow, me, t, w: uow.document_lines.replace_for_document(
        me, w.document.id, [make_line(me, w.document.id, article_id=t.article.id)]
    ),
    "document_lines.replace with a line of their document": lambda uow, me, t, w: (
        uow.document_lines.replace_for_document(me, w.document.id, [make_line(me, t.document.id)])
    ),
    "share_links.add on their document": lambda uow, me, t, w: uow.share_links.add(me, make_link(me, t.document.id)),
    "share_links.update as it is": lambda uow, me, t, w: uow.share_links.update(me, t.link),
    "share_links.update claiming it": lambda uow, me, t, w: uow.share_links.update(me, replace(t.link, company_id=me)),
    "signatures.add on their document": lambda uow, me, t, w: uow.signatures.add(me, make_signature(me, t.document.id)),
    "signatures.add through their link": lambda uow, me, t, w: uow.signatures.add(
        me, make_signature(me, w.document.id, signer_role="client", share_link_id=t.link.id)
    ),
    "payments.add on their document": lambda uow, me, t, w: uow.payments.add(me, make_payment(me, t.document.id)),
    "payments.delete": lambda uow, me, t, w: uow.payments.delete(me, t.payment.id),
    "document_events.add on their document": lambda uow, me, t, w: uow.document_events.add(
        me, make_event(me, t.document.id)
    ),
}


@pytest.mark.parametrize("read", READS.values(), ids=READS)
def test_reading_another_company_is_the_same_as_reading_nothing(world: World, read: Callable[..., Any]) -> None:
    with world.storage.unit_of_work() as uow:
        foreign = read(uow, world.mine.id, world.other)
        absent = read(uow, world.mine.id, world.missing)
    assert foreign == absent
    assert not foreign


@pytest.mark.parametrize("read", READS.values(), ids=READS)
def test_each_read_does_find_my_own_row(world: World, read: Callable[..., Any]) -> None:
    # Guards the test above: a read that always returned nothing would pass it.
    with world.storage.unit_of_work() as uow:
        assert read(uow, world.mine.id, world.mine)


@pytest.mark.parametrize("write", WRITES.values(), ids=WRITES)
@pytest.mark.parametrize("target", ["other", "missing"])
def test_writing_to_another_company_is_not_found_and_changes_nothing(
    world: World, write: Callable[..., Any], target: str
) -> None:
    with world.storage.unit_of_work() as uow:
        before = dump_tenant(uow, world.mine), dump_tenant(uow, world.other)
        with pytest.raises(NotFoundError):
            write(uow, world.mine.id, getattr(world, target), world.mine)
        # Caught inside the unit of work, so the check is on the write itself rather than on the rollback.
        assert (dump_tenant(uow, world.mine), dump_tenant(uow, world.other)) == before


def test_searches_list_only_my_rows(world: World) -> None:
    mine, other = world.mine, world.other
    with world.storage.unit_of_work() as uow:
        # The two tenants have rows with the same names: the search text can't tell them apart, only the company can.
        assert [row.id for row in uow.clients.search(mine.id, q="Қайрат").items] == [mine.client.id]
        assert [row.id for row in uow.articles.search(mine.id, q="Монтаж").items] == [mine.article.id]
        assert [row.id for row in uow.documents.search(mine.id, q="Қайрат").items] == [mine.document.id]
        assert uow.documents.search(mine.id, client_id=other.client.id).total == 0
        assert uow.documents.search(mine.id, source_document_id=other.document.id).total == 0
        assert [row.id for row in uow.payments.list_paid_between(mine.id)] == [mine.payment.id]
        assert [row.id for row in uow.document_events.list_recent(mine.id, 10)] == [mine.event.id]
        assert [row.id for row in uow.memberships.list_for_company(mine.id)] == [mine.membership.id]


def test_counters_are_per_company(world: World) -> None:
    with world.storage.unit_of_work() as uow:
        assert uow.document_counters.next_number(world.mine.id, *COUNTER) == 2
        assert uow.document_counters.last_number(world.other.id, *COUNTER) == 1
        assert uow.document_counters.next_number(world.other.id, *COUNTER) == 2


def test_taking_a_number_for_a_company_that_does_not_exist_is_not_found(world: World) -> None:
    with pytest.raises(NotFoundError), world.storage.unit_of_work() as uow:
        uow.document_counters.next_number(uuid4(), *COUNTER)


def test_a_share_token_tells_only_its_company(world: World) -> None:
    with world.storage.unit_of_work() as uow:
        assert uow.company_id_for_share_token(world.other.link.token) == world.other.id
        assert uow.company_id_for_share_token(world.mine.link.token) == world.mine.id
        assert uow.company_id_for_share_token("no-such-token") is None


def test_deleting_my_document_leaves_the_other_company_alone(world: World) -> None:
    with world.storage.unit_of_work() as uow:
        before = dump_tenant(uow, world.other)
        uow.documents.delete(world.mine.id, world.mine.document.id)
        assert dump_tenant(uow, world.other) == before
