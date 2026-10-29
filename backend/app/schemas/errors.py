from pydantic import Field

from app.schemas.base import CamelModel


class ErrorBody(CamelModel):
    code: str
    message: str
    fields: dict[str, str] = Field(default_factory=dict)


class ErrorResponse(CamelModel):
    """Every error response: `{"error": {"code", "message", "fields"}}`."""

    error: ErrorBody
