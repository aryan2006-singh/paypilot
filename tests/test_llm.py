from __future__ import annotations

import pytest

from app.agents.base import AgentResult
from app.services.llm import ReplyWriter, WriteResult, build_messages
from app.services.store import StoredTurn
from tests.conftest import make_settings


class FakeStream:
    def __init__(self, chunks, stop_reason="end_turn", fail_after=None):
        self.chunks, self.stop_reason, self.fail_after = chunks, stop_reason, fail_after

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    @property
    def text_stream(self):
        async def gen():
            for i, c in enumerate(self.chunks):
                if self.fail_after is not None and i == self.fail_after:
                    raise RuntimeError("connection dropped")
                yield c
        return gen()

    async def get_final_message(self):
        return type("Msg", (), {"stop_reason": self.stop_reason})()


class FakeClient:
    def __init__(self, stream):
        self.calls = []
        outer = self

        class Messages:
            def stream(self, **kwargs):
                outer.calls.append(kwargs)
                return stream

        self.beta = type("Beta", (), {"messages": Messages()})()

    async def close(self):
        pass


def writer_with(tmp_path, stream) -> tuple[ReplyWriter, FakeClient]:
    w = ReplyWriter(make_settings(tmp_path))
    fake = FakeClient(stream)
    w._client = fake
    return w, fake


RESULT = AgentResult(agent_id="payments", entity_id="pay_1", tool_name="get_payment_status",
                     tool_result={"status": "captured", "amount": 100, "mock": True},
                     fallback_reply="Draft answer.")


async def collect(writer, history=()):
    out = WriteResult(text="", llm_used=False)
    chunks = [c async for c in writer.stream("status of pay_1", "payments", RESULT, list(history), out)]
    return chunks, out


@pytest.mark.asyncio
async def test_llm_tokens_are_streamed(tmp_path):
    w, fake = writer_with(tmp_path, FakeStream(["Payment ", "captured."]))
    chunks, out = await collect(w)
    assert chunks == ["Payment ", "captured."]
    assert out.text == "Payment captured." and out.llm_used is True
    call = fake.calls[0]
    assert call["model"] == "claude-opus-5-5"
    assert call["fallbacks"] == "default"
    assert "pay_1" in call["messages"][-1]["content"]


@pytest.mark.asyncio
async def test_llm_failure_before_output_uses_draft(tmp_path):
    w, _ = writer_with(tmp_path, FakeStream(["x"], fail_after=0))
    _, out = await collect(w)
    assert out.text == "Draft answer." and out.llm_used is False


@pytest.mark.asyncio
async def test_refusal_uses_draft(tmp_path):
    w, _ = writer_with(tmp_path, FakeStream([], stop_reason="refusal"))
    _, out = await collect(w)
    assert out.text == "Draft answer." and out.llm_used is False


@pytest.mark.asyncio
async def test_llm_failure_mid_stream_appends_draft(tmp_path):
    w, _ = writer_with(tmp_path, FakeStream(["Partial ", "more"], fail_after=1))
    _, out = await collect(w)
    assert out.text.startswith("Partial ") and out.text.endswith("Draft answer.")


def test_build_messages_alternates_and_starts_with_user():
    history = [
        StoredTurn("assistant", "orphan", None, None),
        StoredTurn("user", "q1", None, None),
        StoredTurn("assistant", "a1", "payments", "pay_1"),
        StoredTurn("user", "unanswered", None, None),
    ]
    msgs = build_messages(history, "NOW")
    assert [m["role"] for m in msgs] == ["user", "assistant", "user"]
    assert msgs[0]["content"] == "q1" and msgs[-1]["content"] == "NOW"


def test_llm_disabled_without_key(tmp_path):
    assert ReplyWriter(make_settings(tmp_path)).enabled is False
    assert ReplyWriter(make_settings(tmp_path, anthropic_api_key="sk-test")).enabled is True
