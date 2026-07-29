"""TF-IDF retriever over the policy corpus, namespaced by agent domain.

Run `python -m rag.build_index` once to populate indexes/ from docs/*.md
before using this (the deploy build command does it automatically).
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
    """Whether a usable index is on disk — surfaced by /api/config so the
    Settings page can show which namespaces are actually ready."""
    return _load_namespace(namespace) is not None


@lru_cache
def _load_namespace(namespace: str) -> dict | None:
    path = index_path(namespace)
    if not path.exists():
        return None
    with open(path, "rb") as f:
        index = pickle.load(f)
    # Guards against an index left over from an older build format — treat it
    # as missing so the caller degrades gracefully instead of raising.
    if not isinstance(index, dict) or not _REQUIRED_KEYS <= index.keys():
        return None
    return index


async def retrieve_context(query: str, namespace: str = "general", k: int = 3) -> str:
    index = _load_namespace(namespace)
    if index is None:
        return "(no index built yet for this namespace — run python -m rag.build_index)"

    results = tfidf.search(index, query, k)
    return "\n---\n".join(results) if results else "(no relevant context found)"
