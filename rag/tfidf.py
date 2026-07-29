"""Minimal TF-IDF vector-space model shared by the index builder and retriever.

This replaces the original FAISS + sentence-transformers stack. The policy
corpus is a handful of short markdown documents, so lexical scoring surfaces
the same passages a MiniLM embedding would — while keeping the deployed
service inside a 512 MB instance (torch alone held ~490 MB resident, which
does not fit Render's free/starter tiers).
"""
from __future__ import annotations

import math
from collections import Counter
from typing import Iterable

import numpy as np

_TOKEN_RE_PARTS = "abcdefghijklmnopqrstuvwxyz0123456789_"

# The highest-frequency English function words carry no signal in a bag-of-words
# model and would otherwise dominate short queries like "where is my refund".
_STOPWORDS = frozenset(
    """
    a an and are as at be been but by can do does for from had has have how i if
    in is it its me my no not of on or our so that the their them then there
    these they this to was we were what when where which who will with you your
    """.split()
)


def tokenize(text: str) -> list[str]:
    """Lowercase word tokens, keeping underscores so IDs like `pay_abc123`
    survive as a single term rather than splitting into `pay` + `abc123`."""
    out: list[str] = []
    current: list[str] = []
    for char in text.lower():
        if char in _TOKEN_RE_PARTS:
            current.append(char)
        elif current:
            out.append("".join(current))
            current = []
    if current:
        out.append("".join(current))
    return [t for t in out if t not in _STOPWORDS and len(t) > 1]


def _l2_normalize(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=-1, keepdims=True)
    # Rows made up entirely of stopwords/unknown terms have zero norm; leave
    # them at zero rather than dividing by zero (they simply never match).
    return matrix / np.where(norms == 0, 1.0, norms)


def build(chunks: list[str]) -> dict:
    """Fit the vocabulary/IDF weights over `chunks` and return a picklable index."""
    tokenized = [tokenize(chunk) for chunk in chunks]
    vocab = {term: i for i, term in enumerate(sorted({t for doc in tokenized for t in doc}))}

    n_docs = len(tokenized)
    tf = np.zeros((n_docs, len(vocab)), dtype=np.float32)
    df = np.zeros(len(vocab), dtype=np.float32)

    for row, doc in enumerate(tokenized):
        for term, count in Counter(doc).items():
            col = vocab[term]
            tf[row, col] = 1.0 + math.log(count)  # sublinear tf
            df[col] += 1.0

    # Smoothed IDF — the +1s keep terms present in every chunk from collapsing
    # to a zero weight, which matters a lot on a corpus this small.
    idf = (np.log((1.0 + n_docs) / (1.0 + df)) + 1.0).astype(np.float32)

    return {
        "vocab": vocab,
        "idf": idf,
        "matrix": _l2_normalize(tf * idf),
        "chunks": chunks,
    }


def search(index: dict, query: str, k: int) -> list[str]:
    """Return up to `k` chunks ranked by cosine similarity, best first."""
    vocab: dict[str, int] = index["vocab"]
    idf: np.ndarray = index["idf"]
    matrix: np.ndarray = index["matrix"]
    chunks: list[str] = index["chunks"]

    query_vec = np.zeros(len(vocab), dtype=np.float32)
    for term, count in Counter(tokenize(query)).items():
        col = vocab.get(term)
        if col is not None:  # terms unseen at build time contribute nothing
            query_vec[col] = (1.0 + math.log(count)) * idf[col]

    query_vec = _l2_normalize(query_vec)
    if not query_vec.any():
        return []

    scores = matrix @ query_vec
    # argsort descending, then drop non-matches so an all-zero-score query
    # returns "no relevant context" instead of k arbitrary chunks.
    ranked: Iterable[int] = np.argsort(-scores)[:k]
    return [chunks[i] for i in ranked if scores[i] > 0.0]
