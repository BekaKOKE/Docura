from typing import Any
from uuid import UUID

from pydantic import ConfigDict, StrictBool, StrictInt

from app.repositories.records import Company
from app.schemas.base import CamelModel


class CompanyOut(CamelModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    legal_form: str
    legal_name: str
    bin_iin: str
    address: str
    phone: str | None
    email: str | None
    director_name: str
    director_position: str
    vat_payer: bool
    vat_certificate: str | None
    bank_name: str | None
    iik: str | None
    bik: str | None
    kbe: str | None
    default_knp: str | None
    timezone: str
    quote_validity_days: int
    invoice_due_days: int
    currency: str
    has_logo: bool

    @classmethod
    def from_record(cls, company: Company) -> "CompanyOut":
        return cls.model_validate({**vars(company), "has_logo": company.logo is not None})


class CompanyPatch(CamelModel):
    """The fields of a company, all optional. What was really sent is `sent()`.

    The text fields a company needs still take null, so that it reaches their rule and its message, as in the mock
    (`app/domain/company.py`). Numbers and the VAT flag are strict: lax parsing would read "1" as true.
    """

    legal_form: str | None = None
    legal_name: str | None = None
    bin_iin: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    director_name: str | None = None
    director_position: str | None = None
    vat_payer: StrictBool = False
    vat_certificate: str | None = None
    bank_name: str | None = None
    iik: str | None = None
    bik: str | None = None
    kbe: str | None = None
    default_knp: str | None = None
    timezone: str = "Asia/Almaty"
    quote_validity_days: StrictInt = 14
    invoice_due_days: StrictInt = 5

    def sent(self) -> dict[str, Any]:
        """Only what the client sent, by field name."""
        return self.model_dump(exclude_unset=True)


class CompanyInput(CompanyPatch):
    """What creating needs is checked by `company_problems`, for its messages; the docs still say which fields."""

    model_config = ConfigDict(
        json_schema_extra={
            "required": ["legalForm", "legalName", "binIin", "address", "directorName", "directorPosition", "vatPayer"]
        }
    )
