"""Typed application settings, loaded once from the environment (and .env).

Every knob the service has lives here, so there is one place to look when
deploying. Nothing else in the codebase should read ``os.environ`` directly.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[2]

# Values shipped in .env.example. If these are still in place there are no
# real Razorpay keys and every tool falls back to deterministic demo data.
_RAZORPAY_PLACEHOLDERS = {"", "rzp_test_xxxxxxxx", "xxxxxxxx"}


def _csv(raw: str) -> tuple[str, ...]:
    return tuple(part.strip() for part in raw.split(",") if part.strip())


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    # --- Service -------------------------------------------------------------
    environment: Literal["development", "production", "test"] = "development"
    log_level: str = "INFO"
    log_json: bool = Field(default=True, description="JSON logs (set false for readable dev logs)")

    # --- Security ------------------------------------------------------------
    # Comma-separated. Unset means the API runs open (local dev / demo).
    paypilot_api_keys: str = ""
    paypilot_require_auth: bool = False
    trust_proxy_headers: bool = False
    allowed_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
    )
    rate_limit_chat_per_min: int = Field(default=20, ge=1)
    rate_limit_read_per_min: int = Field(default=120, ge=1)
    rate_limit_auth_fail_per_min: int = Field(default=10, ge=1)

    # --- Storage -------------------------------------------------------------
    database_path: Path = ROOT_DIR / "data" / "paypilot.db"
    ledger_path: Path | None = None

    # --- Razorpay ------------------------------------------------------------
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_base_url: str = "https://api.razorpay.com/v1"
    razorpay_timeout_s: float = 8.0

    # --- LLM (optional) ------------------------------------------------------
    anthropic_api_key: str = ""
    llm_model: str = "claude-opus-5-5"
    llm_effort: Literal["low", "medium", "high", "xhigh", "max"] = "low"
    llm_max_tokens: int = Field(default=4096, ge=256)
    llm_timeout_s: float = 60.0

    # --- Chat ----------------------------------------------------------------
    history_turns: int = Field(default=10, ge=0, description="Past messages sent to the LLM")
    # Pause between chunks when streaming a templated (non-LLM) reply, so it
    # still visibly streams in. Real LLM tokens are forwarded as they arrive.
    template_token_delay_s: float = Field(default=0.015, ge=0)

    frontend_dist: Path = ROOT_DIR / "frontend" / "dist"

    # --- Derived -------------------------------------------------------------
    @property
    def api_keys(self) -> tuple[str, ...]:
        return _csv(self.paypilot_api_keys)

    @property
    def auth_enabled(self) -> bool:
        return bool(self.api_keys)

    @property
    def cors_origins(self) -> list[str]:
        return list(_csv(self.allowed_origins))

    @property
    def razorpay_configured(self) -> bool:
        return (
            self.razorpay_key_id not in _RAZORPAY_PLACEHOLDERS
            and self.razorpay_key_secret not in _RAZORPAY_PLACEHOLDERS
        )

    @property
    def razorpay_key_id_masked(self) -> str:
        key = self.razorpay_key_id
        if len(key) > 12:
            return f"{key[:8]}…{key[-4:]}"
        return key or "(not set)"

    @property
    def llm_configured(self) -> bool:
        return bool(self.anthropic_api_key.strip())

    @property
    def resolved_ledger_path(self) -> Path:
        return self.ledger_path or ROOT_DIR / "data" / "ledger.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
