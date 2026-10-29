"""Pure business rules: no FastAPI, no SQLAlchemy, no storage. Shared test vectors live in contracts/test-vectors/.

The same rules exist in `frontend/src/domain`; both are tested against the same JSON files.
"""

from app.domain.amount_in_words import amount_in_words
from app.domain.dates import COMPANY_TIME_ZONE, add_days, days_between, is_iso_date, today_in_zone
from app.domain.errors import DomainError, InvalidTransition
from app.domain.money import (
    div_round_half_up,
    parse_price_tiyn,
    parse_quantity_milli,
)
from app.domain.numbering import NUMBER_PREFIX, DocumentType, format_document_number, year_of
from app.domain.payments import (
    PaymentState,
    PaymentSummary,
    is_overpayment,
    is_quote_expired,
    payment_state,
    payment_summary,
)
from app.domain.search import search_key
from app.domain.share_token import is_well_formed_token, new_share_token, share_url, tokens_equal
from app.domain.totals import (
    DocumentTotals,
    LineInput,
    LineTotals,
    PrepaymentRejected,
    VatSetting,
    compute_line,
    compute_prepayment,
    compute_totals,
    split_gross,
)
from app.domain.transitions import (
    ISSUED_STATUS,
    assert_transition,
    can_transition,
    is_deletable,
    is_editable,
)
from app.domain.validators import (
    is_valid_iik,
    is_valid_iin_bin,
    is_valid_kz_phone,
    normalize_kz_phone,
    validate_iik,
    validate_iin_bin,
    validate_kbe,
    validate_knp,
)

__all__ = [
    "COMPANY_TIME_ZONE",
    "ISSUED_STATUS",
    "NUMBER_PREFIX",
    "DocumentTotals",
    "DocumentType",
    "DomainError",
    "InvalidTransition",
    "LineInput",
    "LineTotals",
    "PaymentState",
    "PaymentSummary",
    "PrepaymentRejected",
    "VatSetting",
    "add_days",
    "amount_in_words",
    "assert_transition",
    "can_transition",
    "compute_line",
    "compute_prepayment",
    "compute_totals",
    "days_between",
    "div_round_half_up",
    "format_document_number",
    "is_deletable",
    "is_editable",
    "is_iso_date",
    "is_overpayment",
    "is_quote_expired",
    "is_valid_iik",
    "is_valid_iin_bin",
    "is_valid_kz_phone",
    "is_well_formed_token",
    "new_share_token",
    "normalize_kz_phone",
    "parse_price_tiyn",
    "parse_quantity_milli",
    "payment_state",
    "payment_summary",
    "search_key",
    "share_url",
    "split_gross",
    "today_in_zone",
    "tokens_equal",
    "validate_iik",
    "validate_iin_bin",
    "validate_kbe",
    "validate_knp",
    "year_of",
]
