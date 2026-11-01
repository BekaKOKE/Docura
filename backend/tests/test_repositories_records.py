"""The rules every record keeps whichever storage it comes from: UTC timestamps, integer money, derived search keys."""

from collections.abc import Callable
from dataclasses import fields, replace
from datetime import UTC, date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import uuid4

import pytest

from app.repositories import records

SCHEMA = Path(__file__).parents[2] / "replica" / "schema.sql"

RECORD_OF_TABLE = {
    "users": records.User,
    "companies": records.Company,
    "memberships": records.Membership,
    "clients": records.Client,
    "articles": records.Article,
    "documents": records.Document,
    "document_lines": records.DocumentLine,
    "share_links": records.ShareLink,
    "signatures": records.Signature,
    "payments": records.Payment,
    "document_events": records.DocumentEvent,
}


def schema_columns(table: str) -> set[str]:
    columns: set[str] = set()
    inside = False
    for line in SCHEMA.read_text(encoding="utf-8").splitlines():
        if line.startswith(f"create table {table} ("):
            inside = True
        elif inside and line.startswith(")"):
            return columns
        # A column starts at two spaces; continuation lines are deeper. The rest are comments and table constraints.
        elif inside and line.startswith("  ") and line[2] != " " and line.split()[0] not in ("--", "constraint"):
            columns.add(line.split()[0])
    raise AssertionError(f"no table {table}")


@pytest.mark.parametrize(("table", "record"), RECORD_OF_TABLE.items(), ids=RECORD_OF_TABLE)
def test_a_record_has_the_columns_of_its_table(table: str, record: type) -> None:
    assert {item.name for item in fields(record)} == schema_columns(table)


def client(**changes: object) -> records.Client:
    return records.Client(**{"company_id": uuid4(), "kind": "person", "name": "Әсем", **changes})


def article(**changes: object) -> records.Article:
    fields_ = {"company_id": uuid4(), "kind": "service", "title": "Монтаж", "unit": "шт", "unit_price_tiyn": 100}
    return records.Article(**{**fields_, **changes})


def test_a_naive_timestamp_is_rejected() -> None:
    with pytest.raises(ValueError, match="time zone"):
        client(archived_at=datetime(2026, 11, 1, 12, 0))


def test_a_timestamp_in_another_zone_is_stored_as_utc() -> None:
    almaty = timezone(timedelta(hours=5))
    stored = client(archived_at=datetime(2026, 11, 1, 12, 0, tzinfo=almaty)).archived_at
    assert stored == datetime(2026, 11, 1, 7, 0, tzinfo=UTC)
    assert stored.utcoffset() == timedelta(0)


def test_default_timestamps_are_utc() -> None:
    made = client()
    assert made.created_at.utcoffset() == timedelta(0)
    assert made.updated_at.utcoffset() == timedelta(0)


@pytest.mark.parametrize("price", [100.0, "100", True])
def test_money_must_be_an_integer(price: object) -> None:
    with pytest.raises(ValueError, match="unit_price_tiyn"):
        article(unit_price_tiyn=price)


def test_replace_cannot_smuggle_in_a_float() -> None:
    with pytest.raises(ValueError, match="unit_price_tiyn"):
        replace(article(), unit_price_tiyn=1.5)


def test_quantity_and_rate_must_be_integers() -> None:
    line = {
        "company_id": uuid4(),
        "document_id": uuid4(),
        "position": 0,
        "kind": "service",
        "title": "Монтаж",
        "unit": "шт",
        "qty_milli": 1000,
        "unit_price_tiyn": 100,
        "net_tiyn": 100,
        "vat_tiyn": 16,
        "gross_tiyn": 116,
    }
    assert records.DocumentLine(**line).qty_milli == 1000
    with pytest.raises(ValueError, match="qty_milli"):
        records.DocumentLine(**{**line, "qty_milli": 2.5})
    with pytest.raises(ValueError, match="discount_bp"):
        records.DocumentLine(**{**line, "discount_bp": 0.5})


def test_a_business_date_is_left_alone() -> None:
    payment = records.Payment(
        company_id=uuid4(), document_id=uuid4(), amount_tiyn=1, method="cash", paid_on=date(2026, 11, 1)
    )
    assert payment.paid_on == date(2026, 11, 1)


def test_search_keys_follow_the_name_and_keep_kazakh_letters() -> None:
    made = client(name="ТОО «ҚазЁлка»")
    assert made.search_name == "тоо «қазелка»"
    assert replace(made, name="Әсем").search_name == "әсем"
    assert article(title="ЁЛКА").search_title == "елка"


def document(**changes: object) -> records.Document:
    fields_ = {
        "company_id": uuid4(),
        "type": "quote",
        "issue_date": date(2026, 11, 1),
        "client_id": uuid4(),
        "client_snapshot": {"name": "Әсем"},
        "company_snapshot": {"legalName": "ИП"},
        "vat_enabled": False,
        "vat_rate_bp": 1600,
    }
    return records.Document(**{**fields_, **changes})


def signature(**changes: object) -> records.Signature:
    fields_ = {
        "company_id": uuid4(),
        "document_id": uuid4(),
        "signer_name": "Әсем",
        "image": b"\x89PNG",
        "image_sha256": "0" * 64,
        "document_version": 1,
        "document_sha256": "0" * 64,
        "document_snapshot": {},
        "consent_text": "Согласен",
        "signed_at": datetime(2026, 11, 1, tzinfo=UTC),
    }
    return records.Signature(**{**fields_, **changes})


def event(**changes: object) -> records.DocumentEvent:
    fields_ = {
        "company_id": uuid4(),
        "document_id": uuid4(),
        "type": "created",
        "actor_kind": "user",
        "at": datetime(2026, 11, 1, tzinfo=UTC),
    }
    return records.DocumentEvent(**{**fields_, **changes})


JSON_FIELDS = [
    (document, "client_snapshot"),
    (document, "company_snapshot"),
    (signature, "document_snapshot"),
    (event, "data"),
]


@pytest.mark.parametrize(("make", "name"), JSON_FIELDS, ids=[name for _, name in JSON_FIELDS])
@pytest.mark.parametrize(
    "bad",
    [uuid4(), date(2026, 11, 1), datetime(2026, 11, 1, tzinfo=UTC), Decimal("1.5"), b"x", float("nan"), float("inf")],
    ids=["uuid", "date", "datetime", "decimal", "bytes", "nan", "inf"],
)
def test_a_json_field_refuses_what_json_cannot_hold(make: Callable[..., Any], name: str, bad: object) -> None:
    with pytest.raises(ValueError, match=name):
        make(**{name: {"nested": [{"value": bad}]}})


@pytest.mark.parametrize(("make", "name"), JSON_FIELDS, ids=[name for _, name in JSON_FIELDS])
def test_a_json_field_holds_what_the_database_will_give_back(make: Callable[..., Any], name: str) -> None:
    source = {"name": "ТОО «Әлем» ₸", "items": (1, 2), 7: None}
    stored = getattr(make(**{name: source}), name)
    assert stored == {"name": "ТОО «Әлем» ₸", "items": [1, 2], "7": None}
    source["name"] = "изменено"
    assert stored["name"] == "ТОО «Әлем» ₸"


def test_replace_cannot_smuggle_in_a_non_json_value() -> None:
    with pytest.raises(ValueError, match="client_snapshot"):
        replace(document(), client_snapshot={"id": uuid4()})


def test_email_is_stored_lower_cased() -> None:
    user = records.User(email="Seitkali@Example.KZ", password_hash="x", full_name="Сейтқали")
    assert user.email == "seitkali@example.kz"
