"""Persistent conversation memory and activity, backed by SQLite.

SQLite keeps the deploy to a single service with no extra infrastructure and
survives restarts while the disk does. Calls run in a worker thread so the
event loop never blocks on disk. Every conversation belongs to an owner (the
caller's API key fingerprint, or "anon"), and every read is scoped to it.
"""
from __future__ import annotations

import asyncio
import json
import sqlite3
import threading
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY,
    owner       TEXT NOT NULL,
    title       TEXT NOT NULL,
    created_at  REAL NOT NULL,
    updated_at  REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_conversations_owner ON conversations(owner, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT NOT NULL,
    created_at      REAL NOT NULL,
    agent_used      TEXT,
    intent          TEXT,
    entity_id       TEXT,
    tool_result     TEXT,
    policy_context  TEXT,
    llm_used        INTEGER,
    latency_ms      REAL,
    mock            INTEGER,
    prompt          TEXT
);
CREATE INDEX IF NOT EXISTS ix_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS ix_messages_activity ON messages(role, created_at DESC);
"""


@dataclass
class StoredTurn:
    role: str
    content: str
    intent: str | None
    entity_id: str | None


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:20]}"


class Store:
    def __init__(self, path: Path | str):
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self._lock:
            self._conn.execute("PRAGMA foreign_keys = ON")
            if self.path != ":memory:":
                self._conn.execute("PRAGMA journal_mode = WAL")
            self._conn.executescript(SCHEMA)
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    async def _run(self, fn, *args):
        return await asyncio.to_thread(self._locked, fn, *args)

    def _locked(self, fn, *args):
        with self._lock:
            return fn(*args)

    # --- health ------------------------------------------------------------
    async def ping(self) -> bool:
        def q():
            self._conn.execute("SELECT 1").fetchone()
            return True
        try:
            return await self._run(q)
        except sqlite3.Error:
            return False

    # --- conversations -----------------------------------------------------
    async def ensure_conversation(self, conversation_id: str, owner: str, first_message: str) -> bool:
        """Create the conversation if it doesn't exist. Returns False when the id
        exists but belongs to someone else (the caller must not write to it)."""
        def q():
            row = self._conn.execute("SELECT owner FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
            if row is not None:
                return row["owner"] == owner
            now = time.time()
            title = " ".join(first_message.split())[:80] or "New conversation"
            self._conn.execute(
                "INSERT INTO conversations (id, owner, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (conversation_id, owner, title, now, now),
            )
            self._conn.commit()
            return True
        return await self._run(q)

    async def recent_turns(self, conversation_id: str, limit: int) -> list[StoredTurn]:
        def q():
            rows = self._conn.execute(
                "SELECT role, content, intent, entity_id FROM messages WHERE conversation_id = ? "
                "ORDER BY created_at DESC, rowid DESC LIMIT ?",
                (conversation_id, limit),
            ).fetchall()
            return [StoredTurn(r["role"], r["content"], r["intent"], r["entity_id"]) for r in reversed(rows)]
        return await self._run(q)

    async def add_exchange(self, conversation_id: str, user_text: str, assistant: dict[str, Any]) -> str:
        """Persist one user message and the assistant reply atomically.
        Returns the assistant message id."""
        def q():
            now = time.time()
            message_id = new_id("msg")
            tool = assistant.get("tool_result")
            mock = None if not tool or "mock" not in tool else int(bool(tool["mock"]))
            with self._conn:
                self._conn.execute(
                    "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)",
                    (new_id("msg"), conversation_id, user_text, now),
                )
                self._conn.execute(
                    "INSERT INTO messages (id, conversation_id, role, content, created_at, agent_used, intent, "
                    "entity_id, tool_result, policy_context, llm_used, latency_ms, mock, prompt) "
                    "VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        message_id, conversation_id, assistant["reply"], now + 1e-6,
                        assistant["agent_used"], assistant["intent"], assistant.get("entity_id"),
                        json.dumps(tool) if tool is not None else None,
                        assistant.get("policy_context"), int(bool(assistant.get("llm_used"))),
                        assistant.get("latency_ms"), mock, user_text[:200],
                    ),
                )
                self._conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conversation_id))
            return message_id
        return await self._run(q)

    async def list_conversations(self, owner: str, limit: int) -> list[dict]:
        def q():
            rows = self._conn.execute(
                """
                SELECT c.id, c.title, c.created_at, c.updated_at,
                       COUNT(m.id) AS message_count,
                       (SELECT agent_used FROM messages
                         WHERE conversation_id = c.id AND role = 'assistant'
                         ORDER BY created_at DESC LIMIT 1) AS last_agent
                  FROM conversations c LEFT JOIN messages m ON m.conversation_id = c.id
                 WHERE c.owner = ?
                 GROUP BY c.id ORDER BY c.updated_at DESC LIMIT ?
                """,
                (owner, limit),
            ).fetchall()
            return [dict(r) for r in rows]
        return await self._run(q)

    async def get_conversation(self, conversation_id: str, owner: str) -> dict | None:
        def q():
            conv = self._conn.execute(
                "SELECT id, title, created_at, updated_at FROM conversations WHERE id = ? AND owner = ?",
                (conversation_id, owner),
            ).fetchone()
            if conv is None:
                return None
            rows = self._conn.execute(
                "SELECT id, role, content, created_at, agent_used, intent, entity_id, tool_result, "
                "policy_context, llm_used FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid",
                (conversation_id,),
            ).fetchall()
            messages = []
            for r in rows:
                m = dict(r)
                m["tool_result"] = json.loads(m["tool_result"]) if m["tool_result"] else None
                m["llm_used"] = None if m["llm_used"] is None else bool(m["llm_used"])
                messages.append(m)
            return {**dict(conv), "messages": messages}
        return await self._run(q)

    async def delete_conversation(self, conversation_id: str, owner: str) -> bool:
        def q():
            with self._conn:
                cur = self._conn.execute(
                    "DELETE FROM conversations WHERE id = ? AND owner = ?", (conversation_id, owner)
                )
            return cur.rowcount > 0
        return await self._run(q)

    # --- activity & stats --------------------------------------------------
    async def activity(self, limit: int, owner: str | None = None) -> list[dict]:
        def q():
            sql = (
                "SELECT m.created_at AS timestamp, m.prompt AS message, m.agent_used, m.intent, m.entity_id, "
                "m.mock, m.conversation_id AS session_id, m.llm_used, m.latency_ms "
                "FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE m.role = 'assistant'"
            )
            params: list[Any] = []
            if owner is not None:
                sql += " AND c.owner = ?"
                params.append(owner)
            sql += " ORDER BY m.created_at DESC LIMIT ?"
            params.append(limit)
            out = []
            for r in self._conn.execute(sql, params).fetchall():
                d = dict(r)
                d["mock"] = None if d["mock"] is None else bool(d["mock"])
                d["llm_used"] = bool(d["llm_used"])
                out.append(d)
            return out
        return await self._run(q)

    async def stats(self, agents: list[str]) -> dict:
        def q():
            c = self._conn
            by_agent = {a: 0 for a in agents}
            for r in c.execute("SELECT agent_used, COUNT(*) n FROM messages WHERE role='assistant' GROUP BY agent_used"):
                by_agent[r["agent_used"]] = r["n"]
            row = c.execute(
                "SELECT COUNT(*) total, "
                "SUM(CASE WHEN mock = 1 THEN 1 ELSE 0 END) mock_count, "
                "SUM(CASE WHEN mock = 0 THEN 1 ELSE 0 END) live_count, "
                "SUM(CASE WHEN llm_used = 1 THEN 1 ELSE 0 END) llm_count, "
                "AVG(latency_ms) avg_latency_ms, "
                "SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) last_24h "
                "FROM messages WHERE role = 'assistant'",
                (time.time() - 86_400,),
            ).fetchone()
            conversations = c.execute("SELECT COUNT(*) FROM conversations").fetchone()[0]
            return {
                "total": row["total"] or 0,
                "by_agent": by_agent,
                "mock_count": row["mock_count"] or 0,
                "live_count": row["live_count"] or 0,
                "llm_count": row["llm_count"] or 0,
                "conversations": conversations,
                "avg_latency_ms": round(row["avg_latency_ms"], 1) if row["avg_latency_ms"] is not None else None,
                "last_24h": row["last_24h"] or 0,
            }
        return await self._run(q)
