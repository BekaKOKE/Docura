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

PNG_HEAD = b"\x89PNG\r\n\x1a\n"


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
        """TC-8: GET, PATCH, PUT logo and GET logo, and the owner's company and logo stay as they were."""
        company = create_company(client, owner)
        path = f"/api/companies/{company['id']}"
        client.put(f"{path}/logo", files={"file": ("logo.png", png(1000), "image/png")}, headers=owner.headers)
        assert_foreign_ids_are_hidden(
            client,
            stranger,
            [
                TenantRoute("GET", path),
                TenantRoute("PATCH", path, {"json": {"vatPayer": False}}),
                TenantRoute("PUT", f"{path}/logo", {"files": {"file": ("logo.png", png(2000), "image/png")}}),
                TenantRoute("GET", f"{path}/logo"),
            ],
            owner=owner,
            reads=[path, f"{path}/logo"],
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
        assert {(route.method, route.path.split(company["id"])[1]) for route in routes} == {
            ("GET", ""),
            ("PATCH", ""),
            ("PUT", "/logo"),
            ("GET", "/logo"),
        }


def png(size: int) -> bytes:
    return PNG_HEAD.ljust(size, b"\0")


class TestLogo:
    """AC 4, TC-7."""

    @pytest.fixture
    def path(self, client: TestClient, owner: Account) -> str:
        return f"/api/companies/{create_company(client, owner)['id']}"

    def upload(self, client: TestClient, owner: Account, path: str, content: bytes, name: str, kind: str):
        return client.put(f"{path}/logo", files={"file": (name, content, kind)}, headers=owner.headers)

    def test_a_png_of_120_kb_is_saved_and_read_back(self, client: TestClient, owner: Account, path: str) -> None:
        content = png(120 * 1024)
        response = self.upload(client, owner, path, content, "logo.png", "image/png")
        assert response.status_code == 204
        assert response.content == b""
        logo = client.get(f"{path}/logo", headers=owner.headers)
        assert logo.status_code == 200
        assert logo.content == content
        assert logo.headers["content-type"] == "image/png"
        assert client.get(path, headers=owner.headers).json()["hasLogo"] is True

    def test_a_jpeg_is_saved_with_its_type(self, client: TestClient, owner: Account, path: str) -> None:
        content = b"\xff\xd8\xff\xe0".ljust(5000, b"\0")
        assert self.upload(client, owner, path, content, "logo.jpg", "image/jpeg").status_code == 204
        logo = client.get(f"{path}/logo", headers=owner.headers)
        assert (logo.content, logo.headers["content-type"]) == (content, "image/jpeg")

    def test_exactly_300_kb_is_accepted(self, client: TestClient, owner: Account, path: str) -> None:
        assert self.upload(client, owner, path, png(300 * 1024), "logo.png", "image/png").status_code == 204

    def test_the_type_comes_from_the_bytes_not_the_name(self, client: TestClient, owner: Account, path: str) -> None:
        content = png(1000)
        assert self.upload(client, owner, path, content, "logo.txt", "text/plain").status_code == 204
        assert client.get(f"{path}/logo", headers=owner.headers).headers["content-type"] == "image/png"

    @pytest.mark.parametrize(
        ("content", "name", "kind", "message"),
        [
            (png(301 * 1024), "logo.png", "image/png", "Файл больше 300 КБ. Выберите логотип поменьше."),
            (b"GIF89a".ljust(50 * 1024, b"\0"), "logo.gif", "image/gif", "Логотип должен быть в формате PNG или JPEG."),
            ("Это не картинка".encode(), "logo.png", "image/png", "Логотип должен быть в формате PNG или JPEG."),
            (b"", "logo.png", "image/png", "Логотип должен быть в формате PNG или JPEG."),
        ],
    )
    def test_anything_else_is_refused_and_the_old_logo_stays(
        self, client: TestClient, owner: Account, path: str, content: bytes, name: str, kind: str, message: str
    ) -> None:
        """TC-7: 301 KB, a GIF and a text file named logo.png."""
        old = png(1000)
        self.upload(client, owner, path, old, "logo.png", "image/png")
        response = self.upload(client, owner, path, content, name, kind)
        assert assert_error(response, 422, "validation_error")["fields"] == {"logo": message}
        assert client.get(f"{path}/logo", headers=owner.headers).content == old

    def test_no_logo_is_a_404(self, client: TestClient, owner: Account, path: str) -> None:
        assert_error(client.get(f"{path}/logo", headers=owner.headers), 404, "not_found")

    def test_a_new_logo_replaces_the_old_one(self, client: TestClient, owner: Account, path: str) -> None:
        self.upload(client, owner, path, png(1000), "a.png", "image/png")
        self.upload(client, owner, path, png(2000), "b.png", "image/png")
        assert len(client.get(f"{path}/logo", headers=owner.headers).content) == 2000

    def test_the_logo_is_not_sniffed(self, client: TestClient, owner: Account, path: str) -> None:
        self.upload(client, owner, path, png(1000), "logo.png", "image/png")
        assert client.get(f"{path}/logo", headers=owner.headers).headers["x-content-type-options"] == "nosniff"


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
