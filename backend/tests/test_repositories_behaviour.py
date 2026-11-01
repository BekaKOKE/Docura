"""What each repository does beyond scoping: the schema's indexes and foreign keys, searches, orders and cascades."""

from collections.abc import Callable
from dataclasses import replace
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
from repo_factories import (
    NOW,
    Tenant,
    make_article,
    make_client,
    make_company,
    make_document,
    make_event,
    make_line,
    make_link,
    make_payment,
    make_signature,
    make_tenant,
    make_user,
    save_tenant,
)

from app.repositories.base import NotFoundError, ReferencedError, Storage, UniqueViolationError
from app.repositories.records import Membership


@pytest.fixture
def tenant(storage: Storage) -> Tenant:
    made = make_tenant()
    with storage.unit_of_work() as uow:
        save_tenant(uow, made)
    return made


# Each one breaks the unique index it is named after.
UNIQUE_BREAKERS: dict[str, Callable[[Any, Tenant], Any]] = {
    "users_email_uq": lambda uow, t: uow.users.add(make_user(email=t.user.email.upper())),
    "memberships_company_user_uq": lambda uow, t: uow.memberships.add(
        t.id, Membership(company_id=t.id, user_id=t.user.id)
    ),
    "share_links_token_uq": lambda uow, t: uow.share_links.add(
        t.id, make_link(t.id, t.document.id, token=t.link.token)
    ),
    "signatures_document_role_uq": lambda uow, t: uow.signatures.add(t.id, make_signature(t.id, t.document.id)),
    "users_pkey": lambda uow, t: uow.users.add(replace(make_user(), id=t.user.id)),
    "companies_pkey": lambda uow, t: uow.companies.add(t.id, t.company),
    "clients_pkey": lambda uow, t: uow.clients.add(t.id, t.client),
    "documents_pkey": lambda uow, t: uow.documents.add(t.id, t.document),
    "payments_pkey": lambda uow, t: uow.payments.add(t.id, t.payment),
}


@pytest.mark.parametrize(("constraint", "breaker"), UNIQUE_BREAKERS.items(), ids=UNIQUE_BREAKERS)
def test_unique_indexes_hold(storage: Storage, tenant: Tenant, constraint: str, breaker: Callable[..., Any]) -> None:
    with pytest.raises(UniqueViolationError) as caught, storage.unit_of_work() as uow:
        breaker(uow, tenant)
    assert caught.value.constraint == constraint


def test_a_document_number_is_unique_per_company_and_type(storage: Storage, tenant: Tenant) -> None:
    other = make_tenant()
    number = "КП-2026-0001"
    with storage.unit_of_work() as uow:
        save_tenant(uow, other)
        uow.documents.add(tenant.id, make_document(tenant.id, tenant.client.id, number=number))
        # The same number in another company, and on another type, is fine.
        uow.documents.add(other.id, make_document(other.id, other.client.id, number=number))
        uow.documents.add(tenant.id, make_document(tenant.id, tenant.client.id, number=number, type="invoice"))
        with pytest.raises(UniqueViolationError) as caught:
            uow.documents.add(tenant.id, make_document(tenant.id, tenant.client.id, number=number))
    assert caught.value.constraint == "documents_number_uq"


def test_drafts_without_a_number_do_not_collide(storage: Storage, tenant: Tenant) -> None:
    with storage.unit_of_work() as uow:
        uow.documents.add(tenant.id, make_document(tenant.id, tenant.client.id))
        uow.documents.add(tenant.id, make_document(tenant.id, tenant.client.id))
        assert uow.documents.search(tenant.id).total == 3


def test_a_replayed_document_request_is_refused_and_can_be_found(storage: Storage, tenant: Tenant) -> None:
    request_id = uuid4()
    with storage.unit_of_work() as uow:
        made = uow.documents.add(tenant.id, make_document(tenant.id, tenant.client.id, client_request_id=request_id))
        with pytest.raises(UniqueViolationError) as caught:
            uow.documents.add(tenant.id, make_document(tenant.id, tenant.client.id, client_request_id=request_id))
        assert caught.value.constraint == "documents_request_uq"
        assert uow.documents.get_by_client_request_id(tenant.id, request_id) == made


def test_a_replayed_payment_request_is_refused_and_can_be_found(storage: Storage, tenant: Tenant) -> None:
    request_id = uuid4()
    with storage.unit_of_work() as uow:
        made = uow.payments.add(tenant.id, make_payment(tenant.id, tenant.document.id, client_request_id=request_id))
        with pytest.raises(UniqueViolationError) as caught:
            uow.payments.add(tenant.id, make_payment(tenant.id, tenant.document.id, client_request_id=request_id))
        assert caught.value.constraint == "payments_request_uq"
        assert uow.payments.get_by_client_request_id(tenant.id, request_id) == made


def test_a_missing_request_id_finds_nothing_even_with_rows_that_have_none(storage: Storage, tenant: Tenant) -> None:
    with storage.unit_of_work() as uow:
        uow.documents.add(tenant.id, make_document(tenant.id, tenant.client.id))
        uow.payments.add(tenant.id, make_payment(tenant.id, tenant.document.id))
        assert uow.documents.get_by_client_request_id(tenant.id, None) is None
        assert uow.payments.get_by_client_request_id(tenant.id, None) is None


def test_payments_without_a_request_id_do_not_collide(storage: Storage, tenant: Tenant) -> None:
    with storage.unit_of_work() as uow:
        uow.payments.add(tenant.id, make_payment(tenant.id, tenant.document.id))
        assert len(uow.payments.list_for_document(tenant.id, tenant.document.id)) == 2


def test_an_update_can_break_a_unique_index_too(storage: Storage, tenant: Tenant) -> None:
    with storage.unit_of_work() as uow:
        second = uow.users.add(make_user())
        with pytest.raises(UniqueViolationError):
            uow.users.update(replace(second, email=tenant.user.email))
        assert uow.users.get(second.id) == second


def test_users_are_found_by_email_whatever_its_case(storage: Storage, tenant: Tenant) -> None:
    with storage.unit_of_work() as uow:
        assert uow.users.get_by_email(tenant.user.email.upper()) == tenant.user
        assert uow.users.get_by_email("nobody@example.kz") is None
        assert uow.users.get(uuid4()) is None


def test_updating_a_missing_user_or_company_is_not_found(storage: Storage) -> None:
    with storage.unit_of_work() as uow:
        with pytest.raises(NotFoundError):
            uow.users.update(make_user())
        company = make_company()
        with pytest.raises(NotFoundError):
            uow.companies.update(company.id, company)
        assert uow.companies.get(company.id) is None


def test_an_update_keeps_created_at_and_moves_updated_at(storage: Storage, tenant: Tenant) -> None:
    long_ago = NOW - timedelta(days=100)
    with storage.unit_of_work() as uow:
        changed = uow.clients.update(
            tenant.id, replace(tenant.client, name="Новое имя", created_at=long_ago, updated_at=long_ago)
        )
    assert changed.created_at == tenant.client.created_at
    assert changed.updated_at >= tenant.client.updated_at
    assert changed.search_name == "новое имя"


def test_a_user_lists_their_memberships_across_companies(storage: Storage, tenant: Tenant) -> None:
    second = make_company()
    with storage.unit_of_work() as uow:
        uow.companies.add(second.id, second)
        uow.memberships.add(second.id, Membership(company_id=second.id, user_id=tenant.user.id))
        companies = {row.company_id for row in uow.users.list_memberships(tenant.user.id)}
        assert companies == {tenant.id, second.id}
        assert uow.memberships.get(second.id, tenant.user.id).role == "owner"
        assert uow.users.list_memberships(uuid4()) == []


@pytest.mark.parametrize(
    "add",
    [
        lambda uow, t: uow.memberships.add(t.id, Membership(company_id=t.id, user_id=uuid4())),
        lambda uow, t: uow.clients.add(t.id, make_client(t.id, created_by=uuid4())),
        lambda uow, t: uow.documents.add(t.id, make_document(t.id, uuid4())),
        lambda uow, t: uow.documents.add(t.id, make_document(t.id, t.client.id, created_by=uuid4())),
        lambda uow, t: uow.payments.add(t.id, make_payment(t.id, t.document.id, created_by=uuid4())),
        lambda uow, t: uow.document_events.add(t.id, make_event(t.id, t.document.id, actor_user_id=uuid4())),
    ],
    ids=["membership", "client", "document-client", "document-user", "payment", "event"],
)
def test_a_reference_to_nothing_is_refused(storage: Storage, tenant: Tenant, add: Callable[..., Any]) -> None:
    with pytest.raises(NotFoundError), storage.unit_of_work() as uow:
        add(uow, tenant)


def test_adding_to_a_company_that_does_not_exist_is_not_found(storage: Storage) -> None:
    missing = uuid4()
    with pytest.raises(NotFoundError), storage.unit_of_work() as uow:
        uow.articles.add(missing, make_article(missing))


def test_a_company_adds_only_under_its_own_id(storage: Storage) -> None:
    with pytest.raises(NotFoundError), storage.unit_of_work() as uow:
        uow.companies.add(uuid4(), make_company())


def test_a_client_with_documents_cannot_be_deleted(storage: Storage, tenant: Tenant) -> None:
    with storage.unit_of_work() as uow:
        with pytest.raises(ReferencedError):
            uow.clients.delete(tenant.id, tenant.client.id)
        assert uow.clients.get(tenant.id, tenant.client.id) == tenant.client

        unused = uow.clients.add(tenant.id, make_client(tenant.id, name="Без документов"))
        uow.clients.delete(tenant.id, unused.id)
        assert uow.clients.get(tenant.id, unused.id) is None


def test_deleting_a_document_takes_everything_hanging_off_it(storage: Storage, tenant: Tenant) -> None:
    document_id = tenant.document.id
    with storage.unit_of_work() as uow:
        keep = uow.documents.add(tenant.id, make_document(tenant.id, tenant.client.id))
        kept_line = make_line(tenant.id, keep.id)
        uow.document_lines.replace_for_document(tenant.id, keep.id, [kept_line])
        kept_payment = uow.payments.add(tenant.id, make_payment(tenant.id, keep.id))

        uow.documents.delete(tenant.id, document_id)

        assert uow.documents.get(tenant.id, document_id) is None
        assert uow.document_lines.list_for_document(tenant.id, document_id) == []
        assert uow.share_links.get_for_document(tenant.id, document_id) is None
        assert uow.signatures.get_for_document(tenant.id, document_id) is None
        assert uow.payments.list_for_document(tenant.id, document_id) == []
        assert uow.document_events.list_for_document(tenant.id, document_id) == []
        assert uow.company_id_for_share_token(tenant.link.token) is None
        # The other document keeps its own.
        assert uow.document_lines.list_for_document(tenant.id, keep.id) == [kept_line]
        assert uow.payments.list_for_document(tenant.id, keep.id) == [kept_payment]


def test_a_quote_with_invoices_cannot_be_deleted(storage: Storage, tenant: Tenant) -> None:
    with storage.unit_of_work() as uow:
        invoice = make_document(tenant.id, tenant.client.id, type="invoice", source_document_id=tenant.document.id)
        uow.documents.add(tenant.id, invoice)
        with pytest.raises(ReferencedError):
            uow.documents.delete(tenant.id, tenant.document.id)
        assert uow.documents.get(tenant.id, tenant.document.id) == tenant.document


def test_client_search_finds_russian_and_kazakh_in_any_case(storage: Storage, tenant: Tenant) -> None:
    with storage.unit_of_work() as uow:
        for name in ("ТОО «Әлем»", "Ёлкин Пётр", "ҚазСтрой"):
            uow.clients.add(tenant.id, make_client(tenant.id, name=name))
        found = lambda q: [row.name for row in uow.clients.search(tenant.id, q=q).items]  # noqa: E731
        assert found("әлем") == ["ТОО «Әлем»"]
        assert found("ӘЛЕМ") == ["ТОО «Әлем»"]
        assert found("елкин") == ["Ёлкин Пётр"]
        assert found("ёлкин") == ["Ёлкин Пётр"]
        assert found("  қазс ") == ["ҚазСтрой"]
        # A wildcard in a search is just text, as it must be in the SQL repository's LIKE.
        assert found("%") == []


def test_client_search_orders_pages_and_counts(storage: Storage, tenant: Tenant) -> None:
    with storage.unit_of_work() as uow:
        for name in ("Вера", "Анна", "Борис"):
            uow.clients.add(tenant.id, make_client(tenant.id, name=name))
        page = uow.clients.search(tenant.id, limit=2, offset=1)
    assert [row.name for row in page.items] == ["Борис", "Вера"]
    assert page.total == 4  # the three and the tenant's own client


def test_archived_clients_and_articles_are_listed_apart(storage: Storage, tenant: Tenant) -> None:
    with storage.unit_of_work() as uow:
        uow.clients.update(tenant.id, replace(tenant.client, archived_at=NOW))
        uow.articles.update(tenant.id, replace(tenant.article, archived_at=NOW))
        assert uow.clients.search(tenant.id).total == 0
        assert [row.id for row in uow.clients.search(tenant.id, archived=True).items] == [tenant.client.id]
        assert uow.articles.search(tenant.id).total == 0
        assert [row.id for row in uow.articles.search(tenant.id, archived=True).items] == [tenant.article.id]


def test_article_search_filters_by_kind_and_text(storage: Storage, tenant: Tenant) -> None:
    with storage.unit_of_work() as uow:
        uow.articles.add(tenant.id, make_article(tenant.id, kind="material", title="Цемент"))
        assert [row.title for row in uow.articles.search(tenant.id, kind="material").items] == ["Цемент"]
        assert [row.title for row in uow.articles.search(tenant.id, q="цем").items] == ["Цемент"]
        assert uow.articles.search(tenant.id, q="цем", kind="service").total == 0
        assert uow.articles.get(tenant.id, tenant.article.id) == tenant.article


def test_document_search_filters_and_orders_newest_first(storage: Storage, tenant: Tenant) -> None:
    cid, client = tenant.id, tenant.client.id
    with storage.unit_of_work() as uow:
        old = uow.documents.add(cid, make_document(cid, client, issue_date=date(2026, 1, 15), notes="старый"))
        same_day_first = uow.documents.add(cid, make_document(cid, client, issue_date=date(2026, 12, 1)))
        same_day_second = uow.documents.add(
            cid,
            make_document(
                cid,
                client,
                issue_date=date(2026, 12, 1),
                type="invoice",
                status="issued",
                number="СЧ-2026-0007",
                source_document_id=tenant.document.id,
                client_snapshot={"name": "Әсем"},
            ),
        )
        ids = lambda **filters: [row.id for row in uow.documents.search(cid, **filters).items]  # noqa: E731

        assert ids() == [same_day_second.id, same_day_first.id, tenant.document.id, old.id]
        assert ids(type="invoice") == [same_day_second.id]
        assert ids(status="issued") == [same_day_second.id]
        assert ids(source_document_id=tenant.document.id) == [same_day_second.id]
        assert ids(client_id=uuid4()) == []
        assert ids(issued_from=date(2026, 11, 1), issued_to=date(2026, 11, 1)) == [tenant.document.id]
        assert ids(issued_to=date(2026, 1, 15)) == [old.id]
        assert ids(q="сч-2026") == [same_day_second.id]
        assert ids(q="ӘСЕМ") == [same_day_second.id]
        assert ids(limit=1, offset=1) == [same_day_first.id]
        assert uow.documents.search(cid, limit=1).total == 4


def test_lines_are_replaced_whole_and_kept_in_position_order(storage: Storage, tenant: Tenant) -> None:
    cid, did = tenant.id, tenant.document.id
    with storage.unit_of_work() as uow:
        second, first = make_line(cid, did, position=1), make_line(cid, did, position=0)
        assert uow.document_lines.replace_for_document(cid, did, [second, first]) == [first, second]
        assert uow.document_lines.list_for_document(cid, did) == [first, second]
        assert uow.document_lines.replace_for_document(cid, did, []) == []
        assert uow.document_lines.list_for_document(cid, did) == []


def test_a_line_can_point_at_my_article(storage: Storage, tenant: Tenant) -> None:
    line = make_line(tenant.id, tenant.document.id, article_id=tenant.article.id)
    with storage.unit_of_work() as uow:
        assert uow.document_lines.replace_for_document(tenant.id, tenant.document.id, [line]) == [line]


def test_a_document_has_one_active_link_the_newest(storage: Storage, tenant: Tenant) -> None:
    cid, did = tenant.id, tenant.document.id
    with storage.unit_of_work() as uow:
        assert uow.share_links.get_for_document(cid, did) == tenant.link
        newer = uow.share_links.add(cid, make_link(cid, did))
        assert uow.share_links.get_for_document(cid, did) == newer
        uow.share_links.update(cid, replace(newer, revoked_at=NOW))
        assert uow.share_links.get_for_document(cid, did) == tenant.link
        uow.share_links.update(cid, replace(tenant.link, revoked_at=NOW))
        assert uow.share_links.get_for_document(cid, did) is None
        assert uow.share_links.get_by_token(cid, newer.token).id == newer.id
        assert uow.share_links.get(cid, newer.id).revoked_at == NOW


def test_a_view_count_is_saved(storage: Storage, tenant: Tenant) -> None:
    with storage.unit_of_work() as uow:
        uow.share_links.update(tenant.id, replace(tenant.link, view_count=1, first_viewed_at=NOW, last_viewed_at=NOW))
    with storage.unit_of_work() as uow:
        assert uow.share_links.get(tenant.id, tenant.link.id).view_count == 1


def test_payments_come_oldest_first_and_filter_by_paid_on(storage: Storage, tenant: Tenant) -> None:
    cid, did = tenant.id, tenant.document.id
    with storage.unit_of_work() as uow:
        later = uow.payments.add(cid, make_payment(cid, did, paid_on=date(2026, 12, 5), amount_tiyn=12_345_678_901_234))
        earlier = uow.payments.add(cid, make_payment(cid, did, paid_on=date(2026, 10, 5)))
        assert uow.payments.list_for_document(cid, did) == [earlier, tenant.payment, later]
        assert uow.payments.list_paid_between(cid, date(2026, 11, 1), date(2026, 11, 1)) == [tenant.payment]
        assert uow.payments.list_paid_between(cid, paid_from=date(2026, 11, 2)) == [later]
        assert uow.payments.list_paid_between(cid, paid_to=date(2026, 10, 31)) == [earlier]
        assert uow.payments.get(cid, later.id).amount_tiyn == 12_345_678_901_234

        uow.payments.delete(cid, later.id)
        assert uow.payments.get(cid, later.id) is None
        with pytest.raises(NotFoundError):
            uow.payments.delete(cid, later.id)


def test_events_are_ordered_by_time(storage: Storage, tenant: Tenant) -> None:
    cid, did = tenant.id, tenant.document.id
    with storage.unit_of_work() as uow:
        before = uow.document_events.add(cid, make_event(cid, did, at=NOW - timedelta(hours=1), type="issued"))
        after = uow.document_events.add(cid, make_event(cid, did, at=NOW + timedelta(hours=1), type="signed"))
        assert uow.document_events.list_for_document(cid, did) == [before, tenant.event, after]
        assert uow.document_events.list_recent(cid, 2) == [after, tenant.event]


def test_a_signature_keeps_its_evidence(storage: Storage, tenant: Tenant) -> None:
    with storage.unit_of_work() as uow:
        stored = uow.signatures.get_for_document(tenant.id, tenant.document.id)
    assert stored == tenant.signature
    assert stored.signed_at == datetime(2026, 11, 1, 7, 0, tzinfo=UTC)
    assert stored.image == b"\x89PNG"
    assert stored.document_snapshot == {"number": "КП-2026-0001"}
