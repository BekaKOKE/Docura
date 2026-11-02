"""Creating and changing the company. Every read and write goes through the repositories with its `company_id`."""

from dataclasses import replace
from typing import Any
from uuid import UUID

from pydantic.alias_generators import to_camel

from app.domain.company import COMPANY_EXISTS, cleaned_company_values, company_problems
from app.domain.logo import detect_logo_type, logo_problem
from app.errors import ApiError
from app.repositories.base import Storage, UnitOfWork
from app.repositories.records import Company, Membership, User


def _checked(values: dict[str, Any], *, require_all: bool) -> dict[str, Any]:
    problems = company_problems(values, require_all=require_all)
    if problems:
        raise ApiError("validation_error", fields={to_camel(field): text for field, text in problems.items()})
    return cleaned_company_values(values)


def _existing(uow: UnitOfWork, company_id: UUID) -> Company:
    company = uow.companies.get(company_id)
    if company is None:
        raise ApiError("not_found")
    return company


def create_company(storage: Storage, user: User, values: dict[str, Any]) -> Company:
    """The company and the owner's membership, together. One company per account in the MVP."""
    company = Company(**_checked(values, require_all=True))
    with storage.unit_of_work() as uow:
        if uow.users.list_memberships(user.id):
            raise ApiError("validation_error", COMPANY_EXISTS)
        created = uow.companies.add(company.id, company)
        uow.memberships.add(company.id, Membership(company_id=company.id, user_id=user.id, role="owner"))
    return created


def get_company(storage: Storage, company_id: UUID) -> Company:
    with storage.unit_of_work() as uow:
        return _existing(uow, company_id)


def update_company(storage: Storage, company_id: UUID, values: dict[str, Any]) -> Company:
    changes = _checked(values, require_all=False)
    with storage.unit_of_work() as uow:
        return uow.companies.update(company_id, replace(_existing(uow, company_id), **changes))


def set_logo(storage: Storage, company_id: UUID, content: bytes) -> None:
    problem = logo_problem(content)
    if problem:
        raise ApiError("validation_error", fields={"logo": problem})
    with storage.unit_of_work() as uow:
        company = _existing(uow, company_id)
        uow.companies.update(company_id, replace(company, logo=content, logo_mime=detect_logo_type(content)))


def get_logo(storage: Storage, company_id: UUID) -> tuple[bytes, str]:
    """The logo and its type. A company without one is a 404."""
    company = get_company(storage, company_id)
    if company.logo is None or company.logo_mime is None:
        raise ApiError("not_found")
    return company.logo, company.logo_mime
