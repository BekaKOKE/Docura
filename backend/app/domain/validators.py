"""Field validators: ИИН/БИН, ИИК, КНП, Кбе and the Kazakhstan phone number.

Mirror of `frontend/src/domain/{binIin,iik,requisites,phone}.ts`, with the same Russian messages. A validator returns
None when the value is valid, otherwise the message for the user. Only ASCII digits count as digits (`\\d` would also
match Arabic-Indic and full-width ones), and `re.fullmatch` is used because `$` matches before a trailing newline.
"""

import re

Validation = str | None

_DIGITS = re.compile(r"[0-9]+")
_FIRST_WEIGHTS = (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11)
_SECOND_WEIGHTS = (3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2)


def _weighted_mod11(digits: list[int], weights: tuple[int, ...]) -> int:
    return sum(d * w for d, w in zip(digits, weights, strict=False)) % 11


def validate_iin_bin(value: str) -> Validation:
    """12 digits; the 12th is a control digit (docs/kz-rules.md, row 6).

    Weights 1-11 over digits 1-11, mod 11; if that is 10, weights 3-11, 1, 2; if that is 10 again, it is invalid.
    """
    if value == "":
        return "Введите ИИН или БИН"
    if _DIGITS.fullmatch(value) is None:
        return "ИИН и БИН состоят только из цифр"
    if len(value) != 12:
        return "ИИН и БИН состоят из 12 цифр"

    digits = [int(char) for char in value]
    control = _weighted_mod11(digits, _FIRST_WEIGHTS)
    if control == 10:
        control = _weighted_mod11(digits, _SECOND_WEIGHTS)
    if control == 10 or control != digits[11]:
        return "ИИН или БИН указан неверно: проверьте цифры"
    return None


def is_valid_iin_bin(value: str) -> bool:
    return validate_iin_bin(value) is None


IIK_LENGTH = 20
_IIK_CHARS = re.compile(r"[A-Z0-9]+")


def _mod97(rearranged: str) -> int:
    """Letters become two digits (A = 10 ... Z = 35); the remainder is carried digit by digit."""
    remainder = 0
    for char in rearranged:
        code = char if char <= "9" else str(ord(char) - 55)
        for digit in code:
            remainder = (remainder * 10 + int(digit)) % 97
    return remainder


def validate_iik(value: str) -> Validation:
    """20 characters, starts with KZ, upper-case letters and digits, IBAN mod-97 equals 1."""
    if value == "":
        return "Введите ИИК"
    if _IIK_CHARS.fullmatch(value) is None:
        return "ИИК состоит из заглавных латинских букв и цифр, без пробелов"
    if len(value) != IIK_LENGTH:
        return "ИИК состоит из 20 символов"
    if not value.startswith("KZ"):
        return "ИИК начинается с букв KZ"
    if _mod97(value[4:] + value[:4]) != 1:
        return "ИИК указан неверно: проверьте символы"
    return None


def is_valid_iik(value: str) -> bool:
    return validate_iik(value) is None


def validate_knp(value: str) -> Validation:
    """КНП (payment purpose code) is 3 digits."""
    if value == "":
        return "Введите КНП"
    if re.fullmatch(r"[0-9]{3}", value) is None:
        return "КНП состоит из 3 цифр"
    return None


def validate_kbe(value: str) -> Validation:
    """Кбе is 2 digits."""
    if value == "":
        return "Введите Кбе"
    if re.fullmatch(r"[0-9]{2}", value) is None:
        return "Кбе состоит из 2 цифр"
    return None


_NATIONAL_DIGITS = 10
_PHONE_CHARS = re.compile(r"\+?[0-9\s\-()]+")


def normalize_kz_phone(text: str) -> str | None:
    """ "+7 701 123 45 67" from what was typed, or None when it isn't a +7 number with 10 digits.

    Spaces, dashes and brackets are ignored. An "8" or "7" in front of 10 digits is the same number written the old
    way, so it is accepted and stored as "+7"; "+8..." is some other country.
    """
    trimmed = text.strip()
    if _PHONE_CHARS.fullmatch(trimmed) is None:
        return None
    digits = re.sub(r"[^0-9]", "", trimmed)
    if len(digits) != _NATIONAL_DIGITS + 1:
        return None
    if not digits.startswith("7") and not (digits.startswith("8") and not trimmed.startswith("+")):
        return None
    national = digits[1:]
    return f"+7 {national[:3]} {national[3:6]} {national[6:8]} {national[8:]}"


def is_valid_kz_phone(text: str) -> bool:
    return normalize_kz_phone(text) is not None
