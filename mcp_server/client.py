"""Thin MCP client wrapper so agent nodes can call tools without knowing
transport details. Swap the stdio connection for SSE/HTTP if you deploy the
MCP server separately from the FastAPI app.
"""
from __future__ import annotations

import asyncio
import sys
from typing import Any

from langchain_mcp_adapters.client import MultiServerMCPClient

_client: MultiServerMCPClient | None = None
_client_lock = asyncio.Lock()


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
