"""Unit tests for numbering, validators, search key, amount in words, dates, payment state and share tokens."""

from datetime import UTC, datetime

import pytest

from app.domain.amount_in_words import amount_in_words
from app.domain.dates import add_days, days_between, is_iso_date, today_in_zone
from app.domain.numbering import format_document_number, year_of
from app.domain.payments import is_overpayment, is_quote_expired, payment_state, payment_summary
from app.domain.search import search_key
from app.domain.share_token import is_well_formed_token, new_share_token, share_url, tokens_equal
from app.domain.validators import (
    is_valid_kz_phone,
    normalize_kz_phone,
    validate_iik,
    validate_iin_bin,
    validate_kbe,
    validate_knp,
)

# ---------------------------------------------------------------- numbering


def test_number_format() -> None:
    assert format_document_number("quote", 2026, 1) == "КП-2026-0001"
    assert format_document_number("invoice", 2026, 14) == "СЧ-2026-0014"
    assert format_document_number("act", 2026, 3) == "АВР-2026-0003"
    assert format_document_number("quote", 2027, 12345) == "КП-2027-12345"


def test_number_sequence_starts_at_one() -> None:
    with pytest.raises(ValueError):
        format_document_number("quote", 2026, 0)


def test_year_of_an_issue_date() -> None:
    assert year_of("2026-12-31") == 2026


# ---------------------------------------------------------------- validators


def test_iin_bin_messages_name_the_problem() -> None:
    assert validate_iin_bin("") == "Введите ИИН или БИН"
    assert validate_iin_bin("85031230012A") == "ИИН и БИН состоят только из цифр"
    assert validate_iin_bin("85031230012") == "ИИН и БИН состоят из 12 цифр"
    assert validate_iin_bin("850312300122") == "ИИН или БИН указан неверно: проверьте цифры"
    assert validate_iin_bin("850312300121") is None


@pytest.mark.parametrize("value", ["８５０３１２３００１２１", "850312300121\n", " 850312300121"])
def test_iin_bin_accepts_ascii_digits_only(value: str) -> None:
    assert validate_iin_bin(value) is not None


def test_iik_messages_name_the_problem() -> None:
    assert validate_iik("") == "Введите ИИК"
    assert validate_iik("KZ75998KZT100130033") == "ИИК состоит из 20 символов"
    assert validate_iik("RU75998KZT1001300335") == "ИИК начинается с букв KZ"
    assert validate_iik("KZ76998KZT1001300335") == "ИИК указан неверно: проверьте символы"
    assert validate_iik("kz75998kzt1001300335") == "ИИК состоит из заглавных латинских букв и цифр, без пробелов"
    assert validate_iik("KZ75998KZT1001300335") is None
    assert validate_iik("KZ75998KZT1001300335\n") is not None


@pytest.mark.parametrize("value", ["859", "000", "123"])
def test_knp_accepts(value: str) -> None:
    assert validate_knp(value) is None


@pytest.mark.parametrize("value", ["85", "8590", "85A", "", " 85", "８５９", "859\n"])
def test_knp_rejects_with_a_russian_message(value: str) -> None:
    message = validate_knp(value)
    assert message is not None
    assert "КНП" in message


@pytest.mark.parametrize("value", ["17", "19", "00"])
def test_kbe_accepts(value: str) -> None:
    assert validate_kbe(value) is None


@pytest.mark.parametrize("value", ["7", "170", "1A", "", " 7"])
def test_kbe_rejects_with_a_russian_message(value: str) -> None:
    message = validate_kbe(value)
    assert message is not None
    assert "Кбе" in message


@pytest.mark.parametrize(
    ("typed", "expected"),
    [
        ("+7 701 123 45 67", "+7 701 123 45 67"),
        ("+77011234567", "+7 701 123 45 67"),
        ("8 (701) 123-45-67", "+7 701 123 45 67"),
        ("87011234567", "+7 701 123 45 67"),
        ("77011234567", "+7 701 123 45 67"),
        ("  +7(701)1234567 ", "+7 701 123 45 67"),
    ],
)
def test_phone_normalised(typed: str, expected: str) -> None:
    assert normalize_kz_phone(typed) == expected
    assert is_valid_kz_phone(typed)


@pytest.mark.parametrize(
    "typed",
    ["", "+8 701 123 45 67", "+7 701 123 45 6", "+7 701 123 45 678", "+1 701 123 45 67", "abc", "+7 701 12a 45 67"],
)
def test_phone_rejected(typed: str) -> None:
    assert normalize_kz_phone(typed) is None
    assert not is_valid_kz_phone(typed)


# ---------------------------------------------------------------- search key


def test_search_key_treats_yo_and_ye_as_one_letter() -> None:
    assert search_key("Ёлкина") == "елкина"
    assert search_key("Ирина Ёлкина") == search_key("ирина елкина")


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Қайрат", "қайрат"),
        ("ӘБІЛҚАСЫМОВ", "әбілқасымов"),
        ("Ғалым Үсенов Һәм Ңұрлан Өтеген", "ғалым үсенов һәм ңұрлан өтеген"),
        ("ТОО «Алатау Құрылыс Сервис»", "тоо «алатау құрылыс сервис»"),
        ("Укладка ламината 18 500 ₸", "укладка ламината 18 500 ₸"),
        ("KZ75998KZT", "kz75998kzt"),
        ("", ""),
    ],
)
def test_search_key_keeps_kazakh_letters_and_only_lower_cases(text: str, expected: str) -> None:
    assert search_key(text) == expected


@pytest.mark.parametrize("text", ["Ёлкина", "Қайрат Әбілқасымов", "ТОО «Алатау»", "KZ75998KZT", "Plinth 18 500 ₸"])
def test_search_key_equals_javascript_to_lower_case_for_our_alphabets(text: str) -> None:
    assert search_key(text) == text.lower().replace("ё", "е")


# ---------------------------------------------------------------- amount in words


@pytest.mark.parametrize(
    ("tiyn", "expected"),
    [
        (1, "Ноль тенге 01 тиын"),
        (2, "Ноль тенге 02 тиына"),
        (4, "Ноль тенге 04 тиына"),
        (5, "Ноль тенге 05 тиынов"),
        (11, "Ноль тенге 11 тиынов"),
        (20, "Ноль тенге 20 тиынов"),
        (21, "Ноль тенге 21 тиын"),
        (23, "Ноль тенге 23 тиына"),
        (25, "Ноль тенге 25 тиынов"),
        (101, "Один тенге 01 тиын"),
        (0, "Ноль тенге 00 тиын"),
        (10000, "Сто тенге 00 тиын"),
        (1_200_000, "Двенадцать тысяч тенге 00 тиын"),
        (11_100_000, "Сто одиннадцать тысяч тенге 00 тиын"),
        (110_000_000, "Один миллион сто тысяч тенге 00 тиын"),
        (100_000_100, "Один миллион один тенге 00 тиын"),
        (200_000_200, "Два миллиона два тенге 00 тиын"),
        (2_100_000_000, "Двадцать один миллион тенге 00 тиын"),
        (100_000_000_000, "Один миллиард тенге 00 тиын"),
        (100_002_000, "Один миллион двадцать тенге 00 тиын"),
        (300_000_000, "Три миллиона тенге 00 тиын"),
        (2_200_000, "Двадцать две тысячи тенге 00 тиын"),
        (1_000_000_000_000, "Десять миллиардов тенге 00 тиын"),
        (32_393_000, "Триста двадцать три тысячи девятьсот тридцать тенге 00 тиын"),
    ],
)
def test_amount_in_words(tiyn: int, expected: str) -> None:
    assert amount_in_words(tiyn) == expected


def test_amount_in_words_starts_with_a_capital_and_tenge_never_changes() -> None:
    text = amount_in_words(32_393_000)
    assert text[0] == text[0].upper()
    assert " тенге " in text


@pytest.mark.parametrize("bad", [-1, 1.5, True, "100"])
def test_amount_in_words_refuses_negative_and_non_integer(bad: object) -> None:
    with pytest.raises(ValueError):
        amount_in_words(bad)  # type: ignore[arg-type]


# ---------------------------------------------------------------- dates


def test_today_is_the_day_in_the_company_zone_not_in_utc() -> None:
    assert today_in_zone("Asia/Almaty", datetime(2026, 10, 20, 18, 59, 59, tzinfo=UTC)) == "2026-10-20"
    assert today_in_zone("Asia/Almaty", datetime(2026, 10, 20, 19, 0, 0, tzinfo=UTC)) == "2026-10-21"


def test_almaty_is_utc_plus_five_since_2024() -> None:
    # An old tzdata still gave +6; this fails if the installed tzdata is stale.
    assert today_in_zone("Asia/Almaty", datetime(2026, 1, 1, 19, 0, 0, tzinfo=UTC)) == "2026-01-02"


def test_today_needs_an_aware_timestamp() -> None:
    with pytest.raises(ValueError):
        today_in_zone("Asia/Almaty", datetime(2026, 10, 20, 12, 0, 0))


def test_today_defaults_to_now() -> None:
    assert is_iso_date(today_in_zone())


def test_is_iso_date_accepts_real_days_only() -> None:
    assert is_iso_date("2028-02-29")
    for bad in ["2026-02-30", "2026-13-01", "20.10.2026", "", None, 20261020, "2026-10-20\n", "２０２６-10-20"]:
        assert not is_iso_date(bad), bad


def test_add_days_across_a_month_and_a_year() -> None:
    assert add_days("2026-10-20", 14) == "2026-11-03"
    assert add_days("2026-12-25", 14) == "2027-01-08"
    assert add_days("2026-03-01", -1) == "2026-02-28"


@pytest.mark.parametrize(
    ("start", "end", "days"),
    [
        ("2026-10-20", "2026-10-23", 3),
        ("2026-10-20", "2026-11-19", 30),
        ("2026-12-25", "2027-01-08", 14),
        ("2026-10-20", "2026-10-20", 0),
        ("2026-10-20", "2026-10-19", -1),
    ],
)
def test_days_between(start: str, end: str, days: int) -> None:
    assert days_between(start, end) == days


def test_days_between_is_the_inverse_of_add_days() -> None:
    for days in (0, 3, 7, 14, 30, 365):
        assert days_between("2026-10-20", add_days("2026-10-20", days)) == days


def test_dates_refuse_text_that_is_not_a_date() -> None:
    with pytest.raises(ValueError):
        days_between("20.10.2026", "2026-10-21")
    with pytest.raises(ValueError):
        days_between("2026-10-20", "soon")
    with pytest.raises(ValueError):
        add_days("2026-02-30", 1)


# ---------------------------------------------------------------- payment state


@pytest.mark.parametrize(
    ("gross", "paid", "due", "state", "balance"),
    [
        (100_000, 0, "2026-11-01", "unpaid", 100_000),
        (100_000, 0, None, "unpaid", 100_000),
        (100_000, 40_000, "2026-11-01", "partial", 60_000),
        (100_000, 100_000, "2026-11-01", "paid", 0),
        (100_000, 100_000, "2026-10-01", "paid", 0),  # paid beats overdue
        (100_000, 0, "2026-10-13", "overdue", 100_000),
        (100_000, 40_000, "2026-10-13", "overdue", 60_000),  # overdue beats partial
        (100_000, 0, "2026-10-20", "unpaid", 100_000),  # due today is not yet overdue
    ],
)
def test_payment_state(gross: int, paid: int, due: str | None, state: str, balance: int) -> None:
    summary = payment_summary(gross, paid, due, "2026-10-20")
    assert (summary.state, summary.paid_tiyn, summary.balance_tiyn) == (state, paid, balance)
    assert payment_state(gross, paid, due, "2026-10-20") == state


def test_payment_state_uses_the_company_day_for_overdue() -> None:
    due = "2026-10-20"
    late_evening_utc = datetime(2026, 10, 20, 19, 30, tzinfo=UTC)  # already 21.10 in Almaty
    assert payment_state(100, 0, due, today_in_zone("Asia/Almaty", late_evening_utc)) == "overdue"
    assert payment_state(100, 0, due, late_evening_utc.date().isoformat()) == "unpaid"


def test_overpayment() -> None:
    assert not is_overpayment(1000, 400, 600)
    assert is_overpayment(1000, 400, 601)


def test_quote_expiry_is_derived_from_valid_until() -> None:
    assert not is_quote_expired("sent", "2026-10-20", "2026-10-20")
    assert is_quote_expired("sent", "2026-10-10", "2026-10-20")
    assert not is_quote_expired("signed", "2026-10-10", "2026-10-20")
    assert not is_quote_expired("sent", None, "2026-10-20")


# ---------------------------------------------------------------- share token


def test_share_tokens_are_256_bit_url_safe_and_unique() -> None:
    tokens = {new_share_token() for _ in range(50)}
    assert len(tokens) == 50
    for token in tokens:
        assert len(token) == 43
        assert is_well_formed_token(token)


@pytest.mark.parametrize("bad", ["", "short", "a" * 44, "a" * 42 + "!", "a" * 42 + "\n", None, 5])
def test_malformed_tokens_are_rejected(bad: object) -> None:
    assert not is_well_formed_token(bad)


def test_tokens_compare_exactly() -> None:
    token = new_share_token()
    assert tokens_equal(token, token)
    assert not tokens_equal(token, new_share_token())


def test_share_url_has_one_slash() -> None:
    assert share_url("http://192.168.1.10:5173/", "abc") == "http://192.168.1.10:5173/p/abc"
    assert share_url("http://localhost:5173", "abc") == "http://localhost:5173/p/abc"
