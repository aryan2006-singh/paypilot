"""Read-only lists of recent Razorpay payments and settlements (live mode only).

The UI uses these to offer real ids to ask about. Demo mode returns 503 with
code ``razorpay_not_configured`` rather than inventing a list.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import read_access
from app.core.errors import AppError
from app.integrations.razorpay import RazorpayClient, RazorpayError
from app.schemas import PaymentSummary, SettlementSummary

router = APIRouter(prefix="/api", tags=["razorpay"], dependencies=[Depends(read_access)])

_UPSTREAM_STATUS = {"auth_failed": 502, "rate_limited": 429, "upstream_unavailable": 502, "bad_request": 502}


def _client(request: Request) -> RazorpayClient:
    client: RazorpayClient = request.app.state.razorpay
    if not client.configured:
        raise AppError(503, "Razorpay keys are not configured, so there is no live data to list "
                            "(the assistant is running in demo mode).", code="razorpay_not_configured")
    return client


def _raise(exc: RazorpayError) -> None:
    raise AppError(_UPSTREAM_STATUS.get(exc.code, 502), exc.message, code=f"razorpay_{exc.code}") from exc


@router.get("/payments", response_model=list[PaymentSummary])
async def recent_payments(request: Request, limit: int = Query(10, ge=1, le=100)):
    try:
        items = await _client(request).list_payments(limit)
    except RazorpayError as exc:
        _raise(exc)
    return [PaymentSummary.model_validate(i) for i in items]


@router.get("/settlements", response_model=list[SettlementSummary])
async def recent_settlements(request: Request, limit: int = Query(10, ge=1, le=100)):
    try:
        items = await _client(request).list_settlements(limit)
    except RazorpayError as exc:
        _raise(exc)
    return [SettlementSummary.model_validate(i) for i in items]
