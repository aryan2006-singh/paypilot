"""Reply writer: Claude when ANTHROPIC_API_KEY is set, the agent's draft otherwise.

The agents do the deterministic work (routing, tool calls, policy lookup) so
the facts are always the same. Claude only turns those facts into a clear
answer that fits the conversation, streamed token by token. If the LLM is
off, refuses or errors before saying anything, the agent's own draft reply is
streamed instead, so a chat never fails because of the LLM.
"""
from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass

from app.agents.base import AgentResult
from app.core.config import Settings
from app.services.store import StoredTurn

log = logging.getLogger("paypilot.llm")

SYSTEM_PROMPT = """You are PayPilot, an operations assistant for a merchant that takes payments through Razorpay. \
Your readers are the merchant's support and finance staff.

Each user turn includes the specialist agent that handled it, the result of the payment tool it called, \
relevant passages from the merchant's policy documents, and a draft answer. Write the final answer from those facts.

- Use only the facts given. Never invent ids, amounts, dates or statuses. If something isn't in the facts, say you don't have it.
- Amounts in tool results are in paise; show them in rupees (₹), with Indian digit grouping.
- Lead with the answer, then the one or two details that matter, then a concrete next step when there is one.
- Keep it short: a few sentences or a brief list. Use light Markdown (bold for key values, lists for several items).
- If the tool result says mock is true, add one short line noting it is demo data.
- If the tool returned an error (for example error_code not_found), say so plainly and never guess what the data might be. If no id was given, ask for it in one sentence.
- Use earlier turns only to understand follow-up questions."""


@dataclass
class WriteResult:
    text: str
    llm_used: bool


def build_user_turn(message: str, intent: str, result: AgentResult) -> str:
    facts = {
        "agent": result.agent_id,
        "intent": intent,
        "entity_id": result.entity_id,
        "tool": result.tool_name,
        "tool_result": result.tool_result,
    }
    policy = "\n---\n".join(result.policy_passages) or "(none)"
    return (
        f"<question>\n{message}\n</question>\n\n"
        f"<facts>\n{json.dumps(facts, indent=2, default=str)}\n</facts>\n\n"
        f"<policy>\n{policy}\n</policy>\n\n"
        f"<draft_answer>\n{result.fallback_reply}\n</draft_answer>"
    )


def build_messages(history: list[StoredTurn], user_turn: str) -> list[dict]:
    msgs: list[dict] = []
    for turn in history:
        if not msgs and turn.role != "user":
            continue  # the API needs the first message to be from the user
        if msgs and msgs[-1]["role"] == turn.role:
            msgs[-1]["content"] += "\n\n" + turn.content
        else:
            msgs.append({"role": turn.role, "content": turn.content})
    if msgs and msgs[-1]["role"] == "user":
        msgs.pop()  # an unanswered user turn (e.g. a failed request) would break alternation
    msgs.append({"role": "user", "content": user_turn})
    return msgs


class ReplyWriter:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.model = settings.llm_model
        self._client = None
        if settings.llm_configured:
            from anthropic import AsyncAnthropic  # imported lazily: optional at runtime

            self._client = AsyncAnthropic(
                api_key=settings.anthropic_api_key,
                timeout=settings.llm_timeout_s,
                max_retries=2,
            )

    @property
    def enabled(self) -> bool:
        return self._client is not None

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.close()

    async def stream(self, message: str, intent: str, result: AgentResult,
                     history: list[StoredTurn], out: WriteResult) -> AsyncIterator[str]:
        """Yield reply text chunks. ``out`` is filled in with the full text and
        whether the LLM produced it."""
        if self.enabled:
            emitted = False
            try:
                async for chunk in self._stream_llm(message, intent, result, history):
                    emitted = True
                    out.text += chunk
                    yield chunk
                out.llm_used = True
                return
            except Exception as exc:  # noqa: BLE001 - any LLM failure falls back to the draft
                log.warning("llm reply failed, using draft", extra={"error": f"{type(exc).__name__}: {exc}"})
                if emitted:
                    # Part of the answer is already on screen; finish it honestly.
                    tail = "\n\n_(The AI reply was interrupted. Details from the agent:)_\n\n" + result.fallback_reply
                    out.text += tail
                    out.llm_used = True
                    yield tail
                    return

        async for chunk in self._stream_template(result.fallback_reply):
            out.text += chunk
            yield chunk
        out.llm_used = False

    async def _stream_llm(self, message: str, intent: str, result: AgentResult,
                          history: list[StoredTurn]) -> AsyncIterator[str]:
        assert self._client is not None
        async with self._client.beta.messages.stream(
            model=self.model,
            max_tokens=self.settings.llm_max_tokens,
            system=SYSTEM_PROMPT,
            messages=build_messages(history, build_user_turn(message, intent, result)),
            output_config={"effort": self.settings.llm_effort},
            # On a safety decline the API retries on a fallback model in the same call.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        ) as stream:
            async for text in stream.text_stream:
                if text:
                    yield text
            final = await stream.get_final_message()
        if final.stop_reason == "refusal":
            raise RuntimeError("model declined to answer")

    async def _stream_template(self, text: str) -> AsyncIterator[str]:
        delay = self.settings.template_token_delay_s
        words = text.split(" ")
        for i, word in enumerate(words):
            yield word if i == 0 else " " + word
            if delay:
                await asyncio.sleep(delay)
