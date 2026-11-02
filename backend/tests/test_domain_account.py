import pytest

from app.domain.account import normalize_email, registration_problems


def test_normalize_email_trims_and_lowers() -> None:
    assert normalize_email("  ALIYA@Example.KZ ") == "aliya@example.kz"


def test_good_input_has_no_problems() -> None:
    assert registration_problems("aliya@example.kz", "12345678", "Әлия") == {}


@pytest.mark.parametrize(
    "email", ["", "a", "a@b", "@example.kz", "a@.", "a b@example.kz", "a@b@example.kz", "a@example.kz\n"]
)
def test_bad_emails(email: str) -> None:
    assert set(registration_problems(email, "12345678", "Әлия")) == {"email"}


def test_every_problem_is_reported_at_once() -> None:
    assert set(registration_problems("x", "1", "")) == {"email", "password", "fullName"}
