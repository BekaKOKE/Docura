"""The rules of an account. Mirror of `frontend/src/services/mock/auth.ts`, with the same Russian messages."""

import re

MIN_PASSWORD_LENGTH = 8
MAX_EMAIL_LENGTH = 254  # users.email
MAX_FULL_NAME_LENGTH = 200  # users.full_name

EMAIL_TAKEN = "Эта почта уже зарегистрирована."

_EMAIL = re.compile(r"[^\s@]+@[^\s@]+\.[^\s@]+")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def too_long(limit: int) -> str:
    return f"Не больше {limit} символов."


def registration_problems(email: str, password: str, full_name: str) -> dict[str, str]:
    """A message per wrong field, by the name the client knows. Takes the normalised email and the trimmed name."""
    fields: dict[str, str] = {}
    if _EMAIL.fullmatch(email) is None:
        fields["email"] = "Введите почту в формате name@example.kz."
    elif len(email) > MAX_EMAIL_LENGTH:
        fields["email"] = too_long(MAX_EMAIL_LENGTH)
    if len(password) < MIN_PASSWORD_LENGTH:
        fields["password"] = "Пароль не короче 8 символов."
    if full_name == "":
        fields["fullName"] = "Введите имя."
    elif len(full_name) > MAX_FULL_NAME_LENGTH:
        fields["fullName"] = too_long(MAX_FULL_NAME_LENGTH)
    return fields
