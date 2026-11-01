"""Records for the repository tests, and a whole tenant with one row in every table."""

from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID, uuid4

from app.repositories.base import UnitOfWork
from app.repositories.records import (
    Article,
    Client,
    Company,
    Document,
    DocumentEvent,
    DocumentLine,
    Membership,
    Payment,
    ShareLink,
    Signature,
    User,
)

NOW = datetime(2026, 11, 1, 7, 0, tzinfo=UTC)
COUNTER = ("quote", 2026)


def make_user(**changes: Any) -> User:
    return User(**{"email": f"{uuid4()}@example.kz", "password_hash": "x", "full_name": "Сейтқали", **changes})


def make_company(**changes: Any) -> Company:
    return Company(**{"legal_form": "ip", "legal_name": "ИП Әсем", "bin_iin": "000000000000", **changes})


def make_client(company_id: UUID, **changes: Any) -> Client:
    return Client(**{"company_id": company_id, "kind": "person", "name": "Қайрат", **changes})


def make_article(company_id: UUID, **changes: Any) -> Article:
    fields = {"company_id": company_id, "kind": "service", "title": "Монтаж", "unit": "шт", "unit_price_tiyn": 100}
    return Article(**{**fields, **changes})


def make_document(company_id: UUID, client_id: UUID, **changes: Any) -> Document:
    fields = {
        "company_id": company_id,
        "type": "quote",
        "issue_date": date(2026, 11, 1),
        "client_id": client_id,
        "client_snapshot": {"name": "Қайрат"},
        "company_snapshot": {"legalName": "ИП Әсем"},
        "vat_enabled": False,
        "vat_rate_bp": 1600,
    }
    return Document(**{**fields, **changes})


def make_line(company_id: UUID, document_id: UUID, **changes: Any) -> DocumentLine:
    fields = {
        "company_id": company_id,
        "document_id": document_id,
        "position": 0,
        "kind": "service",
        "title": "Монтаж",
        "unit": "шт",
        "qty_milli": 1000,
        "unit_price_tiyn": 100,
        "net_tiyn": 100,
        "vat_tiyn": 0,
        "gross_tiyn": 100,
    }
    return DocumentLine(**{**fields, **changes})


def make_link(company_id: UUID, document_id: UUID, **changes: Any) -> ShareLink:
    return ShareLink(**{"company_id": company_id, "document_id": document_id, "token": uuid4().hex, **changes})


def make_signature(company_id: UUID, document_id: UUID, **changes: Any) -> Signature:
    fields = {
        "company_id": company_id,
        "document_id": document_id,
        "signer_name": "Қайрат",
        "image": b"\x89PNG",
        "image_sha256": "0" * 64,
        "document_version": 1,
        "document_sha256": "0" * 64,
        "document_snapshot": {"number": "КП-2026-0001"},
        "consent_text": "Согласен",
        "signed_at": NOW,
    }
    return Signature(**{**fields, **changes})


def make_payment(company_id: UUID, document_id: UUID, **changes: Any) -> Payment:
    fields = {
        "company_id": company_id,
        "document_id": document_id,
        "amount_tiyn": 100,
        "method": "cash",
        "paid_on": date(2026, 11, 1),
    }
    return Payment(**{**fields, **changes})


def make_event(company_id: UUID, document_id: UUID, **changes: Any) -> DocumentEvent:
    fields = {"company_id": company_id, "document_id": document_id, "type": "created", "actor_kind": "user", "at": NOW}
    return DocumentEvent(**{**fields, **changes})


@dataclass(frozen=True)
class Tenant:
    """One row in every table. Built with `make_tenant`, stored with `save_tenant`."""

    user: User
    company: Company
    membership: Membership
    client: Client
    article: Article
    document: Document
    line: DocumentLine
    link: ShareLink
    signature: Signature
    payment: Payment
    event: DocumentEvent

    @property
    def id(self) -> UUID:
        return self.company.id


def make_tenant() -> Tenant:
    user = make_user()
    company = make_company()
    client = make_client(company.id)
    document = make_document(company.id, client.id, client_request_id=uuid4())
    link = make_link(company.id, document.id)
    return Tenant(
        user=user,
        company=company,
        membership=Membership(company_id=company.id, user_id=user.id),
        client=client,
        article=make_article(company.id),
        document=document,
        line=make_line(company.id, document.id),
        link=link,
        signature=make_signature(company.id, document.id, share_link_id=link.id),
        payment=make_payment(company.id, document.id, client_request_id=uuid4()),
        event=make_event(company.id, document.id),
    )


def save_tenant(uow: UnitOfWork, tenant: Tenant) -> None:
    uow.users.add(tenant.user)
    uow.companies.add(tenant.id, tenant.company)
    uow.memberships.add(tenant.id, tenant.membership)
    uow.clients.add(tenant.id, tenant.client)
    uow.articles.add(tenant.id, tenant.article)
    uow.documents.add(tenant.id, tenant.document)
    uow.document_lines.replace_for_document(tenant.id, tenant.document.id, [tenant.line])
    uow.document_counters.next_number(tenant.id, *COUNTER)
    uow.share_links.add(tenant.id, tenant.link)
    uow.signatures.add(tenant.id, tenant.signature)
    uow.payments.add(tenant.id, tenant.payment)
    uow.document_events.add(tenant.id, tenant.event)


def dump_tenant(uow: UnitOfWork, tenant: Tenant) -> dict[str, Any]:
    """Everything a tenant has, read through the repositories, to compare before and after."""
    document_id = tenant.document.id
    return {
        "user": uow.users.get(tenant.user.id),
        "company": uow.companies.get(tenant.id),
        "memberships": uow.memberships.list_for_company(tenant.id),
        "clients": uow.clients.search(tenant.id),
        "archived_clients": uow.clients.search(tenant.id, archived=True),
        "articles": uow.articles.search(tenant.id),
        "documents": uow.documents.search(tenant.id),
        "lines": uow.document_lines.list_for_document(tenant.id, document_id),
        "counter": uow.document_counters.last_number(tenant.id, *COUNTER),
        "link": uow.share_links.get_for_document(tenant.id, document_id),
        "signature": uow.signatures.get_for_document(tenant.id, document_id),
        "payments": uow.payments.list_paid_between(tenant.id),
        "events": uow.document_events.list_for_document(tenant.id, document_id),
    }
