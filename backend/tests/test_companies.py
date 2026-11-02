"""#39: company create, get and patch, and that only members reach them."""

from uuid import UUID, uuid4

import pytest
from api_helpers import Account, assert_error, sign_up
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from tenant_isolation import (
    COMPANY_DATA,
    TenantRoute,
    assert_every_company_route_is_guarded,
    assert_foreign_ids_are_hidden,
    create_company,
)

from app.errors import ApiError


@pytest.fixture
def owner(client: TestClient) -> Account:
    return sign_up(client)


@pytest.fixture
def stranger(client: TestClient) -> Account:
    return sign_up(client)


class TestCreate:
    def test_saves_the_data_and_get_returns_the_same(self, client: TestClient, owner: Account) -> None:
        """TC-6."""
        response = client.post("/api/companies", json=COMPANY_DATA, headers=owner.headers)
        assert response.status_code == 201
        company = response.json()
        assert {key: company[key] for key in COMPANY_DATA} == COMPANY_DATA
        assert company["currency"] == "KZT"
        assert company["timezone"] == "Asia/Almaty"
        assert company["quoteValidityDays"] == 14
        assert company["invoiceDueDays"] == 5
        assert company["hasLogo"] is False
        assert company["email"] is None
        assert company["vatCertificate"] is None
        assert client.get(f"/api/companies/{company['id']}", headers=owner.headers).json() == company

    def test_me_lists_the_company(self, client: TestClient, owner: Account) -> None:
        company = create_company(client, owner)
        assert client.get("/api/me", headers=owner.headers).json()["companies"] == [company]

    def test_the_creator_is_the_owner(self, app: FastAPI, client: TestClient, owner: Account) -> None:
        company = create_company(client, owner)
        with app.state.storage.unit_of_work() as uow:
            members = uow.memberships.list_for_company(UUID(company["id"]))
        assert [(str(member.user_id), member.role) for member in members] == [(owner.user_id, "owner")]

    @pytest.mark.parametrize(
        ("value", "message"),
        [
            ("850312300122", "ИИН или БИН указан неверно: проверьте цифры"),
            ("85031230012", "ИИН и БИН состоят из 12 цифр"),
            ("85031230012A", "ИИН и БИН состоят только из цифр"),
        ],
    )
    def test_a_bad_iin_names_the_field(self, client: TestClient, owner: Account, value: str, message: str) -> None:
        """TC-6."""
        response = client.post("/api/companies", json={**COMPANY_DATA, "binIin": value}, headers=owner.headers)
        assert assert_error(response, 422, "validation_error")["fields"] == {"binIin": message}
        assert client.get("/api/me", headers=owner.headers).json()["companies"] == []

    def test_an_empty_body_names_every_required_field(self, client: TestClient, owner: Account) -> None:
        response = client.post("/api/companies", json={}, headers=owner.headers)
        assert set(assert_error(response, 422, "validation_error")["fields"]) == {
            "legalForm",
            "legalName",
            "binIin",
            "address",
            "directorName",
            "directorPosition",
            "vatPayer",
        }

    def test_a_second_company_is_refused_with_no_fields(self, client: TestClient, owner: Account) -> None:
        create_company(client, owner)
        response = client.post("/api/companies", json=COMPANY_DATA, headers=owner.headers)
        error = assert_error(response, 422, "validation_error")
        assert error["fields"] == {}
        assert error["message"] == "У этого аккаунта уже есть компания."
        assert len(client.get("/api/me", headers=owner.headers).json()["companies"]) == 1

    def test_signed_out_is_unauthorized(self, client: TestClient) -> None:
        assert_error(client.post("/api/companies", json=COMPANY_DATA), 401, "unauthorized")

    def test_what_the_client_cannot_set_is_ignored(self, client: TestClient, owner: Account) -> None:
        chosen = str(uuid4())
        company = create_company(client, owner, id=chosen, currency="USD", hasLogo=True)
        assert company["id"] != chosen
        assert company["currency"] == "KZT"
        assert company["hasLogo"] is False


class TestPatch:
    def test_a_patch_changes_only_what_it_names(self, client: TestClient, owner: Account) -> None:
        """TC-6."""
        company = create_company(client, owner)
        path = f"/api/companies/{company['id']}"
        response = client.patch(path, json={"vatPayer": False}, headers=owner.headers)
        assert response.status_code == 200
        assert response.json() == {**company, "vatPayer": False}
        assert client.get(path, headers=owner.headers).json() == {**company, "vatPayer": False}

    def test_a_null_clears_an_optional_field(self, client: TestClient, owner: Account) -> None:
        company = create_company(client, owner)
        response = client.patch(f"/api/companies/{company['id']}", json={"phone": None}, headers=owner.headers)
        assert response.json()["phone"] is None

    def test_kazakh_letters_survive(self, client: TestClient, owner: Account) -> None:
        company = create_company(client, owner)
        name = "ТОО «Алатау Құрылыс Сервис» ₸"
        response = client.patch(f"/api/companies/{company['id']}", json={"legalName": name}, headers=owner.headers)
        assert response.json()["legalName"] == name

    @pytest.mark.parametrize(
        ("body", "field"),
        [
            ({"binIin": "850312300122"}, "binIin"),
            ({"legalName": ""}, "legalName"),
            ({"legalName": None}, "legalName"),
            ({"legalForm": "llc"}, "legalForm"),
            ({"iik": "KZ76998KZT1001300335"}, "iik"),
            ({"quoteValidityDays": 0}, "quoteValidityDays"),
            ({"quoteValidityDays": None}, "quoteValidityDays"),
            ({"quoteValidityDays": "14"}, "quoteValidityDays"),
            ({"invoiceDueDays": 366}, "invoiceDueDays"),
            ({"timezone": "+05:00"}, "timezone"),
            ({"vatPayer": "yes"}, "vatPayer"),
            ({"vatPayer": None}, "vatPayer"),
        ],
    )
    def test_a_bad_value_changes_nothing(self, client: TestClient, owner: Account, body: dict, field: str) -> None:
        company = create_company(client, owner)
        path = f"/api/companies/{company['id']}"
        response = client.patch(path, json=body, headers=owner.headers)
        assert set(assert_error(response, 422, "validation_error")["fields"]) == {field}
        assert client.get(path, headers=owner.headers).json() == company

    def test_the_id_and_currency_cannot_change(self, client: TestClient, owner: Account) -> None:
        company = create_company(client, owner)
        body = {"id": str(uuid4()), "currency": "USD", "hasLogo": True}
        assert client.patch(f"/api/companies/{company['id']}", json=body, headers=owner.headers).json() == company


class TestTenantIsolation:
    """AC 5, TC-8."""

    def test_another_companys_id_is_a_404(self, client: TestClient, owner: Account, stranger: Account) -> None:
        company = create_company(client, owner)
        path = f"/api/companies/{company['id']}"
        assert_foreign_ids_are_hidden(
            client,
            stranger,
            [
                TenantRoute("GET", path),
                TenantRoute("PATCH", path, {"json": {"vatPayer": False}}),
            ],
            owner=owner,
            reads=[path],
        )

    def test_a_stranger_with_a_company_of_their_own_gets_the_same(
        self, client: TestClient, owner: Account, stranger: Account
    ) -> None:
        company = create_company(client, owner)
        create_company(client, stranger)
        path = f"/api/companies/{company['id']}"
        assert_foreign_ids_are_hidden(client, stranger, [TenantRoute("GET", path)], owner=owner, reads=[path])

    def test_an_id_that_was_never_there_answers_the_same(
        self, client: TestClient, owner: Account, stranger: Account
    ) -> None:
        company = create_company(client, owner)
        foreign = client.get(f"/api/companies/{company['id']}", headers=stranger.headers)
        unknown = client.get(f"/api/companies/{uuid4()}", headers=stranger.headers)
        assert foreign.status_code == unknown.status_code == 404
        assert foreign.json() == unknown.json()

    def test_every_company_route_is_guarded(
        self, app: FastAPI, client: TestClient, owner: Account, stranger: Account
    ) -> None:
        company = create_company(client, owner)
        routes = assert_every_company_route_is_guarded(app, client, company["id"], stranger)
        assert {(route.method, route.path.split(company["id"])[1]) for route in routes} >= {("GET", ""), ("PATCH", "")}


class TestTheHelperItself:
    """A helper that can't fail proves nothing, so it is shown catching the mistakes it is there for."""

    def test_it_catches_a_route_that_answers_200(self, app: FastAPI, client: TestClient, stranger: Account) -> None:
        @app.get("/api/_test/leak")
        def leak() -> dict[str, str]:
            return {"secret": "yes"}

        with pytest.raises(AssertionError, match="not 404"):
            assert_foreign_ids_are_hidden(client, stranger, [TenantRoute("GET", "/api/_test/leak")])

    def test_it_catches_a_403(self, app: FastAPI, client: TestClient, stranger: Account) -> None:
        @app.get("/api/_test/forbidden")
        def forbidden() -> None:
            raise HTTPException(403)

        with pytest.raises(AssertionError, match="not 404"):
            assert_foreign_ids_are_hidden(client, stranger, [TenantRoute("GET", "/api/_test/forbidden")])

    def test_it_catches_a_404_that_says_too_much(self, app: FastAPI, client: TestClient, stranger: Account) -> None:
        @app.get("/api/_test/chatty")
        def chatty() -> None:
            raise ApiError("not_found", "Это компания другого пользователя")

        with pytest.raises(AssertionError, match="says more"):
            assert_foreign_ids_are_hidden(client, stranger, [TenantRoute("GET", "/api/_test/chatty")])

    def test_it_catches_a_write_that_went_through_behind_a_404(
        self, app: FastAPI, client: TestClient, owner: Account, stranger: Account
    ) -> None:
        state = {"value": 1}

        @app.get("/api/_test/state")
        def read_state() -> dict[str, int]:
            return state

        @app.post("/api/_test/state")
        def write_state() -> None:
            state["value"] = 2
            raise ApiError("not_found")

        with pytest.raises(AssertionError, match="changed the owner"):
            assert_foreign_ids_are_hidden(
                client, stranger, [TenantRoute("POST", "/api/_test/state")], owner=owner, reads=["/api/_test/state"]
            )

    def test_it_refuses_to_prove_nothing(self, client: TestClient, stranger: Account) -> None:
        with pytest.raises(AssertionError, match="no routes"):
            assert_foreign_ids_are_hidden(client, stranger, [])

    def test_it_finds_a_new_company_route_without_the_guard(
        self, app: FastAPI, client: TestClient, owner: Account, stranger: Account
    ) -> None:
        @app.get("/api/companies/{cid}/clients/{id}")
        def unguarded(cid: str, id: str) -> dict[str, str]:
            return {"cid": cid, "id": id}

        company = create_company(client, owner)
        with pytest.raises(AssertionError, match="to nobody"):
            assert_every_company_route_is_guarded(app, client, company["id"], stranger)
