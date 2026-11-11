"""One error shape for the whole API.

Every non-2xx response body looks like::

    {"detail": "human readable message", "code": "machine_code", "request_id": "..."}

``detail`` is always a string, which is what the frontend displays.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import request_id_var

log = logging.getLogger("paypilot.errors")

_STATUS_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    422: "validation_error",
    429: "rate_limited",
    500: "internal_error",
    502: "upstream_error",
    503: "unavailable",
}


class AppError(Exception):
    """Raise from anywhere to return a clean error response."""

    def __init__(self, status_code: int, detail: str, code: str | None = None,
                 headers: dict[str, str] | None = None):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
        self.code = code or _STATUS_CODES.get(status_code, "error")
        self.headers = headers


def error_body(status_code: int, detail: str, code: str | None = None) -> dict:
    return {
        "detail": detail,
        "code": code or _STATUS_CODES.get(status_code, "error"),
        "request_id": request_id_var.get(),
    }


def _json(status_code: int, detail: str, code: str | None = None,
          headers: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(error_body(status_code, detail, code), status_code=status_code, headers=headers)


def _validation_detail(exc: RequestValidationError) -> str:
    parts = []
    for err in exc.errors():
        loc = ".".join(str(p) for p in err.get("loc", ()) if p != "body")
        parts.append(f"{loc}: {err.get('msg')}" if loc else str(err.get("msg")))
    return "; ".join(parts) or "Invalid request"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return _json(exc.status_code, exc.detail, exc.code, exc.headers)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        return _json(exc.status_code, detail, headers=getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        return _json(422, _validation_detail(exc))

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        log.exception("unhandled error", exc_info=exc)
        return _json(500, "Something went wrong on our side. Please try again.")
