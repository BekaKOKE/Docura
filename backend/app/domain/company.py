"""The rules of a company's requisites. Mirror of `frontend/src/domain/company.ts` and of `problems` and `cleaned` in
`frontend/src/services/mock/company.ts`, with the same Russian messages.

The time zone, the invoice due days and the lengths aren't checked by the mock. They come from the contract and
`replica/schema.sql`, which a real database would hold them to anyway.

Fields go by their snake_case names here; a value of None in a text field reads as empty, as in the mock.
"""

import re
from collections.abc import Mapping
from typing import Any
from zoneinfo import available_timezones

from app.domain.account import too_long
from app.domain.validators import normalize_kz_phone, validate_iik, validate_iin_bin, validate_kbe, validate_knp

LEGAL_FORMS = ("ip", "too", "ao", "other")
VALIDITY_DAYS_MIN = 1
VALIDITY_DAYS_MAX = 365
DUE_DAYS_MIN = 0
DUE_DAYS_MAX = 365

REQUIRED_MESSAGE = "Обязательное поле"
COMPANY_EXISTS = "У этого аккаунта уже есть компания."

# What is said when a field that can't be empty is. `bin_iin` is empty too, but its validator has its own message.
_REQUIRED: dict[str, str] = {
    "legal_name": "Укажите название компании.",
    "address": "Укажите адрес.",
    "director_name": "Укажите ФИО директора.",
    "director_position": "Укажите должность.",
}
_OPTIONAL_TEXT = ("phone", "bank_name", "iik", "bik", "kbe", "default_knp")
_MAX_LENGTHS = {
    "legal_name": 300,
    "email": 254,
    "director_name": 200,
    "director_position": 200,
    "vat_certificate": 100,
    "bank_name": 200,
}
_BIK = re.compile(r"[A-Z0-9]{8}")


def _no_spaces(value: str) -> str:
    return re.sub(r"\s", "", value)


def clean_text(field: str, raw: str | None) -> str:
    """What a typed value becomes before it is checked and saved: no stray spaces, ИИК and БИК in capitals."""
    value = (raw or "").strip()
    if field in ("bin_iin", "kbe", "default_knp"):
        return _no_spaces(value)
    if field in ("iik", "bik"):
        return _no_spaces(value).upper()
    if field == "phone":
        return normalize_kz_phone(value) or value
    return value


def _text_problem(field: str, value: str) -> str | None:
    if field == "bin_iin":
        return validate_iin_bin(value)
    if value == "":
        return _REQUIRED.get(field)
    if field == "iik":
        return validate_iik(value)
    if field == "kbe":
        return validate_kbe(value)
    if field == "default_knp":
        return validate_knp(value)
    if field == "bik" and _BIK.fullmatch(value) is None:
        return "БИК состоит из 8 латинских букв и цифр."
    if field == "phone" and normalize_kz_phone(value) is None:
        return "Телефон начинается с +7 и содержит 10 цифр, например +7 701 123 45 67."
    return None


def _timezone_problem(value: str) -> str | None:
    """An IANA name, never a fixed offset, and the `Etc/GMT-5` names are fixed offsets."""
    if value.startswith("Etc/") or value not in available_timezones():
        return "Укажите часовой пояс по названию IANA, например Asia/Almaty."
    return None


def company_problems(values: Mapping[str, Any], *, require_all: bool) -> dict[str, str]:
    """A message per wrong field of `values`. `require_all` checks the fields that are missing too (create)."""
    problems: dict[str, str] = {}
    for field in (*_REQUIRED, "bin_iin", *_OPTIONAL_TEXT):
        if field not in values and (field in _OPTIONAL_TEXT or not require_all):
            continue
        problem = _text_problem(field, clean_text(field, values.get(field)))
        if problem:
            problems[field] = problem
    for field, limit in _MAX_LENGTHS.items():
        if field not in problems and len((values.get(field) or "").strip()) > limit:
            problems[field] = too_long(limit)

    if ("legal_form" in values or require_all) and values.get("legal_form") not in LEGAL_FORMS:
        problems["legal_form"] = "Выберите форму: ИП, ТОО, АО или другая."
    if require_all and "vat_payer" not in values:
        problems["vat_payer"] = REQUIRED_MESSAGE
    if "quote_validity_days" in values and not VALIDITY_DAYS_MIN <= values["quote_validity_days"] <= VALIDITY_DAYS_MAX:
        problems["quote_validity_days"] = "Срок действия: целое число дней от 1 до 365."
    if "invoice_due_days" in values and not DUE_DAYS_MIN <= values["invoice_due_days"] <= DUE_DAYS_MAX:
        problems["invoice_due_days"] = "Срок оплаты: целое число дней от 0 до 365."
    if "timezone" in values:
        problem = _timezone_problem(values["timezone"])
        if problem:
            problems["timezone"] = problem
    return problems


def cleaned_company_values(values: Mapping[str, Any]) -> dict[str, Any]:
    """`values` as stored: text cleaned, and None when an optional field is empty."""
    cleaned = dict(values)
    for field in (*_REQUIRED, "bin_iin"):
        if field in values:
            cleaned[field] = clean_text(field, values[field])
    for field in (*_OPTIONAL_TEXT, "email"):
        if field in values:
            cleaned[field] = clean_text(field, values[field]) or None
    return cleaned
