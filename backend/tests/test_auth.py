"""#39: register, login, /me, the rate limit, argon2id and the token."""

from datetime import UTC, datetime, timedelta

import jwt
import pytest
from api_helpers import assert_error, bearer
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.errors import DEFAULT_MESSAGES
from app.main import create_app
from app.rate_limit import MAX_KEYS, MAX_KEYS_PER_GROUP, RateLimiter

EMAIL = "aliya@example.kz"
PASSWORD = "Тест-Пароль-2026"
NAME = "Әлия Сейткали"
REGISTRATION = {"email": EMAIL, "password": PASSWORD, "fullName": NAME}


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def register(client: TestClient, **changes: str):
    return client.post("/api/auth/register", json={**REGISTRATION, **changes})


def json_login(client: TestClient, email: str = EMAIL, password: str = PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def form_login(client: TestClient, username: str = EMAIL, password: str = PASSWORD):
    return client.post("/api/auth/login", data={"username": username, "password": password, "grant_type": "password"})


class TestRegister:
    def test_returns_a_token_and_the_user_with_kazakh_letters_intact(self, client: TestClient) -> None:
        """TC-1."""
        response = register(client)
        assert response.status_code == 201
        body = response.json()
        assert set(body) == {"accessToken", "user"}
        assert set(body["user"]) == {"id", "email", "fullName", "locale"}
        assert body["user"]["fullName"] == NAME
        assert body["user"]["email"] == EMAIL
        assert body["user"]["locale"] == "ru"

    def test_me_returns_the_user_and_no_companies(self, client: TestClient) -> None:
        """TC-1."""
        session = register(client).json()
        response = client.get("/api/me", headers=bearer(session["accessToken"]))
        assert response.status_code == 200
        assert response.json() == {"user": session["user"], "companies": []}

    def test_a_taken_email_is_a_validation_error_on_email(self, client: TestClient) -> None:
        """TC-1, as the contract words it: never a 409."""
        register(client)
        error = assert_error(register(client), 422, "validation_error")
        assert error["fields"] == {"email": "Эта почта уже зарегистрирована."}

    def test_a_taken_email_ignores_case_and_spaces(self, client: TestClient) -> None:
        register(client)
        error = assert_error(register(client, email="  ALIYA@Example.KZ "), 422, "validation_error")
        assert set(error["fields"]) == {"email"}

    def test_the_email_is_stored_normalised(self, client: TestClient) -> None:
        assert register(client, email=" ALIYA@Example.KZ ").json()["user"]["email"] == EMAIL

    def test_the_name_is_trimmed(self, client: TestClient) -> None:
        assert register(client, fullName=f"  {NAME} ").json()["user"]["fullName"] == NAME

    @pytest.mark.parametrize(
        ("changes", "field", "message"),
        [
            ({"email": "not-an-email"}, "email", "Введите почту в формате name@example.kz."),
            ({"email": "a@b"}, "email", "Введите почту в формате name@example.kz."),
            ({"email": "a b@example.kz"}, "email", "Введите почту в формате name@example.kz."),
            ({"email": f"{'a' * 250}@example.kz"}, "email", "Не больше 254 символов."),
            ({"password": "1234567"}, "password", "Пароль не короче 8 символов."),
            ({"fullName": "   "}, "fullName", "Введите имя."),
            ({"fullName": "а" * 201}, "fullName", "Не больше 200 символов."),
        ],
    )
    def test_bad_input_names_the_field(self, client: TestClient, changes: dict, field: str, message: str) -> None:
        error = assert_error(register(client, **changes), 422, "validation_error")
        assert error["fields"] == {field: message}

    def test_a_password_of_eight_characters_is_enough(self, client: TestClient) -> None:
        assert register(client, password="12345678").status_code == 201

    def test_missing_fields_are_named_in_camel_case(self, client: TestClient) -> None:
        error = assert_error(client.post("/api/auth/register", json={}), 422, "validation_error")
        assert set(error["fields"]) == {"email", "password", "fullName"}


class TestLogin:
    def test_json_returns_exactly_the_session(self, client: TestClient) -> None:
        """TC-2."""
        user = register(client).json()["user"]
        response = json_login(client)
        assert response.status_code == 200
        body = response.json()
        assert set(body) == {"accessToken", "user"}
        assert body["user"] == user
        assert client.get("/api/me", headers=bearer(body["accessToken"])).status_code == 200

    def test_a_form_returns_the_session_and_what_oauth2_clients_read(self, client: TestClient) -> None:
        """TC-2."""
        user = register(client).json()["user"]
        response = form_login(client)
        assert response.status_code == 200
        body = response.json()
        assert set(body) == {"accessToken", "user", "access_token", "token_type"}
        assert body["user"] == user
        assert body["access_token"] == body["accessToken"]
        assert body["token_type"] == "bearer"
        assert client.get("/api/me", headers=bearer(body["access_token"])).status_code == 200

    def test_the_email_ignores_case_and_spaces(self, client: TestClient) -> None:
        register(client)
        assert json_login(client, f" {EMAIL.upper()} ").status_code == 200

    def test_a_login_records_when(self, app: FastAPI, client: TestClient) -> None:
        register(client)
        with app.state.storage.unit_of_work() as uow:
            assert uow.users.get_by_email(EMAIL).last_login_at is None
        json_login(client)
        with app.state.storage.unit_of_work() as uow:
            assert uow.users.get_by_email(EMAIL).last_login_at is not None

    @pytest.mark.parametrize("login", [json_login, form_login])
    def test_a_wrong_password_is_unauthorized(self, client: TestClient, login) -> None:
        """TC-3."""
        register(client)
        response = login(client, EMAIL, "wrong-password")
        assert assert_error(response, 401, "unauthorized")["fields"] == {}

    def test_an_unknown_email_gets_the_same_answer_as_a_wrong_password(self, client: TestClient) -> None:
        register(client)
        wrong = json_login(client, EMAIL, "wrong-password")
        unknown = json_login(client, "nobody@example.kz", "wrong-password")
        assert unknown.status_code == wrong.status_code == 401
        assert unknown.json() == wrong.json()

    def test_missing_json_fields_are_named(self, client: TestClient) -> None:
        response = client.post("/api/auth/login", json={"email": EMAIL})
        assert set(assert_error(response, 422, "validation_error")["fields"]) == {"password"}

    def test_missing_form_fields_are_named(self, client: TestClient) -> None:
        response = client.post("/api/auth/login", data={"password": PASSWORD})
        assert set(assert_error(response, 422, "validation_error")["fields"]) == {"username"}

    def test_a_body_that_is_not_json_is_a_validation_error(self, client: TestClient) -> None:
        response = client.post("/api/auth/login", content=b"{nope", headers={"content-type": "application/json"})
        assert_error(response, 422, "validation_error")

    def test_a_json_body_that_is_not_an_object_is_a_validation_error(self, client: TestClient) -> None:
        assert_error(client.post("/api/auth/login", json=["x"]), 422, "validation_error")

    def test_the_docs_offer_the_password_form_for_authorize(self, client: TestClient) -> None:
        """TC-2: what Swagger's Authorize dialog is built from."""
        spec = client.get("/openapi.json").json()
        schemes = spec["components"]["securitySchemes"]
        assert [scheme["flows"]["password"]["tokenUrl"] for scheme in schemes.values()] == ["/api/auth/login"]
        login_body = spec["paths"]["/api/auth/login"]["post"]["requestBody"]["content"]
        assert set(login_body) == {"application/json", "application/x-www-form-urlencoded"}


def signed(secret: str, user_id: str, algorithm: str = "HS256", **claims: object) -> str:
    now = datetime.now(UTC)
    return jwt.encode({"sub": user_id, "iat": now, "exp": now + timedelta(hours=1), **claims}, secret, algorithm)


class TestToken:
    def test_an_expired_token_is_unauthorized(self, app: FastAPI, client: TestClient) -> None:
        """TC-3: exp 1 s in the past, signed with JWT_SECRET."""
        user_id = register(client).json()["user"]["id"]
        expired = signed(app.state.settings.jwt_secret, user_id, exp=datetime.now(UTC) - timedelta(seconds=1))
        assert_error(client.get("/api/me", headers=bearer(expired)), 401, "unauthorized")

    def test_a_token_that_is_still_valid_passes(self, app: FastAPI, client: TestClient) -> None:
        user_id = register(client).json()["user"]["id"]
        token = signed(app.state.settings.jwt_secret, user_id)
        assert client.get("/api/me", headers=bearer(token)).status_code == 200

    def test_garbage_is_unauthorized(self, client: TestClient) -> None:
        """TC-3."""
        error = assert_error(client.get("/api/me", headers=bearer("abc")), 401, "unauthorized")
        assert error["fields"] == {}

    def test_no_header_is_unauthorized(self, client: TestClient) -> None:
        """TC-3."""
        response = client.get("/api/me")
        assert_error(response, 401, "unauthorized")
        assert response.headers["www-authenticate"] == "Bearer"

    def test_another_secret_is_unauthorized(self, client: TestClient) -> None:
        user_id = register(client).json()["user"]["id"]
        assert_error(client.get("/api/me", headers=bearer(signed("x" * 40, user_id))), 401, "unauthorized")

    def test_an_unsigned_token_is_unauthorized(self, client: TestClient) -> None:
        user_id = register(client).json()["user"]["id"]
        assert_error(client.get("/api/me", headers=bearer(signed("", user_id, "none"))), 401, "unauthorized")

    @pytest.mark.filterwarnings("ignore::jwt.warnings.InsecureKeyLengthWarning")
    def test_another_algorithm_is_unauthorized(self, app: FastAPI, client: TestClient) -> None:
        user_id = register(client).json()["user"]["id"]
        token = signed(app.state.settings.jwt_secret, user_id, "HS512")
        assert_error(client.get("/api/me", headers=bearer(token)), 401, "unauthorized")

    @pytest.mark.parametrize("missing", ["sub", "iat", "exp"])
    def test_a_token_without_a_claim_is_unauthorized(self, app: FastAPI, client: TestClient, missing: str) -> None:
        user_id = register(client).json()["user"]["id"]
        now = datetime.now(UTC)
        claims = {"sub": user_id, "iat": now, "exp": now + timedelta(hours=1)}
        del claims[missing]
        token = jwt.encode(claims, app.state.settings.jwt_secret, "HS256")
        assert_error(client.get("/api/me", headers=bearer(token)), 401, "unauthorized")

    def test_a_token_for_nobody_is_unauthorized(self, app: FastAPI, client: TestClient) -> None:
        token = signed(app.state.settings.jwt_secret, "00000000-0000-4000-8000-000000000000")
        assert_error(client.get("/api/me", headers=bearer(token)), 401, "unauthorized")

    def test_a_subject_that_is_not_an_id_is_unauthorized(self, app: FastAPI, client: TestClient) -> None:
        token = signed(app.state.settings.jwt_secret, "not-a-uuid")
        assert_error(client.get("/api/me", headers=bearer(token)), 401, "unauthorized")

    def test_the_token_is_hs256_for_twelve_hours(self, app: FastAPI, client: TestClient) -> None:
        """TC-5."""
        session = register(client).json()
        token = session["accessToken"]
        assert jwt.get_unverified_header(token)["alg"] == "HS256"
        claims = jwt.decode(token, app.state.settings.jwt_secret, algorithms=["HS256"])
        assert claims["exp"] - claims["iat"] == 43200
        assert claims["sub"] == session["user"]["id"]


def test_only_an_argon2id_hash_is_stored(app: FastAPI, client: TestClient) -> None:
    """TC-5."""
    register(client)
    with app.state.storage.unit_of_work() as uow:
        user = uow.users.get_by_email(EMAIL)
    assert user.password_hash.startswith("$argon2id$")
    assert PASSWORD not in repr(user)


class TestRateLimit:
    @pytest.fixture
    def clock(self, app: FastAPI) -> FakeClock:
        clock = FakeClock()
        app.state.auth_rate_limiter = RateLimiter(clock=clock)
        return clock

    def tries(self, client: TestClient, count: int, email: str = EMAIL) -> list[int]:
        return [json_login(client, email, "wrong-password").status_code for _ in range(count)]

    def test_the_sixth_login_is_refused_even_with_the_right_password(
        self, client: TestClient, clock: FakeClock
    ) -> None:
        """TC-4: 5 wrong + 1 right."""
        register(client)
        assert self.tries(client, 5) == [401] * 5
        error = assert_error(json_login(client), 429, "rate_limited")
        assert error["message"] == DEFAULT_MESSAGES["rate_limited"]

    def test_another_email_from_the_same_ip_is_not_limited(self, client: TestClient, clock: FakeClock) -> None:
        """TC-4."""
        self.tries(client, 6)
        assert self.tries(client, 1, "other@example.kz") == [401]

    def test_after_the_minute_login_works(self, client: TestClient, clock: FakeClock) -> None:
        """TC-4."""
        register(client)
        self.tries(client, 6)
        clock.now += 60
        assert json_login(client).status_code == 200

    def test_a_successful_login_does_not_clear_the_count(self, client: TestClient, clock: FakeClock) -> None:
        """Every attempt counts (AC 2, and the 429 in the contract)."""
        register(client)
        assert [json_login(client).status_code for _ in range(6)] == [200] * 5 + [429]

    def test_json_and_form_count_together(self, client: TestClient, clock: FakeClock) -> None:
        self.tries(client, 5)
        assert_error(form_login(client), 429, "rate_limited")

    def test_case_and_spaces_do_not_make_a_new_count(self, client: TestClient, clock: FakeClock) -> None:
        self.tries(client, 5)
        assert self.tries(client, 1, f" {EMAIL.upper()} ") == [429]

    def test_another_ip_has_its_own_count(self, app: FastAPI, client: TestClient, clock: FakeClock) -> None:
        self.tries(client, 6)
        with TestClient(app, client=("203.0.113.9", 50000)) as other:
            assert self.tries(other, 1) == [401]

    def test_the_sixth_registration_is_refused(self, client: TestClient, clock: FakeClock) -> None:
        statuses = [register(client, password="short").status_code for _ in range(6)]
        assert statuses == [422] * 5 + [429]

    def test_login_and_register_count_apart(self, client: TestClient, clock: FakeClock) -> None:
        for _ in range(5):
            register(client, password="short")
        assert self.tries(client, 1) == [401]
        self.tries(client, 5)
        assert register(client, password="12345678").status_code == 429
        assert register(client, email="new@example.kz").status_code == 201

    def test_each_app_has_its_own_limiter(self, app: FastAPI) -> None:
        assert create_app(Settings(_env_file=None)).state.auth_rate_limiter is not app.state.auth_rate_limiter


class TestFloodCannotResetACount:
    """#39 FAIL on AC 2: 10 050 junk registrations from the attacker's IP pushed its login count out of the limiter,
    and the sixth login, 32 s after the first, got a token. The caps are small here so the test stays fast; the
    sequence is QA's."""

    MAX_KEYS = 50
    PER_IP = 10

    @pytest.fixture
    def clock(self, app: FastAPI) -> FakeClock:
        clock = FakeClock()
        app.state.auth_rate_limiter = RateLimiter(clock=clock, max_keys=self.MAX_KEYS, max_keys_per_group=self.PER_IP)
        return clock

    def junk_registrations(self, client: TestClient, count: int) -> list[int]:
        body = {"password": "x", "fullName": ""}
        return [client.post("/api/auth/register", json={**body, "email": f"junk{n}"}).status_code for n in range(count)]

    def junk_logins(self, client: TestClient, count: int) -> list[int]:
        return [json_login(client, f"junk{n}@example.kz", "x").status_code for n in range(count)]

    @pytest.mark.parametrize("flood", ["junk_registrations", "junk_logins"])
    def test_the_sixth_login_after_a_flood_is_still_refused(
        self, client: TestClient, clock: FakeClock, flood: str
    ) -> None:
        register(client)
        assert [json_login(client, EMAIL, "wrong-password").status_code for _ in range(5)] == [401] * 5
        statuses = getattr(self, flood)(client, self.MAX_KEYS + 50)
        assert 429 in statuses
        assert statuses.count(429) >= self.MAX_KEYS + 50 - self.PER_IP
        clock.now += 32
        assert_error(json_login(client), 429, "rate_limited")

    def test_a_key_with_three_tries_survives_a_flood(self, client: TestClient, clock: FakeClock) -> None:
        register(client)
        for _ in range(3):
            json_login(client, EMAIL, "wrong-password")
        self.junk_registrations(client, self.MAX_KEYS + 50)
        assert [json_login(client).status_code for _ in range(3)] == [200, 200, 429]

    def test_the_flood_does_not_lock_out_another_ip(self, app: FastAPI, client: TestClient, clock: FakeClock) -> None:
        register(client)
        self.junk_registrations(client, self.MAX_KEYS + 50)
        with TestClient(app, client=("203.0.113.9", 50000)) as other:
            assert json_login(other).status_code == 200

    def test_the_flooding_ip_gets_new_keys_again_after_the_minute(self, client: TestClient, clock: FakeClock) -> None:
        register(client)
        self.junk_registrations(client, self.PER_IP + 1)
        assert_error(json_login(client), 429, "rate_limited")
        clock.now += 60
        assert json_login(client).status_code == 200

    def test_ipv6_addresses_of_one_slash_64_share_the_cap(
        self, app: FastAPI, client: TestClient, clock: FakeClock
    ) -> None:
        for number in range(self.PER_IP):
            with TestClient(app, client=(f"2001:db8::{number + 1:x}", 50000)) as host:
                json_login(host, f"junk{number}@example.kz", "x")
        with TestClient(app, client=("2001:db8::ffff", 50000)) as host:
            assert_error(json_login(host, "new@example.kz", "x"), 429, "rate_limited")
        with TestClient(app, client=("2001:db8:0:1::1", 50000)) as other:
            assert json_login(other, "new@example.kz", "x").status_code == 401

    def test_the_default_limiter_caps_each_ip(self, app: FastAPI) -> None:
        limiter = app.state.auth_rate_limiter
        assert limiter._max_keys_per_group == MAX_KEYS_PER_GROUP < limiter._max_keys == MAX_KEYS
