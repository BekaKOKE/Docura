"""The rows the repositories hand around, one frozen dataclass per table of `replica/schema.sql`, with its field names.

They hold no storage code, so a service sees the same objects from the memory repositories and the SQL ones. A record
is changed by making a new one with `dataclasses.replace`, then saving it. Three rules of the schema are enforced here,
so that neither storage can break them: timestamps are aware and in UTC, money, quantities and rates are integers, and
JSON columns hold JSON.

`document_counters` has no record: it is a counter, not an entity, and its repository deals in numbers.
"""

import json
from dataclasses import dataclass, field, fields
from datetime import UTC, date, datetime
from typing import Any, Generic, TypeVar
from uuid import UUID, uuid4

from app.domain.search import search_key

T = TypeVar("T")

# Integer tiyn, thousandths and basis points. `basis_value` is basis points or tiyn, depending on `basis`.
_INTEGER_FIELD_ENDINGS = ("_tiyn", "_milli", "_bp", "basis_value")
_JSON_FIELDS = frozenset({"client_snapshot", "company_snapshot", "document_snapshot", "data"})


def utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True)
class Page(Generic[T]):
    """One page of a search. `total` counts every match, not just `items`."""

    items: list[T]
    total: int


@dataclass(frozen=True, kw_only=True)
class Record:
    def __post_init__(self) -> None:
        for item in fields(self):
            value = getattr(self, item.name)
            if item.name in _JSON_FIELDS:
                object.__setattr__(self, item.name, self._as_json(item.name, value))
            elif isinstance(value, datetime):
                if value.utcoffset() is None:
                    raise ValueError(f"{type(self).__name__}.{item.name}: a timestamp must carry its time zone")
                object.__setattr__(self, item.name, value.astimezone(UTC))
            elif item.name.endswith(_INTEGER_FIELD_ENDINGS) and value is not None and type(value) is not int:
                raise ValueError(f"{type(self).__name__}.{item.name}: must be an integer, got {value!r}")

    def _as_json(self, name: str, value: Any) -> Any:
        """The value as the database will give it back. A UUID, date or Decimal in it would pass in memory and break
        on SQL, so it fails here on both."""
        try:
            return json.loads(json.dumps(value, allow_nan=False))
        except (TypeError, ValueError) as error:
            raise ValueError(f"{type(self).__name__}.{name}: not JSON: {error}") from error


@dataclass(frozen=True, kw_only=True)
class User(Record):
    id: UUID = field(default_factory=uuid4)
    email: str
    password_hash: str
    full_name: str
    locale: str = "ru"
    last_login_at: datetime | None = None
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)

    def __post_init__(self) -> None:
        super().__post_init__()
        object.__setattr__(self, "email", self.email.lower())  # stored lower-cased


@dataclass(frozen=True, kw_only=True)
class Company(Record):
    id: UUID = field(default_factory=uuid4)
    legal_form: str
    legal_name: str
    bin_iin: str
    address: str = ""
    phone: str | None = None
    email: str | None = None
    director_name: str = ""
    director_position: str = ""
    vat_payer: bool = False
    vat_certificate: str | None = None
    bank_name: str | None = None
    iik: str | None = None
    bik: str | None = None
    kbe: str | None = None
    default_knp: str | None = None
    logo: bytes | None = None
    logo_mime: str | None = None
    timezone: str = "Asia/Almaty"
    quote_validity_days: int = 14
    invoice_due_days: int = 5
    currency: str = "KZT"
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)


@dataclass(frozen=True, kw_only=True)
class Membership(Record):
    id: UUID = field(default_factory=uuid4)
    company_id: UUID
    user_id: UUID
    role: str = "owner"
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)


@dataclass(frozen=True, kw_only=True)
class Client(Record):
    id: UUID = field(default_factory=uuid4)
    company_id: UUID
    kind: str
    name: str
    search_name: str = field(init=False)  # always search_key(name)
    bin_iin: str | None = None
    contact_name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    notes: str | None = None
    archived_at: datetime | None = None
    created_by: UUID | None = None
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)

    def __post_init__(self) -> None:
        object.__setattr__(self, "search_name", search_key(self.name))
        super().__post_init__()


@dataclass(frozen=True, kw_only=True)
class Article(Record):
    id: UUID = field(default_factory=uuid4)
    company_id: UUID
    kind: str
    title: str
    search_title: str = field(init=False)  # always search_key(title)
    description: str | None = None
    unit: str
    unit_price_tiyn: int
    currency: str = "KZT"
    archived_at: datetime | None = None
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)

    def __post_init__(self) -> None:
        object.__setattr__(self, "search_title", search_key(self.title))
        super().__post_init__()


@dataclass(frozen=True, kw_only=True)
class Document(Record):
    id: UUID = field(default_factory=uuid4)
    company_id: UUID
    type: str
    status: str = "draft"
    number: str | None = None
    issue_date: date
    valid_until: date | None = None
    due_date: date | None = None
    period_from: date | None = None
    period_to: date | None = None
    contract_ref: str | None = None
    client_id: UUID
    client_snapshot: dict[str, Any]
    company_snapshot: dict[str, Any]
    source_document_id: UUID | None = None
    basis: str | None = None
    basis_value: int | None = None
    vat_enabled: bool
    vat_rate_bp: int
    currency: str = "KZT"
    net_tiyn: int = 0
    vat_tiyn: int = 0
    gross_tiyn: int = 0
    notes: str | None = None
    terms: str | None = None
    version: int = 1
    issued_at: datetime | None = None
    signed_at: datetime | None = None
    cancelled_at: datetime | None = None
    created_by: UUID | None = None
    client_request_id: UUID | None = None
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)


@dataclass(frozen=True, kw_only=True)
class DocumentLine(Record):
    id: UUID = field(default_factory=uuid4)
    company_id: UUID
    document_id: UUID
    position: int
    article_id: UUID | None = None
    kind: str
    title: str
    description: str | None = None
    unit: str
    qty_milli: int
    unit_price_tiyn: int
    discount_bp: int = 0
    net_tiyn: int
    vat_tiyn: int
    gross_tiyn: int
    work_date: date | None = None


@dataclass(frozen=True, kw_only=True)
class ShareLink(Record):
    id: UUID = field(default_factory=uuid4)
    company_id: UUID
    document_id: UUID
    token: str
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    view_count: int = 0
    first_viewed_at: datetime | None = None
    last_viewed_at: datetime | None = None
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)


@dataclass(frozen=True, kw_only=True)
class Signature(Record):
    id: UUID = field(default_factory=uuid4)
    company_id: UUID
    document_id: UUID
    share_link_id: UUID | None = None
    method: str = "drawn"
    signer_role: str = "client"
    signer_name: str
    image: bytes
    image_sha256: str
    document_version: int
    document_sha256: str
    document_snapshot: dict[str, Any]
    consent_text: str
    ip: str | None = None
    user_agent: str | None = None
    signed_at: datetime
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)


@dataclass(frozen=True, kw_only=True)
class Payment(Record):
    id: UUID = field(default_factory=uuid4)
    company_id: UUID
    document_id: UUID
    amount_tiyn: int
    currency: str = "KZT"
    method: str
    paid_on: date
    note: str | None = None
    created_by: UUID | None = None
    client_request_id: UUID | None = None
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)


@dataclass(frozen=True, kw_only=True)
class DocumentEvent(Record):
    id: UUID = field(default_factory=uuid4)
    company_id: UUID
    document_id: UUID
    type: str
    actor_kind: str
    actor_user_id: UUID | None = None
    data: dict[str, Any] = field(default_factory=dict)
    at: datetime
    created_at: datetime = field(default_factory=utc_now)
