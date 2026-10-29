"""Errors the domain raises. The service layer maps `code` to an `app.errors.ApiError`; the domain itself knows
nothing about HTTP, FastAPI or storage."""


class DomainError(Exception):
    """A business rule was broken. `code` is one of the API error codes (frontend/src/services/errors.ts)."""

    code: str = "validation_error"

    def __init__(self, message: str, code: str | None = None) -> None:
        super().__init__(message)
        if code is not None:
            self.code = code


class InvalidTransition(DomainError):
    """The status change is not one the MVP allows. The API answers 409 `document_locked`."""

    code = "document_locked"
