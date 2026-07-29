"""Build a FAISS index per namespace from docs/<namespace>/*.md.

Usage: python -m rag.build_index
"""
from __future__ import annotations

import pickle
from pathlib import Path

import faiss
from sentence_transformers import SentenceTransformer

DOCS_DIR = Path(__file__).parent / "docs"
INDEX_DIR = Path(__file__).parent / "indexes"
CHUNK_SIZE = 500  # chars, naive splitter — swap for a token-aware splitter later


def chunk_text(text: str, size: int = CHUNK_SIZE) -> list[str]:
    return [text[i : i + size] for i in range(0, len(text), size) if text[i : i + size].strip()]


def build_namespace(namespace_dir: Path, model: SentenceTransformer):
    chunks: list[str] = []
    for md_file in namespace_dir.glob("*.md"):
        chunks.extend(chunk_text(md_file.read_text(encoding="utf-8")))

    if not chunks:
        print(f"  skipped {namespace_dir.name} (no .md files)")
        return

    vectors = model.encode(chunks)
    index = faiss.IndexFlatL2(vectors.shape[1])
    index.add(vectors)

    INDEX_DIR.mkdir(exist_ok=True)
    faiss.write_index(index, str(INDEX_DIR / f"{namespace_dir.name}.faiss"))
    with open(INDEX_DIR / f"{namespace_dir.name}.pkl", "wb") as f:
        pickle.dump(chunks, f)
    print(f"  built {namespace_dir.name}: {len(chunks)} chunks")


def main():
    model = SentenceTransformer("all-MiniLM-L6-v2")
    print("Building indexes...")
    for namespace_dir in DOCS_DIR.iterdir():
        if namespace_dir.is_dir():
            build_namespace(namespace_dir, model)


if __name__ == "__main__":
    main()
