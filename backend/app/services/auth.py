"""Sign-up, sign-in and who am I. Passwords are hashed and checked outside the unit of work: that is slow on purpose,
and a unit of work shouldn't wait for it."""

from dataclasses import replace
from uuid import UUID

from app.domain.account import EMAIL_TAKEN, normalize_email, registration_problems
from app.errors import ApiError
from app.repositories.base import Storage, UniqueViolationError
from app.repositories.records import User, utc_now
from app.schemas.auth import Me, RegisterInput, UserOut
from app.schemas.company import CompanyOut
from app.security import hash_password, verify_password, verify_password_of_nobody


def register(storage: Storage, data: RegisterInput) -> User:
    email = normalize_email(data.email)
    full_name = data.full_name.strip()
    fields = registration_problems(email, data.password, full_name)
    if fields:
        raise ApiError("validation_error", fields=fields)
    user = User(email=email, password_hash=hash_password(data.password), full_name=full_name)
    try:
        with storage.unit_of_work() as uow:
            return uow.users.add(user)
    except UniqueViolationError:
        raise ApiError("validation_error", fields={"email": EMAIL_TAKEN}) from None


def authenticate(storage: Storage, email: str, password: str) -> User | None:
    with storage.unit_of_work() as uow:
        user = uow.users.get_by_email(normalize_email(email))
    if user is None:
        verify_password_of_nobody(password)
        return None
    if not verify_password(password, user.password_hash):
        return None
    with storage.unit_of_work() as uow:
        return uow.users.update(replace(user, last_login_at=utc_now()))


def get_user(storage: Storage, user_id: UUID) -> User | None:
    with storage.unit_of_work() as uow:
        return uow.users.get(user_id)


def describe_me(storage: Storage, user: User) -> Me:
    with storage.unit_of_work() as uow:
        companies = [uow.companies.get(row.company_id) for row in uow.users.list_memberships(user.id)]
    return Me(
        user=UserOut.from_record(user),
        companies=[CompanyOut.from_record(company) for company in companies if company is not None],
    )
