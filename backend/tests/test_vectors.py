"""Every case of every file in contracts/test-vectors/, one pytest case each (AGENTS.md rule 3).

The frontend runs the same files in `frontend/src/domain/*.test.ts`. Run just these with `pytest -k vectors`.
"""

import pytest

from app.domain.amount_in_words import amount_in_words
from app.domain.money import parse_quantity_milli
from app.domain.totals import (
    DocumentTotals,
    LineInput,
    LineTotals,
    PrepaymentRejected,
    VatSetting,
    compute_prepayment,
    compute_totals,
)
from app.domain.validators import is_valid_iik, is_valid_iin_bin, validate_iik, validate_iin_bin
from vectors import VECTORS_DIR, load_cases, vector_params

VECTOR_FILES = ["totals", "prepayment", "bin-iin", "iik", "amount-in-words"]


@pytest.mark.parametrize("name", VECTOR_FILES)
def test_vectors_file_has_unique_case_ids(name: str) -> None:
    ids = [case["id"] for case in load_cases(name)]
    assert ids, f"{name}.json has no cases"
    assert len(set(ids)) == len(ids)


def test_vectors_every_json_file_is_covered() -> None:
    on_disk = sorted(path.stem for path in VECTORS_DIR.glob("*.json"))
    assert on_disk == sorted(VECTOR_FILES)


def _line_dict(totals: LineTotals) -> dict[str, int]:
    return {"netTiyn": totals.net_tiyn, "vatTiyn": totals.vat_tiyn, "grossTiyn": totals.gross_tiyn}


def _document_dict(totals: DocumentTotals) -> dict:
    return {
        "lines": [_line_dict(line) for line in totals.lines],
        "netTiyn": totals.net_tiyn,
        "vatTiyn": totals.vat_tiyn,
        "grossTiyn": totals.gross_tiyn,
    }


@pytest.mark.parametrize("case", vector_params("totals"))
def test_vectors_totals(case: dict) -> None:
    # The typed text must parse to the vector's quantity ...
    for line in case["lines"]:
        assert parse_quantity_milli(line["qtyText"]) == line["qtyMilli"]

    # ... and the totals must match exactly, in whole tiyn.
    result = compute_totals(
        [LineInput(line["qtyMilli"], line["unitPriceTiyn"], line["discountBp"]) for line in case["lines"]],
        VatSetting(case["vatEnabled"], case["vatRateBp"]),
    )
    assert _document_dict(result) == case["expected"]


@pytest.mark.parametrize("case", vector_params("prepayment"))
def test_vectors_prepayment(case: dict) -> None:
    result = compute_prepayment(
        quote_gross_tiyn=case["quoteGrossTiyn"],
        already_invoiced_tiyn=case["alreadyInvoicedTiyn"],
        basis=case["basis"],
        basis_value=case.get("basisValue"),
        vat=VatSetting(case["vatEnabled"], case["vatRateBp"]),
    )
    if isinstance(result, PrepaymentRejected):
        assert {"error": result.error} == case["expected"]
    else:
        assert _line_dict(result) == case["expected"]


@pytest.mark.parametrize("case", vector_params("bin-iin"))
def test_vectors_bin_iin(case: dict) -> None:
    assert is_valid_iin_bin(case["value"]) is case["valid"]
    message = validate_iin_bin(case["value"])
    if case["valid"]:
        assert message is None
    else:
        assert message is not None
        assert any("А" <= ch <= "я" or ch in "Ёё" for ch in message), "the message is in Russian"


@pytest.mark.parametrize("case", vector_params("iik"))
def test_vectors_iik(case: dict) -> None:
    assert is_valid_iik(case["value"]) is case["valid"]
    message = validate_iik(case["value"])
    if case["valid"]:
        assert message is None
    else:
        assert message is not None
        assert any("А" <= ch <= "я" or ch in "Ёё" for ch in message), "the message is in Russian"


@pytest.mark.parametrize("case", vector_params("amount-in-words"))
def test_vectors_amount_in_words(case: dict) -> None:
    assert amount_in_words(case["amountTiyn"]) == case["expected"]
