"""What the API tests share: signing up, and reading an error."""

from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from fastapi.testclient import TestClient
from httpx import Response

PASSWORD = "Тест-Пароль-2026"


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def assert_error(response: Response, status: int, code: str) -> dict[str, Any]:
    """The response is this error, in the one error format. Returns the inside of it."""
    assert response.status_code == status, response.text
    payload = response.json()
    assert set(payload) == {"error"}
    assert set(payload["error"]) == {"code", "message", "fields"}
    assert payload["error"]["code"] == code
    assert isinstance(payload["error"]["message"], str) and payload["error"]["message"]
    return payload["error"]


@dataclass(frozen=True)
class Account:
    user_id: str
    email: str
    token: str

    @property
    def headers(self) -> dict[str, str]:
        return bearer(self.token)


def sign_up(client: TestClient, email: str | None = None) -> Account:
    """A new user with no company."""
    email = email or f"{uuid4()}@example.kz"
    response = client.post("/api/auth/register", json={"email": email, "password": PASSWORD, "fullName": "Әлия"})
    assert response.status_code == 201, response.text
    session = response.json()
    return Account(session["user"]["id"], email, session["accessToken"])
