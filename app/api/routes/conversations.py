from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query, Response

from app.api.deps import get_store, read_access
from app.core.errors import AppError
from app.core.security import Principal
from app.schemas import ConversationDetail, ConversationSummary
from app.services.store import Store

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

ConversationId = Path(..., pattern=r"^[A-Za-z0-9_-]{1,64}$")


@router.get("", response_model=list[ConversationSummary])
async def list_conversations(
    limit: int = Query(20, ge=1, le=100),
    principal: Principal = Depends(read_access),
    store: Store = Depends(get_store),
):
    """The caller's conversations, most recently active first."""
    return await store.list_conversations(principal.id, limit)


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str = ConversationId,
    principal: Principal = Depends(read_access),
    store: Store = Depends(get_store),
):
    conversation = await store.get_conversation(conversation_id, principal.id)
    if conversation is None:
        raise AppError(404, "Conversation not found")
    return conversation


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: str = ConversationId,
    principal: Principal = Depends(read_access),
    store: Store = Depends(get_store),
):
    if not await store.delete_conversation(conversation_id, principal.id):
        raise AppError(404, "Conversation not found")
    return Response(status_code=204)
