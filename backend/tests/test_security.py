from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt

from app.security import create_access_token, hash_password, read_access_token, verify_password

SECRET = "x" * 40


def test_a_hash_is_argon2id_and_checks_the_password() -> None:
    hashed = hash_password("Тест-Пароль-2026")
    assert hashed.startswith("$argon2id$")
    assert verify_password("Тест-Пароль-2026", hashed)
    assert not verify_password("Тест-Пароль-2027", hashed)


def test_the_same_password_hashes_differently() -> None:
    assert hash_password("password") != hash_password("password")


def test_a_token_reads_back_its_user() -> None:
    user_id = uuid4()
    assert read_access_token(create_access_token(user_id, SECRET), SECRET) == user_id


def test_a_token_lasts_twelve_hours() -> None:
    user_id = uuid4()
    almost = datetime.now(UTC) - timedelta(hours=11, minutes=59)
    over = datetime.now(UTC) - timedelta(hours=12, seconds=1)
    assert read_access_token(create_access_token(user_id, SECRET, now=almost), SECRET) == user_id
    assert read_access_token(create_access_token(user_id, SECRET, now=over), SECRET) is None


def test_bad_tokens_read_as_nobody() -> None:
    assert read_access_token("abc", SECRET) is None
    assert read_access_token(create_access_token(uuid4(), "y" * 40), SECRET) is None
    assert read_access_token(jwt.encode({"sub": "1"}, SECRET, "HS256"), SECRET) is None
