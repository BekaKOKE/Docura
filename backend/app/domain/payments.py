"""Derived states: the payment state of an invoice and the expiry of a quote.

Neither is stored; both are computed when read, so no timer has to run. "Today" is the calendar day in the company's
time zone (`dates.today_in_zone`), and `due_date` / `valid_until` are `YYYY-MM-DD` strings, which compare as text.
Mirror of the rules in `frontend/src/services/mock/documents.ts`.
"""

from dataclasses import dataclass
from typing import Literal

from app.domain.money import Tiyn

PaymentState = Literal["unpaid", "partial", "paid", "overdue"]


@dataclass(frozen=True, slots=True)
class PaymentSummary:
    state: PaymentState
    paid_tiyn: Tiyn
    balance_tiyn: Tiyn


def payment_summary(gross_tiyn: Tiyn, paid_tiyn: Tiyn, due_date: str | None, today: str) -> PaymentSummary:
    """paid when nothing is left; else overdue when past the due date; else partial when something was paid."""
    balance = gross_tiyn - paid_tiyn
    past_due = due_date is not None and due_date < today
    if balance <= 0:
        state: PaymentState = "paid"
    elif past_due:
        state = "overdue"
    elif paid_tiyn > 0:
        state = "partial"
    else:
        state = "unpaid"
    return PaymentSummary(state, paid_tiyn, balance)


def payment_state(gross_tiyn: Tiyn, paid_tiyn: Tiyn, due_date: str | None, today: str) -> PaymentState:
    return payment_summary(gross_tiyn, paid_tiyn, due_date, today).state


def is_overpayment(gross_tiyn: Tiyn, paid_tiyn: Tiyn, new_payment_tiyn: Tiyn) -> bool:
    """A payment that would take the paid total above the invoice total is rejected."""
    return paid_tiyn + new_payment_tiyn > gross_tiyn


def is_quote_expired(status: str, valid_until: str | None, today: str) -> bool:
    """A sent quote is expired the day after `valid_until`; the stored status stays `sent`."""
    return status == "sent" and valid_until is not None and valid_until < today
