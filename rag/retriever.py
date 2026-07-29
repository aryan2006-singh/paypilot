"""FAISS + sentence-transformers retriever, namespaced by agent domain.

Run build_index.py once to populate indexes/ from docs/*.md before using this.
"""
from __future__ import annotations

import pickle
from functools import lru_cache
from pathlib import Path

import faiss
from sentence_transformers import SentenceTransformer

INDEX_DIR = Path(__file__).parent / "indexes"
MODEL_NAME = "all-MiniLM-L6-v2"


@lru_cache
def _model() -> SentenceTransformer:
    return SentenceTransformer(MODEL_NAME)


@lru_cache
def _load_namespace(namespace: str):
    idx_path = INDEX_DIR / f"{namespace}.faiss"
    meta_path = INDEX_DIR / f"{namespace}.pkl"
    if not idx_path.exists():
        return None, None
    index = faiss.read_index(str(idx_path))
    with open(meta_path, "rb") as f:
        chunks = pickle.load(f)
    return index, chunks


async def retrieve_context(query: str, namespace: str = "general", k: int = 3) -> str:
    index, chunks = _load_namespace(namespace)
    if index is None:
        return "(no index built yet for this namespace — run rag/build_index.py)"

    query_vec = _model().encode([query])
    distances, indices = index.search(query_vec, k)
    # FAISS pads missing matches with -1 when k exceeds the index size; Python's
    # negative indexing would silently wrap that to chunks[-1] and duplicate the
    # last chunk, so exclude anything outside [0, len(chunks)) explicitly.
    results = [chunks[i] for i in indices[0] if 0 <= i < len(chunks)]
    return "\n---\n".join(results) if results else "(no relevant context found)"
