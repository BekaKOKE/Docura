"""Passwords (argon2id through pwdlib) and bearer tokens (JWT HS256, valid for 12 hours)."""

from datetime import UTC, datetime, timedelta
from functools import lru_cache
from uuid import UUID

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

TOKEN_ALGORITHM = "HS256"
TOKEN_LIFETIME = timedelta(hours=12)

_passwords = PasswordHash((Argon2Hasher(),))


def hash_password(password: str) -> str:
    return _passwords.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _passwords.verify(password, password_hash)


@lru_cache
def _hash_of_nothing() -> str:
    return hash_password("no such user")


def verify_password_of_nobody(password: str) -> None:
    """Spend the time a real check takes, so a login can't tell by its speed whether the email has an account."""
    verify_password(password, _hash_of_nothing())


def create_access_token(user_id: UUID, secret: str, *, now: datetime | None = None) -> str:
    issued_at = now or datetime.now(UTC)
    claims = {"sub": str(user_id), "iat": issued_at, "exp": issued_at + TOKEN_LIFETIME}
    return jwt.encode(claims, secret, algorithm=TOKEN_ALGORITHM)


def read_access_token(token: str, secret: str) -> UUID | None:
    """The user the token is for, or None when it is malformed, forged or expired."""
    try:
        claims = jwt.decode(token, secret, algorithms=[TOKEN_ALGORITHM], options={"require": ["sub", "iat", "exp"]})
        return UUID(claims["sub"])
    except (jwt.InvalidTokenError, ValueError):
        return None
