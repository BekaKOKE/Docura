"""The routes built so far match `contracts/openapi.yaml`. The full parity check over every operation is #45; this one
covers what exists, so a route can't drift from the contract while the rest is being built."""

from pathlib import Path
from typing import Any

import pytest
import yaml
from fastapi import FastAPI

from app.errors import DEFAULT_MESSAGES

CONTRACT = yaml.safe_load((Path(__file__).parents[2] / "contracts" / "openapi.yaml").read_text(encoding="utf-8"))
METHODS = {"get", "put", "post", "patch", "delete"}

# The contract's schema of each wire model, and the model the app answers with.
SCHEMAS = {"User": "UserOut", "AuthSession": "AuthSession", "Me": "Me", "Company": "CompanyOut"}


def operations(spec: dict[str, Any]) -> dict[tuple[str, str], dict[str, Any]]:
    return {
        (method, path): operation
        for path, item in spec["paths"].items()
        for method, operation in item.items()
        if method in METHODS
    }


@pytest.fixture
def spec(app: FastAPI) -> dict[str, Any]:
    return app.openapi()


def test_every_route_of_the_app_is_in_the_contract_under_its_operation_id(spec: dict[str, Any]) -> None:
    contract = operations(CONTRACT)
    for key, operation in operations(spec).items():
        assert key in contract, f"{key} is not in the contract"
        if key != ("get", "/api/health"):
            assert operation["operationId"] == contract[key]["operationId"]


def test_the_routes_of_39_are_all_there(spec: dict[str, Any]) -> None:
    built = {operation.get("operationId") for operation in operations(spec).values()}
    assert built >= {
        "authRegister",
        "authLogin",
        "authMe",
        "companyCreate",
        "companyGet",
        "companyUpdate",
        "companyUploadLogo",
        "companyGetLogo",
    }


def test_each_route_succeeds_with_the_status_of_the_contract(spec: dict[str, Any]) -> None:
    contract = operations(CONTRACT)
    for key, operation in operations(spec).items():
        success = {status for status in operation["responses"] if status.startswith("2")}
        assert success == {status for status in contract[key]["responses"] if status.startswith("2")}, key


def test_the_login_takes_json_and_the_form(spec: dict[str, Any]) -> None:
    content_types = {
        frozenset(side["paths"]["/api/auth/login"]["post"]["requestBody"]["content"]) for side in (spec, CONTRACT)
    }
    assert content_types == {frozenset({"application/json", "application/x-www-form-urlencoded"})}


@pytest.mark.parametrize(("contract_name", "app_name"), SCHEMAS.items())
def test_wire_models_have_the_fields_of_the_contract(spec: dict[str, Any], contract_name: str, app_name: str) -> None:
    ours = spec["components"]["schemas"][app_name]
    theirs = CONTRACT["components"]["schemas"][contract_name]
    assert set(ours["properties"]) == set(theirs["properties"])
    assert set(theirs["required"]) <= set(ours["required"])


def test_the_company_input_has_the_fields_of_the_contract(spec: dict[str, Any]) -> None:
    theirs = CONTRACT["components"]["schemas"]
    assert set(spec["components"]["schemas"]["CompanyInput"]["properties"]) == set(theirs["CompanyPatch"]["properties"])
    assert set(spec["components"]["schemas"]["CompanyInput"]["required"]) == set(theirs["CompanyInput"]["required"])


@pytest.mark.parametrize(
    ("where", "code"),
    [
        (("components", "responses", "Unauthorized"), "unauthorized"),
        (("components", "responses", "NotFound"), "not_found"),
        (("components", "responses", "ValidationError"), "validation_error"),
        (("paths", "/api/auth/login", "post", "responses", "429"), "rate_limited"),
    ],
)
def test_error_messages_are_the_contracts_examples(where: tuple[str, ...], code: str) -> None:
    node: Any = CONTRACT
    for key in where:
        node = node[key]
    example = node["content"]["application/json"]["examples"][code]["value"]["error"]
    assert example["message"] == DEFAULT_MESSAGES[code]
