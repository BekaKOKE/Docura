"""Line and document totals, and the prepayment VAT split. Integer tiyn only, rounding half up per line.

Mirror of `frontend/src/domain/totals.ts` (spec section 6; replica/architecture.md, Domain rules):

    net   = round(qty_milli * unit_price_tiyn * (10000 - discount_bp) / (1000 * 10000))
    vat   = vat_enabled ? round(net * vat_rate_bp / 10000) : 0
    gross = net + vat

VAT is per line; the document totals are the sums of the lines. The rate is passed in, because it is copied onto each
document (`vat_rate_bp`) and a later change of the statutory rate must not rewrite old documents.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from app.domain.money import (
    BASIS_POINTS,
    MILLI_PER_UNIT,
    QtyMilli,
    Tiyn,
    assert_non_negative_integer,
    div_round_half_up,
    is_int,
    to_safe_tiyn,
)

DEFAULT_VAT_RATE_BP = 1600


@dataclass(frozen=True, slots=True)
class LineInput:
    qty_milli: QtyMilli
    unit_price_tiyn: Tiyn
    # Line discounts are post-MVP (#70); the MVP always passes 0.
    discount_bp: int = 0


@dataclass(frozen=True, slots=True)
class VatSetting:
    vat_enabled: bool
    vat_rate_bp: int = DEFAULT_VAT_RATE_BP


@dataclass(frozen=True, slots=True)
class LineTotals:
    net_tiyn: Tiyn
    vat_tiyn: Tiyn
    gross_tiyn: Tiyn


@dataclass(frozen=True, slots=True)
class DocumentTotals:
    lines: tuple[LineTotals, ...]
    net_tiyn: Tiyn
    vat_tiyn: Tiyn
    gross_tiyn: Tiyn


def compute_line(line: LineInput, vat: VatSetting) -> LineTotals:
    assert_non_negative_integer(line.qty_milli, "qty_milli")
    assert_non_negative_integer(line.unit_price_tiyn, "unit_price_tiyn")
    assert_non_negative_integer(vat.vat_rate_bp, "vat_rate_bp")
    if not is_int(line.discount_bp) or not 0 <= line.discount_bp <= BASIS_POINTS:
        raise ValueError("discount_bp must be an integer from 0 to 10000")

    scaled = line.qty_milli * line.unit_price_tiyn * (BASIS_POINTS - line.discount_bp)
    net = div_round_half_up(scaled, MILLI_PER_UNIT * BASIS_POINTS)
    vat_amount = div_round_half_up(net * vat.vat_rate_bp, BASIS_POINTS) if vat.vat_enabled else 0
    return LineTotals(to_safe_tiyn(net), to_safe_tiyn(vat_amount), to_safe_tiyn(net + vat_amount))


def compute_totals(lines: Sequence[LineInput], vat: VatSetting) -> DocumentTotals:
    computed = tuple(compute_line(line, vat) for line in lines)
    net = sum(line.net_tiyn for line in computed)
    vat_sum = sum(line.vat_tiyn for line in computed)
    return DocumentTotals(computed, to_safe_tiyn(net), to_safe_tiyn(vat_sum), to_safe_tiyn(net + vat_sum))


def split_gross(gross_tiyn: Tiyn, vat: VatSetting) -> LineTotals:
    """A one-line invoice has an exact gross; VAT is split back out: vat = round(gross * rate / (10000 + rate))."""
    assert_non_negative_integer(gross_tiyn, "gross_tiyn")
    assert_non_negative_integer(vat.vat_rate_bp, "vat_rate_bp")
    rate = vat.vat_rate_bp
    vat_amount = div_round_half_up(gross_tiyn * rate, BASIS_POINTS + rate) if vat.vat_enabled else 0
    return LineTotals(to_safe_tiyn(gross_tiyn - vat_amount), to_safe_tiyn(vat_amount), gross_tiyn)


PrepaymentBasisName = Literal["percent", "amount", "remaining"]
PrepaymentErrorCode = Literal["exceeds_quote_total", "invalid_amount"]


@dataclass(frozen=True, slots=True)
class PrepaymentRejected:
    """Returned, not raised, as in the TypeScript `{ error }`; the service maps `exceeds_quote_total` to a 409."""

    error: PrepaymentErrorCode


def compute_prepayment(
    *,
    quote_gross_tiyn: Tiyn,
    already_invoiced_tiyn: Tiyn,
    basis: PrepaymentBasisName,
    vat: VatSetting,
    basis_value: int | None = None,
) -> LineTotals | PrepaymentRejected:
    """The one-line invoice made from a quote. The invoices from one quote never add up to more than its total.

    `basis_value` is basis points for "percent" (5000 = 50 %) and tiyn for "amount"; "remaining" takes none.
    """
    assert_non_negative_integer(quote_gross_tiyn, "quote_gross_tiyn")
    assert_non_negative_integer(already_invoiced_tiyn, "already_invoiced_tiyn")

    left = quote_gross_tiyn - already_invoiced_tiyn
    if basis == "percent":
        assert_non_negative_integer(basis_value, "basis_value")
        gross = div_round_half_up(quote_gross_tiyn * basis_value, BASIS_POINTS)  # type: ignore[operator]
    elif basis == "amount":
        assert_non_negative_integer(basis_value, "basis_value")
        gross = basis_value  # type: ignore[assignment]
    elif basis == "remaining":
        gross = left
    else:
        raise ValueError(f"unknown prepayment basis: {basis}")

    if gross > left or left <= 0:
        return PrepaymentRejected("exceeds_quote_total")
    if gross <= 0:
        return PrepaymentRejected("invalid_amount")
    return split_gross(to_safe_tiyn(gross), vat)
