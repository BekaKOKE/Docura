import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.errors import API_ERROR_STATUS, ApiError
from app.schemas.base import CamelModel


class LineBody(CamelModel):
    qty_milli: int
    unit_price_tiyn: int


class QuoteBody(CamelModel):
    client_id: str
    lines: list[LineBody]


@pytest.fixture
def test_app(app: FastAPI) -> FastAPI:
    """The app plus routes that exist only in tests: one takes a body, one raises ApiError."""

    @app.post("/api/_test/quote")
    def create_quote(body: QuoteBody) -> dict[str, int]:
        return {"lines": len(body.lines)}

    @app.get("/api/_test/boom/{code}")
    def boom(code: str) -> None:
        raise ApiError(code, fields={"version": "stale"} if code == "version_conflict" else None)

    return app


@pytest.fixture
def api(test_app: FastAPI) -> TestClient:
    return TestClient(test_app)


def assert_error_shape(payload: dict, code: str) -> dict:
    assert set(payload) == {"error"}
    assert set(payload["error"]) == {"code", "message", "fields"}
    assert payload["error"]["code"] == code
    assert isinstance(payload["error"]["message"], str) and payload["error"]["message"]
    assert isinstance(payload["error"]["fields"], dict)
    return payload["error"]


def test_unknown_route_is_a_not_found_error(client: TestClient) -> None:
    response = client.get("/api/nope")
    assert response.status_code == 404
    error = assert_error_shape(response.json(), "not_found")
    assert error["fields"] == {}


def test_wrong_method_uses_the_same_format(client: TestClient) -> None:
    response = client.post("/api/health")
    assert response.status_code == 405
    assert_error_shape(response.json(), "http_error")


def test_empty_body_names_the_missing_fields_in_camel_case(api: TestClient) -> None:
    response = api.post("/api/_test/quote", json={})
    assert response.status_code == 422
    error = assert_error_shape(response.json(), "validation_error")
    assert set(error["fields"]) == {"clientId", "lines"}
    assert error["fields"]["clientId"] == "Обязательное поле"


def test_nested_field_path_is_camel_case_with_the_index(api: TestClient) -> None:
    response = api.post(
        "/api/_test/quote",
        json={"clientId": "c1", "lines": [{"qtyMilli": 1000, "unitPriceTiyn": 5}, {"qtyMilli": "many"}]},
    )
    assert response.status_code == 422
    error = response.json()["error"]
    assert set(error["fields"]) == {"lines.1.qtyMilli", "lines.1.unitPriceTiyn"}


def test_malformed_json_is_a_validation_error(api: TestClient) -> None:
    response = api.post("/api/_test/quote", content=b"{not json", headers={"content-type": "application/json"})
    assert response.status_code == 422
    assert_error_shape(response.json(), "validation_error")


def test_valid_body_passes(api: TestClient) -> None:
    response = api.post("/api/_test/quote", json={"clientId": "c1", "lines": [{"qtyMilli": 1000, "unitPriceTiyn": 5}]})
    assert response.status_code == 200
    assert response.json() == {"lines": 1}


@pytest.mark.parametrize(("code", "status"), sorted(API_ERROR_STATUS.items()))
def test_api_error_maps_each_code_to_its_status(api: TestClient, code: str, status: int) -> None:
    response = api.get(f"/api/_test/boom/{code}")
    assert response.status_code == status
    assert_error_shape(response.json(), code)


def test_api_error_carries_fields_and_a_custom_message(app: FastAPI) -> None:
    @app.get("/api/_test/custom")
    def custom() -> None:
        raise ApiError("overpayment", "Остаток к оплате 100 ₸", fields={"amountTiyn": "Слишком много"})

    response = TestClient(app).get("/api/_test/custom")
    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "overpayment",
            "message": "Остаток к оплате 100 ₸",
            "fields": {"amountTiyn": "Слишком много"},
        }
    }


def test_api_error_status_can_be_overridden_and_unknown_codes_refused() -> None:
    assert ApiError("not_found", status=404).status == 404
    assert ApiError("link_expired").status == 410
    with pytest.raises(ValueError):
        ApiError("made_up_code")


def test_error_codes_match_the_frontend_list() -> None:
    """The codes and statuses of frontend/src/services/errors.ts, in the order of the architecture."""
    assert list(API_ERROR_STATUS) == [
        "validation_error",
        "unauthorized",
        "not_found",
        "version_conflict",
        "document_locked",
        "exceeds_quote_total",
        "overpayment",
        "already_signed",
        "link_expired",
        "link_revoked",
        "rate_limited",
    ]
    assert [API_ERROR_STATUS[c] for c in API_ERROR_STATUS] == [422, 401, 404, 409, 409, 409, 409, 409, 410, 410, 429]
