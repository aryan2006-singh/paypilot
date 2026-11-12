from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from rag import build_index, retriever


@pytest.fixture(scope="session", autouse=True)
def _rag_index():
    """Build the policy indexes once so agents retrieve real passages."""
    build_index.main()
    retriever.clear_cache()


def make_settings(tmp_path: Path, **overrides) -> Settings:
    base = dict(
        environment="test",
        log_json=False,
        log_level="WARNING",
        database_path=tmp_path / "test.db",
        ledger_path=tmp_path / "no-ledger.json",
        frontend_dist=tmp_path / "no-dist",
        razorpay_key_id="",
        razorpay_key_secret="",
        anthropic_api_key="",
        paypilot_api_keys="",
        template_token_delay_s=0,
    )
    base.update(overrides)
    return Settings(_env_file=None, **base)


@pytest.fixture
def settings(tmp_path):
    return make_settings(tmp_path)


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as c:
        yield c


@pytest.fixture
def make_client(tmp_path):
    """Factory for apps with custom settings (auth on, low rate limits...)."""
    clients = []

    def _make(**overrides) -> TestClient:
        c = TestClient(create_app(make_settings(tmp_path, **overrides)))
        c.__enter__()
        clients.append(c)
        return c

    yield _make
    for c in clients:
        c.__exit__(None, None, None)
