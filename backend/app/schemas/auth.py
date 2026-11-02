from uuid import UUID

from pydantic import ConfigDict

from app.repositories.records import User
from app.schemas.base import CamelModel
from app.schemas.company import CompanyOut


class RegisterInput(CamelModel):
    email: str
    password: str
    full_name: str


class LoginInput(CamelModel):
    email: str
    password: str


class LoginForm(CamelModel):
    """The OAuth2 password form that Swagger's Authorize sends: the email goes in `username`."""

    username: str
    password: str


class UserOut(CamelModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str
    locale: str

    @classmethod
    def from_record(cls, user: User) -> "UserOut":
        return cls.model_validate(user)


class AuthSession(CamelModel):
    access_token: str
    user: UserOut


class Me(CamelModel):
    user: UserOut
    companies: list[CompanyOut]
