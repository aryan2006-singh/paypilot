"""Vercel serverless entrypoint: exposes the FastAPI app as a function.

vercel.json rewrites /chat, /health and /api/* here; the static frontend is
served from the build output. The filesystem is read-only apart from /tmp, so
the conversation database and ledger live there (set via env in vercel.json).
"""
from app.main import app  # noqa: F401  (Vercel picks up the ASGI `app`)
