"""AC 1: a Protocol for each MVP table's repository, and every method takes `company_id` (except users)."""

import inspect
from pathlib import Path
from typing import Protocol

import pytest

from app.repositories import base

SCHEMA = Path(__file__).parents[2] / "replica" / "schema.sql"

# Every table of replica/schema.sql and the Protocol that serves it.
PROTOCOL_OF_TABLE = {
    "users": base.UserRepository,
    "companies": base.CompanyRepository,
    "memberships": base.MembershipRepository,
    "clients": base.ClientRepository,
    "articles": base.ArticleRepository,
    "documents": base.DocumentRepository,
    "document_lines": base.DocumentLineRepository,
    "document_counters": base.DocumentCounterRepository,
    "share_links": base.ShareLinkRepository,
    "signatures": base.SignatureRepository,
    "payments": base.PaymentRepository,
    "document_events": base.DocumentEventRepository,
}
SCOPED_PROTOCOLS = [protocol for protocol in PROTOCOL_OF_TABLE.values() if protocol is not base.UserRepository]


def protocol_methods(protocol: type) -> list[str]:
    return [name for name, member in vars(protocol).items() if inspect.isfunction(member) and not name.startswith("_")]


def test_every_repository_protocol_in_base_is_in_the_table_list() -> None:
    found = {
        member
        for name, member in vars(base).items()
        if inspect.isclass(member) and issubclass(member, Protocol) and name.endswith("Repository")
    }
    assert found == set(PROTOCOL_OF_TABLE.values())


def test_there_is_a_protocol_for_each_table_of_the_schema() -> None:
    with SCHEMA.open(encoding="utf-8") as schema:
        tables = {line.split()[2] for line in schema if line.startswith("create table ")}
    assert tables == set(PROTOCOL_OF_TABLE)


@pytest.mark.parametrize("protocol", PROTOCOL_OF_TABLE.values(), ids=lambda p: p.__name__)
def test_protocols_are_runtime_checkable_and_have_methods(protocol: type) -> None:
    assert getattr(protocol, "_is_runtime_protocol", False)
    assert protocol_methods(protocol)


@pytest.mark.parametrize(
    ("protocol", "method"),
    [(protocol, method) for protocol in SCOPED_PROTOCOLS for method in protocol_methods(protocol)],
    ids=lambda value: value if isinstance(value, str) else value.__name__,
)
def test_every_method_takes_company_id_first(protocol: type, method: str) -> None:
    parameters = list(inspect.signature(getattr(protocol, method)).parameters)
    assert parameters[:2] == ["self", "company_id"]


@pytest.mark.parametrize("method", protocol_methods(base.UserRepository))
def test_users_belong_to_no_company(method: str) -> None:
    assert "company_id" not in inspect.signature(getattr(base.UserRepository, method)).parameters
