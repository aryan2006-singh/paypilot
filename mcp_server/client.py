"""Thin MCP client wrapper so agent nodes can call tools without knowing
transport details. Swap the stdio connection for SSE/HTTP if you deploy the
MCP server separately from the FastAPI app.
"""
from __future__ import annotations

import asyncio
import os
import sys
from typing import Any

from langchain_mcp_adapters.client import MultiServerMCPClient
from mcp.client.stdio import get_default_environment

_client: MultiServerMCPClient | None = None
_client_lock = asyncio.Lock()

# Credentials mcp_server/tools.py reads out of the environment.
_FORWARDED_ENV_VARS = ("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET")


def _server_env() -> dict[str, str]:
    """Environment for the tool subprocess.

    The MCP SDK does *not* inherit the parent environment for stdio servers —
    when `env` is omitted it substitutes a fixed allowlist (HOME/PATH/USER/…
    see mcp.client.stdio.get_default_environment). RAZORPAY_* would therefore
    be stripped and tools.py would fall back to mock data even with real keys
    configured, while /api/config — evaluated in *this* process, which does
    have them — kept reporting "configured".

    This only ever bit a real deployment: tools.py also calls load_dotenv(),
    so a local .env masked the problem, and .env is dockerignored.

    Start from the SDK's allowlist so its safety posture is preserved, then
    forward just the variables the tool server actually needs.
    """
    env = get_default_environment()
    for name in _FORWARDED_ENV_VARS:
        value = os.environ.get(name)
        if value is not None:
            env[name] = value
    return env


async def _get_client() -> MultiServerMCPClient:
    """Lazily spin up the stdio MCP server subprocess and keep the connection
    open for the lifetime of the app (langchain-mcp-adapters 0.0.5 requires
    entering the client as an async context manager before get_tools() will
    return anything — it's not a bare constructor + await call)."""
    global _client
    if _client is None:
        async with _client_lock:
            if _client is None:  # re-check after acquiring the lock
                client = MultiServerMCPClient(
                    {
                        "paypilot": {
                            # sys.executable, not bare "python" — the subprocess
                            # must run under the same interpreter/venv as the
                            # API or it won't find the installed dependencies
                            # (and on some hosts "python" isn't on PATH at all).
                            "command": sys.executable,
                            "args": ["-m", "mcp_server.tools"],
                            "transport": "stdio",
                            "env": _server_env(),
                        }
                    }
                )
                await client.__aenter__()
                _client = client
    return _client


async def call_tool(tool_name: str, args: dict[str, Any]) -> Any:
    client = await _get_client()
    tools = client.get_tools()  # synchronous in langchain-mcp-adapters 0.0.5
    tool = next((t for t in tools if t.name == tool_name), None)
    if tool is None:
        return {"error": f"tool '{tool_name}' not found"}
    return await tool.ainvoke(args)
