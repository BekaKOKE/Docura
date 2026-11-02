"""What routes depend on: the storage, the signed-in user, the membership check and the rate limiter."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer

from app.config import Settings
from app.errors import ApiError
from app.rate_limit import RateLimiter
from app.repositories.base import Storage
from app.repositories.records import User
from app.security import read_access_token
from app.services import auth as auth_service

# The OAuth2 form is what gives Swagger its Authorize dialog. On the wire it is the contract's bearer token.
_bearer_token = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_storage(request: Request) -> Storage:
    return request.app.state.storage


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_auth_rate_limiter(request: Request) -> RateLimiter:
    return request.app.state.auth_rate_limiter


StorageDep = Annotated[Storage, Depends(get_storage)]
SettingsDep = Annotated[Settings, Depends(get_app_settings)]
AuthRateLimiterDep = Annotated[RateLimiter, Depends(get_auth_rate_limiter)]


def unauthorized() -> HTTPException:
    """A 401 in the error format (`app.errors`), with the header HTTP asks of one."""
    return HTTPException(status_code=401, headers={"WWW-Authenticate": "Bearer"})


def get_current_user(
    storage: StorageDep, settings: SettingsDep, token: Annotated[str | None, Depends(_bearer_token)]
) -> User:
    user_id = read_access_token(token, settings.jwt_secret) if token else None
    user = auth_service.get_user(storage, user_id) if user_id else None
    if user is None:
        raise unauthorized()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def parse_id(value: str) -> UUID:
    """A path id. One that isn't a UUID can't exist, so it is a 404 like any unknown id, never a 422."""
    try:
        return UUID(value)
    except ValueError:
        raise ApiError("not_found") from None


def require_member(cid: str, user: CurrentUser, storage: StorageDep) -> UUID:
    """The company of a `/api/companies/{cid}/...` route. Every such route takes this, and gets a 404 for a company the
    user isn't in, the same as for one that doesn't exist. In the MVP a member is the owner."""
    company_id = parse_id(cid)
    with storage.unit_of_work() as uow:
        membership = uow.memberships.get(company_id, user.id)
    if membership is None:
        raise ApiError("not_found")
    return company_id


MemberCompanyId = Annotated[UUID, Depends(require_member)]
