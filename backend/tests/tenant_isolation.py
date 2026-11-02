"""The tenant-isolation helper of #39, for every company route of #41 to #45.

Two things to call:

- `assert_foreign_ids_are_hidden(client, stranger, routes, owner=..., reads=[...])` takes the routes you name, with the
  ids of another company in them, and expects each one to answer 404 as if the id didn't exist. A write must also leave
  the owner's data as it was. Name a route once with the owner's `cid`, and once with the stranger's own `cid` and the
  owner's row id: the second is the one a missing `company_id` in a query lets through.
- `assert_every_company_route_is_guarded(app, client, company_id, stranger)` finds every route under
  `/api/companies/{cid}` by itself, so a new one can't forget `require_member`: it must answer 401 signed out and 404 to
  a stranger. It reads them from the app's OpenAPI document, so a route hidden with `include_in_schema=False` is missed.
"""

import re
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from api_helpers import Account, assert_error
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import Response

from app.errors import DEFAULT_MESSAGES

COMPANY_ROUTES = "/api/companies/{cid}"
_METHODS = {"get", "put", "post", "patch", "delete"}

COMPANY_DATA: dict[str, Any] = {
    "legalForm": "ip",
    "legalName": "ИП Сейткали Б.",
    "binIin": "850312300121",
    "address": "г. Алматы, ул. Сәтбаев, 22",
    "phone": "+7 701 123 45 67",
    "directorName": "Сейткали Бекзат",
    "directorPosition": "Индивидуальный предприниматель",
    "vatPayer": True,
    "bankName": "АО Тест Банк",
    "iik": "KZ75998KZT1001300335",
    "bik": "DCRAKZKA",
    "kbe": "17",
    "defaultKnp": "859",
}


def create_company(client: TestClient, owner: Account, **changes: Any) -> dict[str, Any]:
    response = client.post("/api/companies", json={**COMPANY_DATA, **changes}, headers=owner.headers)
    assert response.status_code == 201, response.text
    return response.json()


@dataclass(frozen=True)
class TenantRoute:
    """One request. `options` go to the client as they are: `json=...`, `data=...`, `files=...`."""

    method: str
    path: str
    options: dict[str, Any] = field(default_factory=dict)

    def call(self, client: TestClient, headers: dict[str, str] | None = None) -> Response:
        return client.request(self.method, self.path, headers=headers, **self.options)

    def __str__(self) -> str:
        return f"{self.method} {self.path}"


def _assert_is_not_found(route: TenantRoute, response: Response) -> None:
    assert response.status_code == 404, f"{route} answered {response.status_code}, not 404: {response.text}"
    error = assert_error(response, 404, "not_found")
    assert error["message"] == DEFAULT_MESSAGES["not_found"], f"{route} says more than an unknown id would"
    assert error["fields"] == {}, f"{route} says more than an unknown id would"


def assert_foreign_ids_are_hidden(
    client: TestClient,
    stranger: Account,
    routes: Iterable[TenantRoute],
    *,
    owner: Account | None = None,
    reads: Iterable[str] = (),
) -> None:
    """Each route is a 404 to `stranger`, and none changed what `owner` gets from the paths in `reads`."""
    reads = list(reads)
    assert not reads or owner is not None, "reads are made as the owner: pass `owner`"
    routes = list(routes)
    assert routes, "no routes given: this would prove nothing"

    def snapshot() -> dict[str, tuple[int, bytes]]:
        answers = {path: client.get(path, headers=owner.headers) for path in reads}
        return {path: (answer.status_code, answer.content) for path, answer in answers.items()}

    before = snapshot()
    for route in routes:
        _assert_is_not_found(route, route.call(client, stranger.headers))
    assert snapshot() == before, "a stranger's request changed the owner's data"


def company_routes(app: FastAPI, company_id: str) -> list[TenantRoute]:
    """Every route under `/api/companies/{cid}`, for this company, with a random id for any other path parameter."""
    app.openapi_schema = None  # built again, so routes added since the last build are in it
    found = []
    for template, operations in app.openapi()["paths"].items():
        if template.startswith(COMPANY_ROUTES):
            path = re.sub(r"\{\w+\}", lambda name: company_id if name[0] == "{cid}" else str(uuid4()), template)
            found.extend(TenantRoute(method.upper(), path) for method in sorted(operations) if method in _METHODS)
    return found


def assert_every_company_route_is_guarded(
    app: FastAPI, client: TestClient, company_id: str, stranger: Account
) -> list[TenantRoute]:
    """Signed out is a 401, a stranger or a malformed company id a 404, on every company route. Returns the routes."""
    routes = company_routes(app, company_id)
    assert routes, "no company routes found: this would prove nothing"
    for route in routes:
        response = route.call(client)
        assert response.status_code == 401, f"{route} answered {response.status_code} to nobody"
        assert_error(response, 401, "unauthorized")
    assert_foreign_ids_are_hidden(client, stranger, routes)
    malformed = [TenantRoute(route.method, route.path.replace(company_id, "not-a-uuid")) for route in routes]
    assert_foreign_ids_are_hidden(client, stranger, malformed)
    return routes
