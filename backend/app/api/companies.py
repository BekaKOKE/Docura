from fastapi import APIRouter

from app.api.deps import CurrentUser, MemberCompanyId, StorageDep
from app.schemas.company import CompanyInput, CompanyOut, CompanyPatch
from app.services import companies as company_service

router = APIRouter()


@router.post("/companies", operation_id="companyCreate", response_model=CompanyOut, status_code=201)
def create_company(data: CompanyInput, user: CurrentUser, storage: StorageDep) -> CompanyOut:
    return CompanyOut.from_record(company_service.create_company(storage, user, data.sent()))


@router.get("/companies/{cid}", operation_id="companyGet", response_model=CompanyOut)
def get_company(company_id: MemberCompanyId, storage: StorageDep) -> CompanyOut:
    return CompanyOut.from_record(company_service.get_company(storage, company_id))


@router.patch("/companies/{cid}", operation_id="companyUpdate", response_model=CompanyOut)
def update_company(company_id: MemberCompanyId, data: CompanyPatch, storage: StorageDep) -> CompanyOut:
    return CompanyOut.from_record(company_service.update_company(storage, company_id, data.sent()))
