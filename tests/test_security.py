from __future__ import annotations

import pytest

from app.core.config import Settings
from app.core.security import Security


def test_auth_required_endpoints(make_client):
    c = make_client(paypilot_api_keys="k-one,k-two")
    assert c.get("/api/auth/status").json() == {"auth_required": True}
    assert c.get("/health").status_code == 200
    assert c.get("/api/info").status_code == 200
    assert c.get("/api/agents").status_code == 200

    r = c.post("/chat", json={"message": "hi"})
    assert r.status_code == 401
    assert r.json()["code"] == "unauthorized"
    assert c.get("/api/stats").status_code == 401
    assert c.get("/api/conversations").status_code == 401
    assert c.get("/api/auth/check", headers={"X-API-Key": "wrong"}).status_code == 401

    assert c.get("/api/auth/check", headers={"X-API-Key": "k-one"}).json() == {"ok": True, "authenticated": True}
    assert c.get("/api/auth/check", headers={"Authorization": "Bearer k-two"}).status_code == 200


def test_conversations_are_private_per_key(make_client):
    c = make_client(paypilot_api_keys="alice,bob")
    alice, bob = {"X-API-Key": "alice"}, {"X-API-Key": "bob"}
    sid = c.post("/chat", json={"message": "status of pay_Priv4te"}, headers=alice).json()["session_id"]

    assert c.get(f"/api/conversations/{sid}", headers=bob).status_code == 404
    assert c.get("/api/conversations", headers=bob).json() == []
    assert c.delete(f"/api/conversations/{sid}", headers=bob).status_code == 404
    # Bob can't append to Alice's conversation by reusing its id.
    assert c.post("/chat", json={"message": "and refund?", "session_id": sid}, headers=bob).status_code == 404
    assert c.get("/api/activity", headers=bob).json() == []

    assert c.get(f"/api/conversations/{sid}", headers=alice).status_code == 200
    assert len(c.get("/api/activity", headers=alice).json()) == 1


def test_chat_rate_limit(make_client):
    c = make_client(rate_limit_chat_per_min=2)
    for _ in range(2):
        assert c.post("/chat", json={"message": "hours?"}).status_code == 200
    r = c.post("/chat", json={"message": "hours?"})
    assert r.status_code == 429
    assert r.json()["code"] == "rate_limited"
    assert int(r.headers["retry-after"]) >= 1


def test_bad_key_attempts_are_throttled(make_client):
    c = make_client(paypilot_api_keys="secret", rate_limit_auth_fail_per_min=3)
    codes = [c.get("/api/stats", headers={"X-API-Key": f"guess{i}"}).status_code for i in range(5)]
    assert codes[:3] == [401, 401, 401]
    assert codes[3:] == [429, 429]


def test_require_auth_without_keys_refuses_to_start():
    with pytest.raises(RuntimeError):
        Security(Settings(_env_file=None, paypilot_require_auth=True, paypilot_api_keys=""))
