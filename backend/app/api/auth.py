from typing import Annotated, Any, NamedTuple

from fastapi import APIRouter, Depends, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError

from app.api.deps import AuthRateLimiterDep, CurrentUser, SettingsDep, StorageDep, unauthorized
from app.config import Settings
from app.domain.account import MAX_EMAIL_LENGTH, normalize_email
from app.errors import ApiError
from app.rate_limit import RateLimiter
from app.repositories.records import User
from app.schemas.auth import AuthSession, LoginForm, LoginInput, Me, RegisterInput, UserOut
from app.security import create_access_token
from app.services import auth as auth_service

router = APIRouter()

_FORM_TYPE = "application/x-www-form-urlencoded"
_LOGIN_BODY = {
    "requestBody": {
        "required": True,
        "content": {
            "application/json": {"schema": LoginInput.model_json_schema(by_alias=True)},
            _FORM_TYPE: {"schema": LoginForm.model_json_schema(by_alias=True)},
        },
    }
}


class _Credentials(NamedTuple):
    email: str
    password: str
    from_form: bool


def _parse(model: type[BaseModel], data: Any) -> Any:
    try:
        return model.model_validate(data)
    except ValidationError as error:
        raise RequestValidationError(error.errors()) from None


async def _login_credentials(request: Request) -> _Credentials:
    """JSON from the app, or the form from Swagger. FastAPI can't declare both on one route, so it is read here."""
    if request.headers.get("content-type", "").split(";")[0].strip().lower() == _FORM_TYPE:
        form = _parse(LoginForm, dict(await request.form()))
        return _Credentials(form.username, form.password, True)
    try:
        body = await request.json()
    except ValueError:
        raise RequestValidationError([{"type": "json_invalid", "loc": ("body",), "msg": "Некорректный JSON"}]) from None
    login_input = _parse(LoginInput, body)
    return _Credentials(login_input.email, login_input.password, False)


def _check_rate(rate_limiter: RateLimiter, route: str, request: Request, email: str) -> None:
    """5 tries a minute per IP and email, counted apart for each route."""
    host = request.client.host if request.client else "unknown"
    if not rate_limiter.allow((route, host, normalize_email(email)[:MAX_EMAIL_LENGTH])):
        raise ApiError("rate_limited")


def _session(user: User, settings: Settings) -> AuthSession:
    return AuthSession(access_token=create_access_token(user.id, settings.jwt_secret), user=UserOut.from_record(user))


@router.post("/auth/register", operation_id="authRegister", response_model=AuthSession, status_code=201)
def register(
    data: RegisterInput,
    request: Request,
    storage: StorageDep,
    settings: SettingsDep,
    rate_limiter: AuthRateLimiterDep,
) -> AuthSession:
    _check_rate(rate_limiter, "register", request, data.email)
    return _session(auth_service.register(storage, data), settings)


@router.post("/auth/login", operation_id="authLogin", response_model=AuthSession, openapi_extra=_LOGIN_BODY)
def login(
    credentials: Annotated[_Credentials, Depends(_login_credentials)],
    request: Request,
    storage: StorageDep,
    settings: SettingsDep,
    rate_limiter: AuthRateLimiterDep,
) -> AuthSession | JSONResponse:
    _check_rate(rate_limiter, "login", request, credentials.email)
    user = auth_service.authenticate(storage, credentials.email, credentials.password)
    if user is None:
        raise unauthorized()
    session = _session(user, settings)
    if credentials.from_form:
        return JSONResponse(session.to_wire() | {"access_token": session.access_token, "token_type": "bearer"})
    return session


@router.get("/me", operation_id="authMe", response_model=Me)
def me(user: CurrentUser, storage: StorageDep) -> Me:
    return auth_service.describe_me(storage, user)
