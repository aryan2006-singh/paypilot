"""TF-IDF retriever over the policy corpus, namespaced by agent domain.

Run `python -m rag.build_index` once to populate indexes/ from docs/*.md
before using this (the Docker build does it automatically).
"""
from __future__ import annotations

import pickle
from functools import lru_cache
from pathlib import Path

from rag import tfidf

INDEX_DIR = Path(__file__).parent / "indexes"

_REQUIRED_KEYS = {"vocab", "idf", "matrix", "chunks"}


def index_path(namespace: str) -> Path:
    return INDEX_DIR / f"{namespace}.pkl"


def index_exists(namespace: str) -> bool:
    """Whether a usable index is on disk (surfaced by /api/config)."""
    return _load_namespace(namespace) is not None


@lru_cache
def _load_namespace(namespace: str) -> dict | None:
    path = index_path(namespace)
    if not path.exists():
        return None
    with open(path, "rb") as f:
        index = pickle.load(f)
    # Guards against an index from an older build format: treat as missing.
    if not isinstance(index, dict) or not _REQUIRED_KEYS <= index.keys():
        return None
    return index


def clear_cache() -> None:
    _load_namespace.cache_clear()


def search(query: str, namespace: str = "general", k: int = 3) -> list[str]:
    """Top-k policy passages, or [] when nothing relevant (or no index)."""
    index = _load_namespace(namespace)
    if index is None:
        return []
    return tfidf.search(index, query, k)


async def retrieve_context(query: str, namespace: str = "general", k: int = 3) -> str:
    """Joined passages, kept for scripts that used the old API."""
    return "\n---\n".join(search(query, namespace, k))
