"""Build a TF-IDF index per namespace from docs/<namespace>/*.md.

Usage: python -m rag.build_index
"""
from __future__ import annotations

import pickle
from pathlib import Path

from rag import tfidf
from rag.retriever import INDEX_DIR, index_path

DOCS_DIR = Path(__file__).parent / "docs"
CHUNK_SIZE = 500  # chars, naive splitter — swap for a token-aware splitter later


def chunk_text(text: str, size: int = CHUNK_SIZE) -> list[str]:
    return [text[i : i + size] for i in range(0, len(text), size) if text[i : i + size].strip()]


def build_namespace(namespace_dir: Path) -> None:
    chunks: list[str] = []
    for md_file in sorted(namespace_dir.glob("*.md")):
        chunks.extend(chunk_text(md_file.read_text(encoding="utf-8")))

    if not chunks:
        print(f"  skipped {namespace_dir.name} (no .md files)")
        return

    index = tfidf.build(chunks)
    INDEX_DIR.mkdir(exist_ok=True)
    with open(index_path(namespace_dir.name), "wb") as f:
        pickle.dump(index, f)
    print(f"  built {namespace_dir.name}: {len(chunks)} chunks, {len(index['vocab'])} terms")


def main() -> None:
    print("Building indexes...")
    for namespace_dir in sorted(DOCS_DIR.iterdir()):
        if namespace_dir.is_dir():
            build_namespace(namespace_dir)


if __name__ == "__main__":
    main()
