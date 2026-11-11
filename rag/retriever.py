"""TF-IDF retriever over the policy corpus, namespaced by agent domain.

Run `python -m rag.build_index` once to populate indexes/ from docs/*.md
(the Docker build does it automatically). Where no prebuilt index exists, as on
serverless hosts, the index is built in memory from docs/*.md on first use.
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
        return _build_in_memory(namespace)
    with open(path, "rb") as f:
        index = pickle.load(f)
    # Guards against an index from an older build format: treat as missing.
    if not isinstance(index, dict) or not _REQUIRED_KEYS <= index.keys():
        return _build_in_memory(namespace)
    return index


def _build_in_memory(namespace: str) -> dict | None:
    """Index docs/<namespace>/*.md without touching disk (read-only filesystems)."""
    from rag.build_index import DOCS_DIR, chunk_text  # lazy: build_index imports this module

    namespace_dir = DOCS_DIR / namespace
    if not namespace_dir.is_dir():
        return None
    chunks: list[str] = []
    for md_file in sorted(namespace_dir.glob("*.md")):
        chunks.extend(chunk_text(md_file.read_text(encoding="utf-8")))
    return tfidf.build(chunks) if chunks else None


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
