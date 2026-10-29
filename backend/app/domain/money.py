"""Money in integer tiyn (1 tenge = 100 tiyn), quantities in thousandths, rates in basis points.

Mirror of `frontend/src/domain/money.ts`. Python ints are exact, so nothing here uses `float` or `Decimal`. The one
limit kept from the TypeScript side is the safe-integer range (2**53 - 1): an amount beyond it is rejected on both
sides, so the two implementations accept exactly the same inputs.
"""

import re

Tiyn = int
QtyMilli = int

TIYN_PER_TENGE = 100
MILLI_PER_UNIT = 1000
BASIS_POINTS = 10_000

# The largest integer a JavaScript number holds exactly; the frontend throws beyond it, so the backend does too.
MAX_SAFE_INTEGER = 2**53 - 1

# Digits of the integer part we accept; keeps every parsed value a safe integer.
MAX_QTY_INT_DIGITS = 9
MAX_PRICE_INT_DIGITS = 12

# Group separators a user may type: any white space (space, U+00A0, U+202F, U+2009 ...).
_GROUP_SPACES = re.compile(r"\s+")
# ASCII digits only: `\d` would accept Arabic-Indic and full-width digits.
_DECIMAL = re.compile(r"([0-9]+)(?:[.,]([0-9]+))?")


def is_int(value: object) -> bool:
    """An int that is not a bool (`True` is an int in Python, but never an amount)."""
    return isinstance(value, int) and not isinstance(value, bool)


def _parse_decimal(text: str, max_int_digits: int, max_fraction_digits: int, fraction_scale: int) -> int | None:
    compact = _GROUP_SPACES.sub("", text)
    match = _DECIMAL.fullmatch(compact)
    if match is None:
        return None
    int_part = match.group(1).lstrip("0") or "0"
    fraction = match.group(2) or ""
    if len(int_part) > max_int_digits or len(fraction) > max_fraction_digits:
        return None
    padded = fraction.ljust(max_fraction_digits, "0")
    return int(int_part) * fraction_scale + int(padded or "0")


def parse_quantity_milli(text: str) -> QtyMilli | None:
    """ "12,5" / "12.5" / "0,125" -> 12500 / 12500 / 125. Up to 3 decimals. None for negatives, letters, empty."""
    return _parse_decimal(text, MAX_QTY_INT_DIGITS, 3, MILLI_PER_UNIT)


def parse_price_tiyn(text: str) -> Tiyn | None:
    """ "18 500" / "18500,50" -> 1850000 / 1850050. Up to 2 decimals."""
    return _parse_decimal(text, MAX_PRICE_INT_DIGITS, 2, TIYN_PER_TENGE)


def div_round_half_up(numerator: int, denominator: int) -> int:
    """Integer division that rounds half up. The numerator must not be negative."""
    if numerator < 0 or denominator <= 0:
        raise ValueError("div_round_half_up expects a non-negative numerator and a positive denominator")
    return (2 * numerator + denominator) // (2 * denominator)


def to_safe_tiyn(value: int) -> Tiyn:
    """The value itself, or ValueError when the frontend could not hold it exactly."""
    if value > MAX_SAFE_INTEGER or value < -MAX_SAFE_INTEGER:
        raise ValueError("Amount does not fit into a safe integer of tiyn")
    return value


def assert_tiyn(value: object) -> None:
    if not is_int(value) or abs(value) > MAX_SAFE_INTEGER:  # type: ignore[arg-type]
        raise ValueError("Tiyn must be a safe integer")


def assert_non_negative_integer(value: object, name: str) -> None:
    if not is_int(value) or value < 0 or value > MAX_SAFE_INTEGER:  # type: ignore[operator]
        raise ValueError(f"{name} must be a non-negative integer")
