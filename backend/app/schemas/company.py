from uuid import UUID

from pydantic import ConfigDict

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
