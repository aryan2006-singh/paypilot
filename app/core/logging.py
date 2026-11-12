"""Structured logging with a per-request id.

Every log line carries the id of the request that produced it, and the same
id is returned to the client in the ``X-Request-ID`` header and in error
bodies, so a user's bug report can be matched to server logs.
"""
from __future__ import annotations

import json
import logging
import sys
import time
from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


class JsonFormatter(logging.Formatter):
    _RESERVED = set(logging.makeLogRecord({}).__dict__) | {"request_id", "message"}

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)) + "Z",
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
        }
        # Anything passed via `extra=` becomes a top-level field.
        for key, value in record.__dict__.items():
            if key not in self._RESERVED and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(level: str = "INFO", json_logs: bool = True) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(_RequestIdFilter())
    if json_logs:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)-7s [%(request_id)s] %(name)s: %(message)s")
        )
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level.upper())
    # uvicorn's access log duplicates our own request log line.
    logging.getLogger("uvicorn.access").disabled = True
