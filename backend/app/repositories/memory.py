"""In-memory storage (`STORAGE=memory`): dicts shaped like the tables of `replica/schema.sql`, behind one lock.

A unit of work holds the lock from start to end, so units of work run one at a time, and it saves a copy of the tables
to go back to on an error. That copy is cheap and safe because the tables only ever hold frozen records, and records
are deep-copied on the way in and out, so nobody can reach stored JSON from outside.

The unique indexes and foreign keys of the schema are kept here too, so a service sees the same failures it will see on
SQL. Its check constraints are not: those values are computed and validated by `app/domain` before they get here.
"""

import threading
from collections.abc import Callable, Iterable, Iterator, Mapping
from copy import deepcopy
from dataclasses import dataclass, field, fields, replace
from datetime import date
from types import TracebackType
from typing import Any, ClassVar, Self, TypeVar
from uuid import UUID

from app.domain.search import search_key
from app.repositories.base import NotFoundError, ReferencedError, UniqueViolationError, VersionConflictError
from app.repositories.records import (
    Article,
    Client,
    Company,
    Document,
    DocumentEvent,
    DocumentLine,
    Membership,
    Page,
    Payment,
    ShareLink,
    Signature,
    User,
    utc_now,
)

R = TypeVar("R")

# The unique indexes of replica/schema.sql. A key holding a NULL collides with nothing, as in both databases.
_UNIQUE_INDEXES: dict[str, tuple[tuple[str, Callable[[Any], tuple[Any, ...]]], ...]] = {
    "users": (("users_email_uq", lambda row: (row.email,)),),
    "memberships": (("memberships_company_user_uq", lambda row: (row.company_id, row.user_id)),),
    "documents": (
        ("documents_number_uq", lambda row: (row.company_id, row.type, row.number)),
        ("documents_request_uq", lambda row: (row.company_id, row.client_request_id)),
    ),
    "document_lines": (("document_lines_position_uq", lambda row: (row.document_id, row.position)),),
    "share_links": (("share_links_token_uq", lambda row: (row.token,)),),
    "signatures": (("signatures_document_role_uq", lambda row: (row.document_id, row.signer_role)),),
    "payments": (("payments_request_uq", lambda row: (row.company_id, row.client_request_id)),),
}

# What a document can't change. `version` and `updated_at` are the compare-and-set's own business.
_FROZEN_DOCUMENT_FIELDS = frozenset({"id", "company_id", "type", "version", "created_by", "created_at", "updated_at"})


def _check_unique(table: str, rows: Mapping[UUID, Any], record: Any) -> None:
    for constraint, key_of in _UNIQUE_INDEXES.get(table, ()):
        key = key_of(record)
        if None in key:
            continue
        if any(row.id != record.id and key_of(row) == key for row in rows.values()):
            raise UniqueViolationError(constraint)


def _page(rows: list[R], limit: int | None, offset: int) -> Page[R]:
    end = None if limit is None else offset + limit
    return Page(items=deepcopy(rows[offset:end]), total=len(rows))


def _matches_paid_on(payment: Payment, paid_from: date | None, paid_to: date | None) -> bool:
    return (paid_from is None or payment.paid_on >= paid_from) and (paid_to is None or payment.paid_on <= paid_to)


@dataclass
class _Tables:
    users: dict[UUID, User] = field(default_factory=dict)
    companies: dict[UUID, Company] = field(default_factory=dict)
    memberships: dict[UUID, Membership] = field(default_factory=dict)
    clients: dict[UUID, Client] = field(default_factory=dict)
    articles: dict[UUID, Article] = field(default_factory=dict)
    documents: dict[UUID, Document] = field(default_factory=dict)
    document_lines: dict[UUID, DocumentLine] = field(default_factory=dict)
    document_counters: dict[tuple[UUID, str, int], int] = field(default_factory=dict)
    share_links: dict[UUID, ShareLink] = field(default_factory=dict)
    signatures: dict[UUID, Signature] = field(default_factory=dict)
    payments: dict[UUID, Payment] = field(default_factory=dict)
    document_events: dict[UUID, DocumentEvent] = field(default_factory=dict)

    def copy(self) -> "_Tables":
        return _Tables(**{item.name: dict(getattr(self, item.name)) for item in fields(self)})


class _Repository:
    table: ClassVar[str]

    def __init__(self, uow: "MemoryUnitOfWork") -> None:
        self._uow = uow

    @property
    def _tables(self) -> _Tables:
        return self._uow.tables

    @property
    def _rows(self) -> dict[UUID, Any]:
        return getattr(self._tables, self.table)

    def _store(self, record: R) -> R:
        _check_unique(self.table, self._rows, record)
        self._rows[record.id] = deepcopy(record)
        return deepcopy(record)

    def _check_new_id(self, record: Any) -> None:
        if record.id in self._rows:
            raise UniqueViolationError(f"{self.table}_pkey")


class _TenantRepository(_Repository):
    """A table whose rows carry `company_id`. `references` are its foreign keys: field name -> table it points at."""

    references: ClassVar[dict[str, str]] = {}

    def _in_company(self, company_id: UUID) -> Iterator[Any]:
        return (row for row in self._rows.values() if row.company_id == company_id)

    def _owned(self, company_id: UUID, record_id: UUID) -> Any:
        row = self._rows.get(record_id)
        return row if row is not None and row.company_id == company_id else None

    def _require_owned(self, company_id: UUID, record_id: UUID) -> Any:
        row = self._owned(company_id, record_id)
        if row is None:
            raise NotFoundError(f"{self.table}: {record_id}")
        return row

    def _check_references(self, company_id: UUID, record: Any) -> None:
        if record.company_id != company_id:
            raise NotFoundError(f"{self.table}: {record.id}")
        for name, table in self.references.items():
            target_id = getattr(record, name)
            if target_id is None:
                continue
            target = getattr(self._tables, table).get(target_id)
            # Users belong to no company, so only their existence counts.
            if target is None or getattr(target, "company_id", company_id) != company_id:
                raise NotFoundError(f"{self.table}.{name}: {target_id}")


class _AddMixin(_TenantRepository):
    def add(self, company_id: UUID, record: Any) -> Any:
        if company_id not in self._tables.companies:
            raise NotFoundError(f"companies: {company_id}")
        self._check_references(company_id, record)
        self._check_new_id(record)
        return self._store(record)


class _GetMixin(_TenantRepository):
    def get(self, company_id: UUID, record_id: UUID) -> Any:
        return deepcopy(self._owned(company_id, record_id))


class _UpdateMixin(_TenantRepository):
    def update(self, company_id: UUID, record: Any) -> Any:
        current = self._require_owned(company_id, record.id)
        self._check_references(company_id, record)
        return self._store(replace(record, created_at=current.created_at, updated_at=utc_now()))


class MemoryUserRepository(_Repository):
    table = "users"

    def add(self, record: User) -> User:
        self._check_new_id(record)
        return self._store(record)

    def get(self, user_id: UUID) -> User | None:
        return deepcopy(self._rows.get(user_id))

    def get_by_email(self, email: str) -> User | None:
        wanted = email.lower()
        return deepcopy(next((row for row in self._rows.values() if row.email == wanted), None))

    def update(self, record: User) -> User:
        current = self._rows.get(record.id)
        if current is None:
            raise NotFoundError(f"users: {record.id}")
        return self._store(replace(record, created_at=current.created_at, updated_at=utc_now()))

    def list_memberships(self, user_id: UUID) -> list[Membership]:
        return deepcopy([row for row in self._tables.memberships.values() if row.user_id == user_id])


class MemoryCompanyRepository(_Repository):
    """A company is its own tenant: `company_id` is the row's id."""

    table = "companies"

    def add(self, company_id: UUID, record: Company) -> Company:
        if record.id != company_id:
            raise NotFoundError(f"companies: {record.id}")
        self._check_new_id(record)
        return self._store(record)

    def get(self, company_id: UUID) -> Company | None:
        return deepcopy(self._rows.get(company_id))

    def update(self, company_id: UUID, record: Company) -> Company:
        current = self._rows.get(company_id)
        if current is None or record.id != company_id:
            raise NotFoundError(f"companies: {record.id}")
        return self._store(replace(record, created_at=current.created_at, updated_at=utc_now()))


class MemoryMembershipRepository(_AddMixin):
    table = "memberships"
    references: ClassVar[dict[str, str]] = {"user_id": "users"}

    def get(self, company_id: UUID, user_id: UUID) -> Membership | None:
        return deepcopy(next((row for row in self._in_company(company_id) if row.user_id == user_id), None))

    def list_for_company(self, company_id: UUID) -> list[Membership]:
        return deepcopy(list(self._in_company(company_id)))


class MemoryClientRepository(_AddMixin, _GetMixin, _UpdateMixin):
    table = "clients"
    references: ClassVar[dict[str, str]] = {"created_by": "users"}

    def delete(self, company_id: UUID, record_id: UUID) -> None:
        self._require_owned(company_id, record_id)
        if any(row.client_id == record_id for row in self._tables.documents.values()):
            raise ReferencedError(f"clients: {record_id}")
        del self._rows[record_id]

    def search(
        self,
        company_id: UUID,
        *,
        q: str | None = None,
        archived: bool = False,
        limit: int | None = None,
        offset: int = 0,
    ) -> Page[Client]:
        query = search_key((q or "").strip())
        rows = [
            row
            for row in self._in_company(company_id)
            if (row.archived_at is not None) == archived and query in row.search_name
        ]
        return _page(sorted(rows, key=lambda row: row.search_name), limit, offset)


class MemoryArticleRepository(_AddMixin, _GetMixin, _UpdateMixin):
    table = "articles"

    def search(
        self,
        company_id: UUID,
        *,
        q: str | None = None,
        kind: str | None = None,
        archived: bool = False,
        limit: int | None = None,
        offset: int = 0,
    ) -> Page[Article]:
        query = search_key((q or "").strip())
        rows = [
            row
            for row in self._in_company(company_id)
            if (row.archived_at is not None) == archived
            and query in row.search_title
            and (kind is None or row.kind == kind)
        ]
        return _page(sorted(rows, key=lambda row: row.search_title), limit, offset)


class MemoryDocumentRepository(_AddMixin, _GetMixin):
    table = "documents"
    references: ClassVar[dict[str, str]] = {
        "client_id": "clients",
        "source_document_id": "documents",
        "created_by": "users",
    }

    def get_by_client_request_id(self, company_id: UUID, client_request_id: UUID) -> Document | None:
        matches = (row for row in self._in_company(company_id) if row.client_request_id == client_request_id)
        return deepcopy(next(matches, None))

    def search(
        self,
        company_id: UUID,
        *,
        type: str | None = None,
        status: str | None = None,
        client_id: UUID | None = None,
        source_document_id: UUID | None = None,
        issued_from: date | None = None,
        issued_to: date | None = None,
        q: str | None = None,
        limit: int | None = None,
        offset: int = 0,
    ) -> Page[Document]:
        query = search_key((q or "").strip())

        def matches(row: Document) -> bool:
            return (
                (type is None or row.type == type)
                and (status is None or row.status == status)
                and (client_id is None or row.client_id == client_id)
                and (source_document_id is None or row.source_document_id == source_document_id)
                and (issued_from is None or row.issue_date >= issued_from)
                and (issued_to is None or row.issue_date <= issued_to)
                and query in search_key(f"{row.number or ''} {row.client_snapshot.get('name', '')}")
            )

        rows = [row for row in self._in_company(company_id) if matches(row)]
        # Reversed first: the sort is stable, so equal dates stay newest-created first.
        rows.reverse()
        return _page(sorted(rows, key=lambda row: row.issue_date, reverse=True), limit, offset)

    def compare_and_set(
        self, company_id: UUID, record_id: UUID, expected_version: int, changes: Mapping[str, Any]
    ) -> Document:
        frozen = _FROZEN_DOCUMENT_FIELDS & changes.keys()
        if frozen:
            raise ValueError(f"documents: can't change {sorted(frozen)}")
        current = self._require_owned(company_id, record_id)
        if current.version != expected_version:
            raise VersionConflictError(f"documents: {record_id} is at {current.version}, not {expected_version}")
        updated = replace(current, **changes, version=expected_version + 1, updated_at=utc_now())
        self._check_references(company_id, updated)
        return self._store(updated)

    def delete(self, company_id: UUID, record_id: UUID) -> None:
        self._require_owned(company_id, record_id)
        if any(row.source_document_id == record_id for row in self._rows.values()):
            raise ReferencedError(f"documents: {record_id}")
        tables = self._tables
        for children in (
            tables.document_lines,
            tables.share_links,
            tables.signatures,
            tables.payments,
            tables.document_events,
        ):
            for child_id in [row.id for row in children.values() if row.document_id == record_id]:
                del children[child_id]
        del self._rows[record_id]


class _DocumentChildRepository(_TenantRepository):
    """A table whose rows hang off a document."""

    def _for_document(self, company_id: UUID, document_id: UUID) -> list[Any]:
        return [row for row in self._in_company(company_id) if row.document_id == document_id]


class MemoryDocumentLineRepository(_DocumentChildRepository):
    table = "document_lines"
    references: ClassVar[dict[str, str]] = {"document_id": "documents", "article_id": "articles"}

    def list_for_document(self, company_id: UUID, document_id: UUID) -> list[DocumentLine]:
        return deepcopy(sorted(self._for_document(company_id, document_id), key=lambda row: row.position))

    def replace_for_document(
        self, company_id: UUID, document_id: UUID, records: list[DocumentLine]
    ) -> list[DocumentLine]:
        document = self._tables.documents.get(document_id)
        if document is None or document.company_id != company_id:
            raise NotFoundError(f"documents: {document_id}")
        # Built aside and swapped in at the end, so a bad line leaves the old ones in place.
        rows = {row.id: row for row in self._rows.values() if row.document_id != document_id}
        for record in records:
            if record.document_id != document_id:
                raise NotFoundError(f"{self.table}: {record.id}")
            self._check_references(company_id, record)
            if record.id in rows:
                raise UniqueViolationError(f"{self.table}_pkey")
            _check_unique(self.table, rows, record)
            rows[record.id] = deepcopy(record)
        self._tables.document_lines = rows
        return self.list_for_document(company_id, document_id)


class MemoryDocumentCounterRepository(_Repository):
    table = "document_counters"

    def next_number(self, company_id: UUID, type: str, year: int) -> int:
        if company_id not in self._tables.companies:
            raise NotFoundError(f"companies: {company_id}")
        key = (company_id, type, year)
        number = self._tables.document_counters.get(key, 0) + 1
        self._tables.document_counters[key] = number
        return number

    def last_number(self, company_id: UUID, type: str, year: int) -> int:
        return self._tables.document_counters.get((company_id, type, year), 0)


class MemoryShareLinkRepository(_AddMixin, _GetMixin, _UpdateMixin, _DocumentChildRepository):
    table = "share_links"
    references: ClassVar[dict[str, str]] = {"document_id": "documents"}

    def get_by_token(self, company_id: UUID, token: str) -> ShareLink | None:
        return deepcopy(next((row for row in self._in_company(company_id) if row.token == token), None))

    def get_for_document(self, company_id: UUID, document_id: UUID) -> ShareLink | None:
        active = (row for row in reversed(self._for_document(company_id, document_id)) if row.revoked_at is None)
        return deepcopy(next(active, None))


class MemorySignatureRepository(_AddMixin, _DocumentChildRepository):
    table = "signatures"
    references: ClassVar[dict[str, str]] = {"document_id": "documents", "share_link_id": "share_links"}

    def get_for_document(self, company_id: UUID, document_id: UUID) -> Signature | None:
        return deepcopy(next(iter(self._for_document(company_id, document_id)), None))


class MemoryPaymentRepository(_AddMixin, _GetMixin, _DocumentChildRepository):
    table = "payments"
    references: ClassVar[dict[str, str]] = {"document_id": "documents", "created_by": "users"}

    def get_by_client_request_id(self, company_id: UUID, client_request_id: UUID) -> Payment | None:
        matches = (row for row in self._in_company(company_id) if row.client_request_id == client_request_id)
        return deepcopy(next(matches, None))

    def list_for_document(self, company_id: UUID, document_id: UUID) -> list[Payment]:
        return self._by_paid_on(self._for_document(company_id, document_id))

    def list_paid_between(
        self, company_id: UUID, paid_from: date | None = None, paid_to: date | None = None
    ) -> list[Payment]:
        return self._by_paid_on(
            row for row in self._in_company(company_id) if _matches_paid_on(row, paid_from, paid_to)
        )

    def delete(self, company_id: UUID, record_id: UUID) -> None:
        self._require_owned(company_id, record_id)
        del self._rows[record_id]

    @staticmethod
    def _by_paid_on(rows: Iterable[Payment]) -> list[Payment]:
        return deepcopy(sorted(rows, key=lambda row: row.paid_on))


class MemoryDocumentEventRepository(_AddMixin, _DocumentChildRepository):
    table = "document_events"
    references: ClassVar[dict[str, str]] = {"document_id": "documents", "actor_user_id": "users"}

    def list_for_document(self, company_id: UUID, document_id: UUID) -> list[DocumentEvent]:
        return deepcopy(sorted(self._for_document(company_id, document_id), key=lambda row: row.at))

    def list_recent(self, company_id: UUID, limit: int) -> list[DocumentEvent]:
        # Reversed first: the sort is stable, so equal times stay newest-recorded first.
        rows = list(self._in_company(company_id))
        rows.reverse()
        return deepcopy(sorted(rows, key=lambda row: row.at, reverse=True)[:limit])


class MemoryUnitOfWork:
    def __init__(self, storage: "MemoryStorage") -> None:
        self._storage = storage
        self._saved: _Tables | None = None
        self.users = MemoryUserRepository(self)
        self.companies = MemoryCompanyRepository(self)
        self.memberships = MemoryMembershipRepository(self)
        self.clients = MemoryClientRepository(self)
        self.articles = MemoryArticleRepository(self)
        self.documents = MemoryDocumentRepository(self)
        self.document_lines = MemoryDocumentLineRepository(self)
        self.document_counters = MemoryDocumentCounterRepository(self)
        self.share_links = MemoryShareLinkRepository(self)
        self.signatures = MemorySignatureRepository(self)
        self.payments = MemoryPaymentRepository(self)
        self.document_events = MemoryDocumentEventRepository(self)

    @property
    def tables(self) -> _Tables:
        if self._saved is None:
            raise RuntimeError("the repositories work only inside `with storage.unit_of_work()`")
        return self._storage.tables

    def __enter__(self) -> Self:
        storage = self._storage
        storage.lock.acquire()
        if storage.in_unit_of_work:
            # Only this thread can be here while it is set. A plain lock would hang forever instead.
            storage.lock.release()
            raise RuntimeError("units of work don't nest: pass the one you have")
        storage.in_unit_of_work = True
        self._saved = storage.tables.copy()
        return self

    def __exit__(
        self, exc_type: type[BaseException] | None, exc: BaseException | None, traceback: TracebackType | None
    ) -> None:
        storage = self._storage
        if exc_type is not None and self._saved is not None:
            storage.tables = self._saved
        self._saved = None
        storage.in_unit_of_work = False
        storage.lock.release()

    def company_id_for_share_token(self, token: str) -> UUID | None:
        row = next((row for row in self.tables.share_links.values() if row.token == token), None)
        return row.company_id if row is not None else None


class MemoryStorage:
    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.tables = _Tables()
        self.in_unit_of_work = False

    def unit_of_work(self) -> MemoryUnitOfWork:
        return MemoryUnitOfWork(self)
