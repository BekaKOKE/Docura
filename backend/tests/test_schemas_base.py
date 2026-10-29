from app.schemas.base import CamelModel


class Payment(CamelModel):
    client_request_id: str
    amount_tiyn: int
    note: str | None = None


def test_serialises_to_camel_case() -> None:
    payment = Payment(client_request_id="r-1", amount_tiyn=1_500_000)
    assert payment.to_wire() == {"clientRequestId": "r-1", "amountTiyn": 1_500_000, "note": None}
    assert payment.model_dump_json(by_alias=True) == '{"clientRequestId":"r-1","amountTiyn":1500000,"note":null}'


def test_reads_camel_case_and_snake_case() -> None:
    from_wire = Payment.model_validate({"clientRequestId": "r-1", "amountTiyn": 5})
    from_code = Payment(client_request_id="r-1", amount_tiyn=5)
    assert from_wire == from_code


def test_round_trip_keeps_every_value() -> None:
    original = Payment(client_request_id="r-2", amount_tiyn=100, note="Предоплата: Қайрат")
    assert Payment.model_validate(original.to_wire()) == original


def test_openapi_schema_uses_camel_case_names() -> None:
    properties = Payment.model_json_schema(by_alias=True)["properties"]
    assert set(properties) == {"clientRequestId", "amountTiyn", "note"}
