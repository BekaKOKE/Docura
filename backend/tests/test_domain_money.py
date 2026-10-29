"""Unit tests for money and totals: the edge cases of frontend/src/domain/{money,totals}.test.ts."""

from typing import ClassVar

import pytest

from app.domain.money import MAX_SAFE_INTEGER, div_round_half_up, parse_price_tiyn, parse_quantity_milli, to_safe_tiyn
from app.domain.totals import (
    LineInput,
    LineTotals,
    PrepaymentRejected,
    VatSetting,
    compute_line,
    compute_prepayment,
    compute_totals,
    split_gross,
)

NBSP = " "
VAT_ON = VatSetting(True, 1600)
VAT_OFF = VatSetting(False, 1600)


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("12,5", 12500),
        ("12.5", 12500),
        ("0,125", 125),
        ("32", 32000),
        ("1 000", 1_000_000),
        ("007,5", 7500),
        ("  3,25  ", 3250),
        ("999999999,999", 999_999_999_999),
    ],
)
def test_parse_quantity_milli(text: str, expected: int) -> None:
    assert parse_quantity_milli(text) == expected


@pytest.mark.parametrize(
    "text",
    ["1,2345", "-5", "-0,5", "abc", "12a", "1,2,3", "", "   ", ",5", "12,", "1e3", "+5", "1234567890", "١٢", "５"],
)
def test_parse_quantity_milli_rejects(text: str) -> None:
    assert parse_quantity_milli(text) is None


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("18 500", 1_850_000),
        (f"18{NBSP}500", 1_850_000),
        ("18 500", 1_850_000),
        ("18500,50", 1_850_050),
        ("18500.5", 1_850_050),
        ("0,01", 1),
        ("0", 0),
        ("9 999 999", 999_999_900),
    ],
)
def test_parse_price_tiyn(text: str, expected: int) -> None:
    assert parse_price_tiyn(text) == expected


@pytest.mark.parametrize("text", ["1,234", "-5", "abc", "", "18 500 ₸", "1,5,0"])
def test_parse_price_tiyn_rejects(text: str) -> None:
    assert parse_price_tiyn(text) is None


@pytest.mark.parametrize(
    ("numerator", "denominator", "expected"),
    [(5, 2, 3), (4, 2, 2), (1, 3, 0), (2, 3, 1), (3, 2, 2), (0, 7, 0), (1, 2, 1), (3, 6, 1)],
)
def test_div_round_half_up(numerator: int, denominator: int, expected: int) -> None:
    assert div_round_half_up(numerator, denominator) == expected


def test_div_round_half_up_refuses_negative_and_zero_denominator() -> None:
    with pytest.raises(ValueError):
        div_round_half_up(-1, 2)
    with pytest.raises(ValueError):
        div_round_half_up(1, 0)


def test_to_safe_tiyn_throws_instead_of_losing_what_the_frontend_would() -> None:
    assert to_safe_tiyn(123) == 123
    assert to_safe_tiyn(MAX_SAFE_INTEGER) == MAX_SAFE_INTEGER
    with pytest.raises(ValueError):
        to_safe_tiyn(MAX_SAFE_INTEGER + 1)


def test_line_rounds_half_up_not_down_and_not_to_even() -> None:
    # 1,5 x 1 001,01 = 150 151,5 tiyn -> 150 152
    assert compute_line(LineInput(1500, 100101), VAT_OFF).net_tiyn == 150152
    # 0,001 x 5 tiyn = 0,005 -> 0; 0,001 x 500 tiyn = 0,5 -> 1
    assert compute_line(LineInput(1, 5), VatSetting(False, 0)).net_tiyn == 0
    assert compute_line(LineInput(1, 500), VatSetting(False, 0)).net_tiyn == 1
    # 2,5 tiyn would round to 3 (even rounding gives 2): 0,005 x 500 tiyn
    assert compute_line(LineInput(5, 500), VatSetting(False, 0)).net_tiyn == 3


def test_line_from_the_issue_test_cases() -> None:
    assert compute_line(LineInput(12500, 1_850_000), VAT_ON) == LineTotals(23_125_000, 3_700_000, 26_825_000)
    assert compute_line(LineInput(1500, 100101), VAT_ON) == LineTotals(150_152, 24_024, 174_176)


def test_vat_is_rounded_half_up_on_the_net() -> None:
    # net 3 tiyn x 16 % = 0,48 -> 0; net 4 x 16 % = 0,64 -> 1; net 25 x 16 % = 4,0; net 3125 x 16 % = 500
    assert compute_line(LineInput(1000, 3), VAT_ON).vat_tiyn == 0
    assert compute_line(LineInput(1000, 4), VAT_ON).vat_tiyn == 1
    # 50 x 1 % (rate 100 bp) = 0,5 -> 1
    assert compute_line(LineInput(1000, 50), VatSetting(True, 100)).vat_tiyn == 1


def test_no_vat_when_off_whatever_the_rate_says() -> None:
    assert compute_line(LineInput(1000, 10000), VAT_OFF) == LineTotals(10000, 0, 10000)


def test_discount_in_basis_points_uses_the_same_formula() -> None:
    assert compute_line(LineInput(1000, 10000, 1000), VAT_OFF).net_tiyn == 9000
    assert compute_line(LineInput(1000, 10000, 10000), VAT_ON) == LineTotals(0, 0, 0)


def test_zero_quantity_and_zero_price_give_zero() -> None:
    assert compute_line(LineInput(0, 100), VAT_ON) == LineTotals(0, 0, 0)
    assert compute_line(LineInput(1000, 0), VAT_ON) == LineTotals(0, 0, 0)


@pytest.mark.parametrize(
    "line",
    [
        LineInput(-1, 1),
        LineInput(1, -1),
        LineInput(1, 1, -1),
        LineInput(1, 1, 10001),
        LineInput(1.5, 1),  # type: ignore[arg-type]
        LineInput(True, 1),  # type: ignore[arg-type]
        LineInput(10**12, 10**14),
    ],
)
def test_line_refuses_negative_fractional_and_unsafe_inputs(line: LineInput) -> None:
    with pytest.raises(ValueError):
        compute_line(line, VAT_ON)


def test_negative_vat_rate_is_refused() -> None:
    with pytest.raises(ValueError):
        compute_line(LineInput(1, 1), VatSetting(True, -1))


def test_9_999_999_tenge_x_1000_stays_exact() -> None:
    qty = parse_quantity_milli("1000")
    assert qty == 1_000_000
    line = compute_line(LineInput(1_000_000, 999_999_900), VAT_ON)
    assert line == LineTotals(999_999_900_000, 159_999_984_000, 1_159_999_884_000)
    assert all(type(value) is int for value in (line.net_tiyn, line.vat_tiyn, line.gross_tiyn))


def test_document_vat_is_the_sum_of_the_lines_not_vat_on_the_sum() -> None:
    # Two lines of 0,03 tenge: VAT per line rounds 0,48 tiyn to 0 each; VAT on the sum would round 0,96 to 1.
    result = compute_totals([LineInput(1000, 3), LineInput(1000, 3)], VAT_ON)
    assert result.vat_tiyn == 0
    assert result.gross_tiyn == 6


def test_no_lines_total_zero() -> None:
    result = compute_totals([], VAT_ON)
    assert (result.lines, result.net_tiyn, result.vat_tiyn, result.gross_tiyn) == ((), 0, 0, 0)


def test_gross_is_net_plus_vat_for_the_document() -> None:
    result = compute_totals([LineInput(12500, 1_850_000), LineInput(32000, 150_000)], VAT_ON)
    assert result.gross_tiyn == result.net_tiyn + result.vat_tiyn == 32_393_000


def test_split_gross_takes_vat_back_out() -> None:
    assert split_gross(11600, VAT_ON) == LineTotals(10000, 1600, 11600)
    assert split_gross(11600, VAT_OFF) == LineTotals(11600, 0, 11600)


def test_prepayment_split_from_the_issue_test_cases() -> None:
    half = compute_prepayment(
        quote_gross_tiyn=32_393_000, already_invoiced_tiyn=0, basis="percent", basis_value=5000, vat=VAT_ON
    )
    assert half == LineTotals(13_962_500, 2_234_000, 16_196_500)
    amount = compute_prepayment(
        quote_gross_tiyn=32_393_000, already_invoiced_tiyn=0, basis="amount", basis_value=10_000_000, vat=VAT_ON
    )
    assert isinstance(amount, LineTotals)
    assert amount.vat_tiyn == 1_379_310


class TestPrepaymentEdges:
    base: ClassVar[dict] = {"quote_gross_tiyn": 1000, "already_invoiced_tiyn": 0, "vat": VAT_OFF}

    @pytest.mark.parametrize("basis", ["amount", "percent"])
    def test_zero_is_an_invalid_amount(self, basis: str) -> None:
        result = compute_prepayment(**self.base, basis=basis, basis_value=0)  # type: ignore[arg-type]
        assert result == PrepaymentRejected("invalid_amount")

    def test_exactly_what_is_left_is_allowed(self) -> None:
        result = compute_prepayment(
            quote_gross_tiyn=1000, already_invoiced_tiyn=400, basis="amount", basis_value=600, vat=VAT_OFF
        )
        assert result == LineTotals(600, 0, 600)

    def test_one_tiyn_more_than_what_is_left_is_refused(self) -> None:
        result = compute_prepayment(
            quote_gross_tiyn=1000, already_invoiced_tiyn=400, basis="amount", basis_value=601, vat=VAT_OFF
        )
        assert result == PrepaymentRejected("exceeds_quote_total")

    def test_remaining_with_nothing_left_exceeds_the_total(self) -> None:
        result = compute_prepayment(quote_gross_tiyn=1000, already_invoiced_tiyn=1000, basis="remaining", vat=VAT_OFF)
        assert result == PrepaymentRejected("exceeds_quote_total")

    def test_remaining_takes_the_rest(self) -> None:
        result = compute_prepayment(quote_gross_tiyn=1000, already_invoiced_tiyn=250, basis="remaining", vat=VAT_ON)
        assert isinstance(result, LineTotals)
        assert result.gross_tiyn == 750

    def test_percent_is_rounded_half_up(self) -> None:
        # 33,33 % of 1001 tiyn = 333,6333 -> 334 ; 50 % of 1001 = 500,5 -> 501
        half = compute_prepayment(
            quote_gross_tiyn=1001, already_invoiced_tiyn=0, basis="percent", basis_value=5000, vat=VAT_OFF
        )
        assert isinstance(half, LineTotals)
        assert half.gross_tiyn == 501

    def test_unknown_basis_is_refused(self) -> None:
        with pytest.raises(ValueError):
            compute_prepayment(**self.base, basis="discount")  # type: ignore[arg-type]
