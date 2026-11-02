import pytest

from app.domain.company import clean_text, cleaned_company_values, company_problems

GOOD = {
    "legal_form": "ip",
    "legal_name": "ИП Сейткали Б.",
    "bin_iin": "850312300121",
    "address": "г. Алматы",
    "director_name": "Сейткали Бекзат",
    "director_position": "ИП",
    "vat_payer": True,
}


def test_good_values_have_no_problems() -> None:
    assert company_problems(GOOD, require_all=True) == {}


def test_creating_needs_the_fields_of_the_contract() -> None:
    assert company_problems({}, require_all=True) == {
        "legal_name": "Укажите название компании.",
        "address": "Укажите адрес.",
        "director_name": "Укажите ФИО директора.",
        "director_position": "Укажите должность.",
        "bin_iin": "Введите ИИН или БИН",
        "legal_form": "Выберите форму: ИП, ТОО, АО или другая.",
        "vat_payer": "Обязательное поле",
    }


def test_a_patch_checks_only_what_it_has() -> None:
    assert company_problems({}, require_all=False) == {}
    assert company_problems({"vat_payer": False}, require_all=False) == {}


@pytest.mark.parametrize("empty", ["", "   ", None])
def test_a_required_field_cannot_be_emptied(empty: str | None) -> None:
    assert company_problems({"legal_name": empty}, require_all=False) == {"legal_name": "Укажите название компании."}


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("bin_iin", "850312300122", "ИИН или БИН указан неверно: проверьте цифры"),
        ("bin_iin", "85031230012", "ИИН и БИН состоят из 12 цифр"),
        ("bin_iin", "85031230012A", "ИИН и БИН состоят только из цифр"),
        ("iik", "KZ76998KZT1001300335", "ИИК указан неверно: проверьте символы"),
        ("iik", "KZ75998KZT100130033", "ИИК состоит из 20 символов"),
        ("bik", "DCRAKZK", "БИК состоит из 8 латинских букв и цифр."),
        ("kbe", "1", "Кбе состоит из 2 цифр"),
        ("default_knp", "85", "КНП состоит из 3 цифр"),
        ("phone", "12345", "Телефон начинается с +7 и содержит 10 цифр, например +7 701 123 45 67."),
        ("legal_form", "llc", "Выберите форму: ИП, ТОО, АО или другая."),
        ("quote_validity_days", 0, "Срок действия: целое число дней от 1 до 365."),
        ("quote_validity_days", 366, "Срок действия: целое число дней от 1 до 365."),
        ("invoice_due_days", -1, "Срок оплаты: целое число дней от 0 до 365."),
        ("invoice_due_days", 366, "Срок оплаты: целое число дней от 0 до 365."),
        ("timezone", "+05:00", "Укажите часовой пояс по названию IANA, например Asia/Almaty."),
        ("timezone", "Etc/GMT-5", "Укажите часовой пояс по названию IANA, например Asia/Almaty."),
        ("timezone", "Mars/Olympus", "Укажите часовой пояс по названию IANA, например Asia/Almaty."),
        ("legal_name", "а" * 301, "Не больше 300 символов."),
        ("email", "а" * 255, "Не больше 254 символов."),
        ("director_name", "а" * 201, "Не больше 200 символов."),
        ("director_position", "а" * 201, "Не больше 200 символов."),
        ("vat_certificate", "а" * 101, "Не больше 100 символов."),
        ("bank_name", "а" * 201, "Не больше 200 символов."),
    ],
)
def test_a_bad_value_gets_its_message(field: str, value: object, message: str) -> None:
    assert company_problems({field: value}, require_all=False) == {field: message}


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("bin_iin", "850312 300121"),
        ("iik", "kz75 998K ZT10 0130 0335"),
        ("bik", "dcrakzka"),
        ("kbe", "17"),
        ("default_knp", "859"),
        ("phone", "8 (701) 123-45-67"),
        ("quote_validity_days", 1),
        ("quote_validity_days", 365),
        ("invoice_due_days", 0),
        ("invoice_due_days", 365),
        ("timezone", "Asia/Almaty"),
        ("legal_name", "а" * 300),
    ],
)
def test_a_good_value_passes(field: str, value: object) -> None:
    assert company_problems({field: value}, require_all=False) == {}


@pytest.mark.parametrize("field", ["phone", "bank_name", "iik", "bik", "kbe", "default_knp"])
@pytest.mark.parametrize("empty", ["", "  ", None])
def test_an_optional_field_may_be_empty_and_is_stored_as_none(field: str, empty: str | None) -> None:
    assert company_problems({field: empty}, require_all=False) == {}
    assert cleaned_company_values({field: empty}) == {field: None}


def test_values_are_cleaned_for_storage() -> None:
    cleaned = cleaned_company_values(
        {
            "legal_name": "  ТОО «Алатау Құрылыс»  ",
            "bin_iin": "850312 300121",
            "iik": "kz75 998K ZT10 0130 0335",
            "phone": "8 (701) 123-45-67",
            "email": "  ",
            "vat_payer": False,
        }
    )
    assert cleaned == {
        "legal_name": "ТОО «Алатау Құрылыс»",
        "bin_iin": "850312300121",
        "iik": "KZ75998KZT1001300335",
        "phone": "+7 701 123 45 67",
        "email": None,
        "vat_payer": False,
    }


def test_clean_text_reads_none_as_empty() -> None:
    assert clean_text("legal_name", None) == ""
