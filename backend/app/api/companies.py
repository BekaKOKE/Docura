from typing import Annotated

from fastapi import APIRouter, File, Response, UploadFile

from app.api.deps import CurrentUser, MemberCompanyId, StorageDep
from app.domain.logo import LOGO_MAX_BYTES
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


@router.put("/companies/{cid}/logo", operation_id="companyUploadLogo", status_code=204)
def upload_logo(company_id: MemberCompanyId, file: Annotated[UploadFile, File()], storage: StorageDep) -> Response:
    # One byte past the limit is enough to know it is too big.
    company_service.set_logo(storage, company_id, file.file.read(LOGO_MAX_BYTES + 1))
    return Response(status_code=204)


@router.get(
    "/companies/{cid}/logo",
    operation_id="companyGetLogo",
    response_class=Response,
    responses={200: {"content": {"image/png": {}, "image/jpeg": {}}}},
)
def get_logo(company_id: MemberCompanyId, storage: StorageDep) -> Response:
    content, media_type = company_service.get_logo(storage, company_id)
    return Response(content, media_type=media_type, headers={"X-Content-Type-Options": "nosniff"})
