from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.deps import chat_access, get_orchestrator
from app.core.security import Principal
from app.schemas import ChatRequest, ChatResponse
from app.services.orchestrator import ChatOrchestrator

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    principal: Principal = Depends(chat_access),
    orchestrator: ChatOrchestrator = Depends(get_orchestrator),
) -> ChatResponse:
    """Answer one message. Pass the returned ``session_id`` back for follow-ups."""
    conversation_id = await orchestrator.prepare(req.message, req.session_id, principal)
    return ChatResponse(**await orchestrator.run(req.message, conversation_id))


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, default=str)}\n\n"


@router.post("/chat/stream")
async def chat_stream(
    req: ChatRequest,
    principal: Principal = Depends(chat_access),
    orchestrator: ChatOrchestrator = Depends(get_orchestrator),
):
    """Server-sent events for one chat turn. Each event is a JSON object with a ``type``:

    - ``step``  ``{id, label, status: running|done|error, detail?}``: agent progress
    - ``meta``  ``{agent_used, intent, entity_id, session_id}``: routing result
    - ``token`` ``{text}``: reply chunk
    - ``done``  ``{response: ChatResponse}``: final payload
    - ``error`` ``{message, code}``: the run failed
    """
    conversation_id = await orchestrator.prepare(req.message, req.session_id, principal)

    async def events():
        async for event in orchestrator.stream(req.message, conversation_id):
            if event["type"] == "done":
                event = {"type": "done", "response": ChatResponse(**event["response"]).model_dump()}
            yield _sse(event)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        # Stops proxies (nginx, Render's edge) from buffering the whole stream.
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
