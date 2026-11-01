"""What the services may ask of storage: one Protocol per table, a unit of work, and the errors they raise.

`memory.py` implements them for M3, `sql.py` will for M4, and both must behave the same way:

- Every method takes `company_id`, except on users, who belong to no company. A row of another company behaves exactly
  like a row that doesn't exist: `get` returns None, a list leaves it out, and a write raises `NotFoundError`. That goes
  for the references a row holds too (a payment on another company's document) and for a record whose own `company_id`
  isn't the one asked for.
- All work happens inside `with storage.unit_of_work() as uow:`. A clean exit commits, and any exception undoes
  everything done in the block. Records are copies: changing one changes nothing until it is saved.
- A document is only ever changed through `compare_and_set`, so every write that depends on what the caller read fails
  if the document moved on (architecture.md, "Races").

Only portable behaviour belongs here: unique indexes and foreign keys, no locks and nothing inside JSON columns.
"""

from collections.abc import Mapping
from datetime import date
from types import TracebackType
from typing import Any, Protocol, Self, runtime_checkable
from uuid import UUID

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
)


class RepositoryError(Exception):
    """A storage rule was broken. The service layer turns these into API errors."""


class NotFoundError(RepositoryError):
    """No such row in this company, or a reference to a row that isn't in it."""


class VersionConflictError(RepositoryError):
    """The compare-and-set expected a version the document no longer has."""


class UniqueViolationError(RepositoryError):
    """A unique index of `replica/schema.sql` would be broken. `constraint` is the name of that index."""

    def __init__(self, constraint: str) -> None:
        super().__init__(constraint)
        self.constraint = constraint


class ReferencedError(RepositoryError):
    """The row can't be deleted while another row refers to it (`no action` foreign keys in `replica/schema.sql`)."""


@runtime_checkable
class UserRepository(Protocol):
    def add(self, record: User) -> User: ...
    def get(self, user_id: UUID) -> User | None: ...
    def get_by_email(self, email: str) -> User | None: ...
    def update(self, record: User) -> User: ...
    def list_memberships(self, user_id: UUID) -> list[Membership]:
        """The user's companies, for `GET /api/me`: the one read of memberships that starts from no company."""
        ...


@runtime_checkable
class CompanyRepository(Protocol):
    def add(self, company_id: UUID, record: Company) -> Company: ...
    def get(self, company_id: UUID) -> Company | None: ...
    def update(self, company_id: UUID, record: Company) -> Company: ...


@runtime_checkable
class MembershipRepository(Protocol):
    def add(self, company_id: UUID, record: Membership) -> Membership: ...
    def get(self, company_id: UUID, user_id: UUID) -> Membership | None: ...
    def list_for_company(self, company_id: UUID) -> list[Membership]: ...


@runtime_checkable
class ClientRepository(Protocol):
    def add(self, company_id: UUID, record: Client) -> Client: ...
    def get(self, company_id: UUID, record_id: UUID) -> Client | None: ...
    def update(self, company_id: UUID, record: Client) -> Client: ...
    def delete(self, company_id: UUID, record_id: UUID) -> None:
        """Raises `ReferencedError` while a document refers to the client: archive it instead."""
        ...

    def search(
        self,
        company_id: UUID,
        *,
        q: str | None = None,
        archived: bool = False,
        limit: int | None = None,
        offset: int = 0,
    ) -> Page[Client]:
        """Ordered by `search_name`; `q` is a substring of it. Only archived clients or only the others."""
        ...


@runtime_checkable
class ArticleRepository(Protocol):
    def add(self, company_id: UUID, record: Article) -> Article: ...
    def get(self, company_id: UUID, record_id: UUID) -> Article | None: ...
    def update(self, company_id: UUID, record: Article) -> Article: ...
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
        """Ordered by `search_title`; `q` is a substring of it. Only archived articles or only the others."""
        ...


@runtime_checkable
class DocumentRepository(Protocol):
    def add(self, company_id: UUID, record: Document) -> Document: ...
    def get(self, company_id: UUID, record_id: UUID) -> Document | None: ...
    def get_by_client_request_id(self, company_id: UUID, client_request_id: UUID) -> Document | None: ...
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
        """Newest `issue_date` first, then newest created first. `q` is a substring of the search key of the number
        and the client's name as printed on the document. Dates are inclusive."""
        ...

    def compare_and_set(
        self, company_id: UUID, record_id: UUID, expected_version: int, changes: Mapping[str, Any]
    ) -> Document:
        """Apply `changes` and bump `version` by one, if the document still has `expected_version`.

        Raises `VersionConflictError` if it doesn't, and `NotFoundError` if there is no such document in this company;
        either way nothing changes. `version` and the fields that never change can't be in `changes` (`ValueError`).
        """
        ...

    def delete(self, company_id: UUID, record_id: UUID) -> None:
        """Also removes its lines, links, signatures, payments and events. Raises `ReferencedError` while another
        document was made from it."""
        ...


@runtime_checkable
class DocumentLineRepository(Protocol):
    def list_for_document(self, company_id: UUID, document_id: UUID) -> list[DocumentLine]:
        """In `position` order."""
        ...

    def replace_for_document(
        self, company_id: UUID, document_id: UUID, records: list[DocumentLine]
    ) -> list[DocumentLine]:
        """Lines are replaced whole on save (`replica/schema.sql`)."""
        ...


@runtime_checkable
class DocumentCounterRepository(Protocol):
    def next_number(self, company_id: UUID, type: str, year: int) -> int:
        """Bump the counter and return the new number. Gap-free: undone with the unit of work that took it."""
        ...

    def last_number(self, company_id: UUID, type: str, year: int) -> int: ...


@runtime_checkable
class ShareLinkRepository(Protocol):
    def add(self, company_id: UUID, record: ShareLink) -> ShareLink: ...
    def get(self, company_id: UUID, record_id: UUID) -> ShareLink | None: ...
    def get_by_token(self, company_id: UUID, token: str) -> ShareLink | None: ...
    def get_for_document(self, company_id: UUID, document_id: UUID) -> ShareLink | None:
        """The document's newest link that isn't revoked."""
        ...

    def update(self, company_id: UUID, record: ShareLink) -> ShareLink: ...


@runtime_checkable
class SignatureRepository(Protocol):
    def add(self, company_id: UUID, record: Signature) -> Signature: ...
    def get_for_document(self, company_id: UUID, document_id: UUID) -> Signature | None: ...


@runtime_checkable
class PaymentRepository(Protocol):
    def add(self, company_id: UUID, record: Payment) -> Payment: ...
    def get(self, company_id: UUID, record_id: UUID) -> Payment | None: ...
    def get_by_client_request_id(self, company_id: UUID, client_request_id: UUID) -> Payment | None: ...
    def list_for_document(self, company_id: UUID, document_id: UUID) -> list[Payment]:
        """Oldest `paid_on` first, then in the order they were recorded."""
        ...

    def list_paid_between(
        self, company_id: UUID, paid_from: date | None = None, paid_to: date | None = None
    ) -> list[Payment]:
        """Inclusive; a missing bound is open. Oldest `paid_on` first, then in the order they were recorded."""
        ...

    def delete(self, company_id: UUID, record_id: UUID) -> None: ...


@runtime_checkable
class DocumentEventRepository(Protocol):
    """Append-only: an event is never changed or removed on its own."""

    def add(self, company_id: UUID, record: DocumentEvent) -> DocumentEvent: ...
    def list_for_document(self, company_id: UUID, document_id: UUID) -> list[DocumentEvent]:
        """Oldest first, by `at`."""
        ...

    def list_recent(self, company_id: UUID, limit: int) -> list[DocumentEvent]:
        """Newest first, by `at`."""
        ...


@runtime_checkable
class UnitOfWork(Protocol):
    users: UserRepository
    companies: CompanyRepository
    memberships: MembershipRepository
    clients: ClientRepository
    articles: ArticleRepository
    documents: DocumentRepository
    document_lines: DocumentLineRepository
    document_counters: DocumentCounterRepository
    share_links: ShareLinkRepository
    signatures: SignatureRepository
    payments: PaymentRepository
    document_events: DocumentEventRepository

    def __enter__(self) -> Self: ...
    def __exit__(
        self, exc_type: type[BaseException] | None, exc: BaseException | None, traceback: TracebackType | None
    ) -> None: ...
    def company_id_for_share_token(self, token: str) -> UUID | None:
        """Which company a public link belongs to, or None.

        `/api/public/{token}` has a token and no company, and every repository method needs one. This is the only way
        into a company without a membership, it tells nothing but the id, and the repositories take over from there.
        """
        ...


@runtime_checkable
class Storage(Protocol):
    def unit_of_work(self) -> UnitOfWork: ...
