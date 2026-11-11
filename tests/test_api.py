from __future__ import annotations

import json


def sse_events(text: str) -> list[dict]:
    return [json.loads(block[len("data: "):]) for block in text.strip().split("\n\n") if block.startswith("data: ")]


def test_health_and_info(client):
    assert client.get("/health").json() == {"status": "ok"}
    info = client.get("/api/info").json()
    assert info["name"] == "PayPilot"
    assert info["razorpay_mode"] == "demo"
    assert info["llm_enabled"] is False
    assert info["auth_required"] is False
    ready = client.get("/api/health")
    assert ready.status_code == 200 and ready.json()["checks"]["database"] is True


def test_every_response_has_request_id_and_security_headers(client):
    r = client.get("/api/agents", headers={"X-Request-ID": "trace-123"})
    assert r.headers["x-request-id"] == "trace-123"
    assert r.headers["x-content-type-options"] == "nosniff"


def test_agents_list(client):
    agents = client.get("/api/agents").json()
    assert [a["id"] for a in agents] == ["payments", "refunds", "reconciliation", "fraud", "general"]
    assert all(a["description"] and a["example"] for a in agents)
    assert agents[0]["tools"] == ["get_payment_status"]


def test_chat_returns_full_response(client):
    r = client.post("/chat", json={"message": "Why did payment pay_ABC999 fail?"})
    assert r.status_code == 200
    body = r.json()
    assert body["agent_used"] == "payments"
    assert body["entity_id"] == "pay_ABC999"
    assert body["tool_result"]["mock"] is True
    assert body["session_id"].startswith("conv_")
    assert body["message_id"].startswith("msg_")
    assert body["llm_used"] is False
    assert "pay_ABC999" in body["reply"]
    assert body["policy_context"]


def test_follow_up_uses_conversation_memory(client):
    first = client.post("/chat", json={"message": "status of pay_Mem0ry1"}).json()
    sid = first["session_id"]
    follow = client.post("/chat", json={"message": "and has it been refunded?", "session_id": sid}).json()
    assert follow["agent_used"] == "refunds"
    assert follow["entity_id"] == "pay_Mem0ry1"
    risky = client.post("/chat", json={"message": "is it risky?", "session_id": sid}).json()
    assert risky["agent_used"] == "fraud"
    assert risky["tool_result"]["risk_level"] in {"low", "medium", "high"}


def test_missing_id_asks_for_it(client):
    body = client.post("/chat", json={"message": "Why did my payment fail?"}).json()
    assert body["agent_used"] == "payments"
    assert body["tool_result"] is None
    assert "pay_" in body["reply"]


def test_conversations_crud(client):
    sid = client.post("/chat", json={"message": "Does settlement stl_44 match our ledger?"}).json()["session_id"]
    listing = client.get("/api/conversations").json()
    assert listing[0]["id"] == sid
    assert listing[0]["message_count"] == 2
    assert listing[0]["last_agent"] == "reconciliation"

    detail = client.get(f"/api/conversations/{sid}").json()
    roles = [m["role"] for m in detail["messages"]]
    assert roles == ["user", "assistant"]
    assert detail["messages"][1]["tool_result"]["reconciliation"] in {
        "matched", "mismatch", "pending", "missing_in_ledger"}

    assert client.delete(f"/api/conversations/{sid}").status_code == 204
    missing = client.get(f"/api/conversations/{sid}")
    assert missing.status_code == 404
    assert missing.json()["code"] == "not_found"


def test_stream_event_sequence(client):
    r = client.post("/chat/stream", json={"message": "This transaction pay_ABC123 looks suspicious"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/event-stream")
    events = sse_events(r.text)
    types = [e["type"] for e in events]
    assert types[0] == "step" and types[-1] == "done"
    assert "meta" in types and "token" in types
    meta = next(e for e in events if e["type"] == "meta")
    assert meta["agent_used"] == "fraud" and meta["session_id"]
    reply = "".join(e["text"] for e in events if e["type"] == "token")
    done = events[-1]["response"]
    assert done["reply"] == reply
    assert done["agent_used"] == "fraud"
    steps = [e for e in events if e["type"] == "step"]
    assert all(s["status"] in {"running", "done"} for s in steps)


def test_stats_and_activity(client):
    client.post("/chat", json={"message": "Where is my refund for pay_ABC123?"})
    client.post("/chat", json={"message": "What are your business hours?"})
    stats = client.get("/api/stats").json()
    assert stats["total"] == 2
    assert stats["by_agent"]["refunds"] == 1 and stats["by_agent"]["general"] == 1
    assert stats["mock_count"] == 1
    assert stats["conversations"] == 2
    activity = client.get("/api/activity?limit=5").json()
    assert [a["agent_used"] for a in activity] == ["general", "refunds"]
    assert activity[1]["message"] == "Where is my refund for pay_ABC123?"


def test_config(client):
    cfg = client.get("/api/config").json()
    assert cfg["razorpay_configured"] is False
    assert cfg["intents"] == ["payments", "refunds", "reconciliation", "fraud", "general"]
    assert cfg["rag_index_ready"] == {"payments": True, "refunds": True, "reconciliation": True, "general": True}
    assert cfg["llm_configured"] is False


def test_validation_errors_use_error_shape(client):
    r = client.post("/chat", json={"message": "   "})
    assert r.status_code == 422
    body = r.json()
    assert body["code"] == "validation_error" and isinstance(body["detail"], str) and body["request_id"]
    assert client.post("/chat", json={"message": "hi", "session_id": "../etc"}).status_code == 422


def test_payments_list_needs_live_keys(client):
    r = client.get("/api/payments")
    assert r.status_code == 503
    assert r.json()["code"] == "razorpay_not_configured"


def test_spa_fallback_without_build(client):
    assert client.get("/").json()["status"] == "api-only"
