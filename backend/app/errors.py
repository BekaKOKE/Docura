"""One error format for the whole API: `{"error": {"code", "message", "fields"}}`.

`ApiError` is what domain and service code raises; the handlers turn it, HTTP errors (404, 405 ...) and request
validation errors into that body. The codes and statuses are the ones in `frontend/src/services/errors.ts`.
"""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic.alias_generators import to_camel
from starlette.exceptions import HTTPException as StarletteHTTPException

API_ERROR_STATUS: dict[str, int] = {
    "validation_error": 422,
    "unauthorized": 401,
    "not_found": 404,
    "version_conflict": 409,
    "document_locked": 409,
    "exceeds_quote_total": 409,
    "overpayment": 409,
    "already_signed": 409,
    "link_expired": 410,
    "link_revoked": 410,
    "rate_limited": 429,
}

DEFAULT_MESSAGES: dict[str, str] = {
    "validation_error": "Проверьте введённые данные",
    "unauthorized": "Войдите в аккаунт",
    "not_found": "Не найдено",
    "version_conflict": "Документ изменился: обновите страницу",
    "document_locked": "Документ нельзя изменить",
    "exceeds_quote_total": "Сумма счетов не может быть больше суммы КП",
    "overpayment": "Оплата больше суммы счёта",
    "already_signed": "Документ уже подписан",
    "link_expired": "Срок действия ссылки истёк",
    "link_revoked": "Ссылка отозвана",
    "rate_limited": "Слишком много запросов: подождите минуту",
}

# Status codes raised by the framework itself (unknown route, wrong method ...) and the code they get.
# Any other status gets the code "http_error".
_STATUS_CODES: dict[int, str] = {
    401: "unauthorized",
    404: "not_found",
    422: "validation_error",
    429: "rate_limited",
}
# Where a parameter lives; it is not part of the field name the client knows.
_LOCATIONS = {"body", "query", "path", "header", "cookie"}


class ApiError(Exception):
    """A business or protocol error with a stable `code`. The status defaults to the usual one for the code."""

    def __init__(
        self,
        code: str,
        message: str | None = None,
        *,
        status: int | None = None,
        fields: dict[str, str] | None = None,
    ) -> None:
        if code not in API_ERROR_STATUS:
            raise ValueError(f"unknown API error code: {code}")
        self.code = code
        self.status = status if status is not None else API_ERROR_STATUS[code]
        self.message = message if message is not None else DEFAULT_MESSAGES[code]
        self.fields = fields or {}
        super().__init__(self.message)


def error_body(code: str, message: str, fields: dict[str, str] | None = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "fields": fields or {}}}


def _field_name(location: tuple[Any, ...]) -> str:
    """The path of the field the client sent: body, lines, 0, qty_milli -> lines.0.qtyMilli."""
    parts = list(location)
    if parts and parts[0] in _LOCATIONS:
        parts = parts[1:]
    return ".".join(to_camel(p) if isinstance(p, str) and "_" in p else str(p) for p in parts)


def _field_message(error: dict[str, Any]) -> str:
    if error.get("type") == "missing":
        return "Обязательное поле"
    return str(error.get("msg", DEFAULT_MESSAGES["validation_error"]))


def _json(status: int, code: str, message: str, fields: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(status_code=status, content=error_body(code, message, fields))


async def _api_error_handler(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ApiError)
    return _json(exc.status, exc.code, exc.message, exc.fields)


async def _http_error_handler(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    code = _STATUS_CODES.get(exc.status_code, "http_error")
    message = DEFAULT_MESSAGES.get(code) or str(exc.detail)
    response = _json(exc.status_code, code, message)
    if exc.headers:
        response.headers.update(exc.headers)
    return response


async def _validation_error_handler(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    fields: dict[str, str] = {}
    for error in exc.errors():
        fields.setdefault(_field_name(error["loc"]), _field_message(error))
    return _json(422, "validation_error", DEFAULT_MESSAGES["validation_error"], fields)


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, _api_error_handler)
    app.add_exception_handler(StarletteHTTPException, _http_error_handler)
    app.add_exception_handler(RequestValidationError, _validation_error_handler)
