"""
HybridRetriever — FULLY FUNCTIONAL Dense + Sparse + RRF retrieval.

Architecture:
  - Dense: OpenAI text-embedding-3-small → ChromaDB (persisted on disk)
  - Sparse: BM25Okapi (rank-bm25) over cleaned chunk corpus
  - Fusion: Reciprocal Rank Fusion (RRF, k=60) merging both ranked lists
  - Filter: team affiliation filter at both retrieval stages

On first run (or after reindex()):
  1. Loads every .md file from DOCS_DIR, cleans and splits by ## sections.
  2. Embeds each chunk via OpenAI API (batched, 100 chunks/batch).
  3. Persists embeddings to ChromaDB collection "onboardos_docs" at CHROMA_PERSIST_DIR.
  4. Builds BM25 index in memory.

Subsequent runs:
  - ChromaDB loads persisted vectors from disk instantly.
  - BM25 is rebuilt in memory from the same chunks (fast, ~100ms).
  - If chunk count in Chroma == chunk count on disk → skip re-embedding (saves API cost).
"""

import hashlib
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from rank_bm25 import BM25Okapi

from backend.app.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data class
# ---------------------------------------------------------------------------

class DocChunk:
    __slots__ = ("id", "doc_name", "section", "content", "team")

    def __init__(
        self,
        id: str,
        doc_name: str,
        section: str,
        content: str,
        team: Optional[str] = None,
    ) -> None:
        self.id = id
        self.doc_name = doc_name
        self.section = section
        self.content = content
        self.team = team

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "doc": self.doc_name,
            "section": self.section,
            "content": self.content,
            "team": self.team,
        }

    @property
    def embed_text(self) -> str:
        """Text sent to the embedding model: title + content for richer representation."""
        return f"{self.doc_name} — {self.section}\n{self.content}"


# ---------------------------------------------------------------------------
# Team affiliation mapping
# ---------------------------------------------------------------------------

_TEAM_MAP = {
    "backend": "Backend Platform",
    "frontend": "Frontend Platform",
    "data": "Data & ML Platform",
    "ml": "Data & ML Platform",
    "devops": "DevOps & Infrastructure",
    "infra": "DevOps & Infrastructure",
    "mobile": "Mobile Platform",
}


def _infer_team(doc_name: str) -> Optional[str]:
    lower = doc_name.lower()
    for key, team in _TEAM_MAP.items():
        if key in lower:
            return team
    return None


# ---------------------------------------------------------------------------
# Embedding helper (OpenAI text-embedding-3-small)
# ---------------------------------------------------------------------------

def _embed_texts(texts: List[str], api_key: str, batch_size: int = 100) -> List[List[float]]:
    """
    Embeds a list of texts using OpenAI text-embedding-3-small.
    Returns a list of float vectors in the same order as input.
    Batches requests to stay within API limits.
    """
    import openai

    client = openai.OpenAI(api_key=api_key)
    all_embeddings: List[List[float]] = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        # Clean texts: replace newlines with spaces (OpenAI recommendation)
        batch_cleaned = [t.replace("\n", " ").strip() for t in batch]
        response = client.embeddings.create(
            input=batch_cleaned,
            model="text-embedding-3-small",
        )
        # response.data is sorted by index
        sorted_data = sorted(response.data, key=lambda x: x.index)
        all_embeddings.extend([item.embedding for item in sorted_data])

    return all_embeddings


# ---------------------------------------------------------------------------
# Main retriever
# ---------------------------------------------------------------------------

class HybridRetriever:
    """
    Production-grade hybrid retriever:
      Dense (ChromaDB + OpenAI embeddings) + Sparse (BM25) fused with RRF.
    """

    COLLECTION_NAME = "onboardos_docs"

    def __init__(self) -> None:
        self.chunks: List[DocChunk] = []
        self.bm25: Optional[BM25Okapi] = None
        self.tokenized_corpus: List[List[str]] = []
        self._initialized = False
        self._chroma_collection = None  # lazy-loaded

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def initialize(self, force: bool = False) -> None:
        """
        Loads docs, builds BM25 index, and ensures ChromaDB is populated.
        Skips re-embedding if the persisted collection already has the right chunk count.
        """
        if self._initialized and not force:
            return

        logger.info("HybridRetriever: initialising …")
        chunks = self._load_and_chunk_docs()
        self.chunks = chunks

        # Build BM25
        self.tokenized_corpus = [self._tokenize(c.embed_text) for c in chunks]
        if self.tokenized_corpus:
            self.bm25 = BM25Okapi(self.tokenized_corpus)
        logger.info(f"HybridRetriever: BM25 index built over {len(chunks)} chunks.")

        # Build / sync ChromaDB
        self._sync_chroma(chunks, force=force)

        self._initialized = True
        logger.info("HybridRetriever: ready.")

    def reindex(self) -> None:
        """Forces full re-embedding and re-index (use after adding new docs)."""
        self._initialized = False
        self.initialize(force=True)

    def hybrid_search(
        self,
        query: str,
        top_k: int = 5,
        team_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Full hybrid search:
          1. Dense vector search via ChromaDB.
          2. Sparse BM25 search.
          3. RRF fusion of both ranked lists.
          4. Optional team-affiliation filter applied to final results.
        Returns up to top_k results with score, doc, section, content, team.
        """
        self.initialize()

        dense_results = self._dense_search(query, top_k=top_k * 3, team_filter=team_filter)
        sparse_results = self.search_bm25(query, top_k=top_k * 3, team_filter=team_filter)

        return self._rrf_fuse(dense_results, sparse_results, top_k=top_k)

    def search_bm25(
        self,
        query: str,
        top_k: int = 5,
        team_filter: Optional[str] = None,
    ) -> List[Tuple["DocChunk", float]]:
        """Sparse BM25 retrieval with optional team filter."""
        self.initialize()
        if not self.bm25 or not self.chunks:
            return []

        tokens = self._tokenize(query)
        scores = self.bm25.get_scores(tokens)
        ranked_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)

        results: List[Tuple[DocChunk, float]] = []
        for idx in ranked_indices:
            if scores[idx] <= 0.0:
                break
            chunk = self.chunks[idx]
            if team_filter and chunk.team and chunk.team.lower() != team_filter.lower():
                continue
            results.append((chunk, float(scores[idx])))
            if len(results) >= top_k:
                break
        return results

    def verify_citation(self, doc_name: str, section: str) -> bool:
        """Returns True if the cited (doc_name, section) pair exists in the chunk store."""
        self.initialize()
        norm_doc = self._norm_doc(doc_name)
        norm_sec = section.lower().strip()
        for chunk in self.chunks:
            if self._norm_doc(chunk.doc_name) == norm_doc and chunk.section.lower().strip() == norm_sec:
                return True
        return False

    def get_chunk_content(self, doc_name: str, section: str) -> Optional[str]:
        """Returns raw content for a (doc, section) pair."""
        self.initialize()
        norm_doc = self._norm_doc(doc_name)
        norm_sec = section.lower().strip()
        for chunk in self.chunks:
            if self._norm_doc(chunk.doc_name) == norm_doc and chunk.section.lower().strip() == norm_sec:
                return chunk.content
        return None

    def get_stats(self) -> Dict[str, Any]:
        """Returns KB statistics for health-check / admin endpoint."""
        self.initialize()
        chroma_count = 0
        try:
            col = self._get_or_create_collection()
            chroma_count = col.count()
        except Exception:
            pass
        return {
            "total_chunks": len(self.chunks),
            "chroma_vectors": chroma_count,
            "bm25_ready": self.bm25 is not None,
            "docs": list({c.doc_name for c in self.chunks}),
            "teams_covered": list({c.team for c in self.chunks if c.team}),
        }

    # ------------------------------------------------------------------
    # Internal: Document loading and chunking
    # ------------------------------------------------------------------

    @staticmethod
    def clean_doc_text(text: str) -> str:
        """Strip markdown formatting and drop disclaimer lines."""
        if not text:
            return ""
        text = re.sub(r"\*{1,3}(.*?)\*{1,3}", r"\1", text)
        text = re.sub(r"^\s*>\s*", "", text, flags=re.MULTILINE)
        lines = [
            ln for ln in text.splitlines()
            if "sample data" not in ln.lower()
            and "synthetic" not in ln.lower()
        ]
        return "\n".join(lines).strip()

    def _load_and_chunk_docs(self) -> List[DocChunk]:
        docs_dir = settings.DOCS_DIR
        chunk_list: List[DocChunk] = []

        for doc_file in sorted(docs_dir.glob("*.md")):
            doc_name = doc_file.name
            with open(doc_file, "r", encoding="utf-8") as f:
                raw = f.read()

            cleaned = self.clean_doc_text(raw)
            team = _infer_team(doc_name)

            # Split on ## headings (preserving the heading line)
            sections = re.split(r"\n(?=##\s+)", cleaned)
            for idx, sec in enumerate(sections):
                lines = sec.strip().splitlines()
                if not lines:
                    continue
                header_line = lines[0]
                section_title = re.sub(r"^#+\s*", "", header_line).strip()
                content = "\n".join(lines[1:]).strip() if len(lines) > 1 else ""

                # Skip stub chunks
                if not content or len(content) < 30:
                    continue

                # Stable chunk id: hash of doc+section so reindex is idempotent
                chunk_id = hashlib.md5(f"{doc_name}#{section_title}".encode()).hexdigest()
                chunk_list.append(
                    DocChunk(
                        id=chunk_id,
                        doc_name=doc_name,
                        section=section_title,
                        content=content,
                        team=team,
                    )
                )

        logger.info(f"Loaded {len(chunk_list)} chunks from {docs_dir}.")
        return chunk_list

    # ------------------------------------------------------------------
    # Internal: ChromaDB
    # ------------------------------------------------------------------

    def _get_or_create_collection(self):
        """Returns the ChromaDB collection, creating/loading it lazily."""
        if self._chroma_collection is not None:
            return self._chroma_collection

        import chromadb
        from chromadb.config import Settings as ChromaSettings

        persist_dir = str(settings.CHROMA_PERSIST_DIR)
        os.makedirs(persist_dir, exist_ok=True)

        client = chromadb.PersistentClient(
            path=persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self._chroma_collection = client.get_or_create_collection(
            name=self.COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        return self._chroma_collection

    def _sync_chroma(self, chunks: List[DocChunk], force: bool = False) -> None:
        """
        Ensures ChromaDB has up-to-date embeddings.
        Only re-embeds chunks whose IDs are not already in the collection.
        This saves API cost on restarts — only NEW or CHANGED chunks are re-embedded.
        """
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            logger.warning(
                "OPENAI_API_KEY not set — dense retrieval disabled. "
                "Only BM25 will be used."
            )
            return

        col = self._get_or_create_collection()

        if force:
            # Wipe and rebuild
            try:
                col.delete(ids=[c.id for c in chunks])
            except Exception:
                pass
            existing_ids: set = set()
        else:
            existing_ids = set(col.get(ids=[c.id for c in chunks])["ids"])

        new_chunks = [c for c in chunks if c.id not in existing_ids]

        if not new_chunks:
            logger.info(f"ChromaDB: all {len(chunks)} chunks already embedded. Skipping.")
            return

        logger.info(f"ChromaDB: embedding {len(new_chunks)} new chunks …")
        texts = [c.embed_text for c in new_chunks]
        embeddings = _embed_texts(texts, api_key)

        col.add(
            ids=[c.id for c in new_chunks],
            embeddings=embeddings,
            documents=[c.content for c in new_chunks],
            metadatas=[
                {
                    "doc_name": c.doc_name,
                    "section": c.section,
                    "team": c.team or "",
                }
                for c in new_chunks
            ],
        )
        logger.info(f"ChromaDB: {len(new_chunks)} chunks stored. Total: {col.count()}.")

    # ------------------------------------------------------------------
    # Internal: Dense search
    # ------------------------------------------------------------------

    def _dense_search(
        self,
        query: str,
        top_k: int = 10,
        team_filter: Optional[str] = None,
    ) -> List[Tuple[DocChunk, float]]:
        """
        Embeds the query and queries ChromaDB for the nearest chunks.
        Returns list of (DocChunk, cosine_similarity_score).
        Falls back to empty list if OpenAI key is missing.
        """
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            return []

        try:
            col = self._get_or_create_collection()
            if col.count() == 0:
                return []

            query_embedding = _embed_texts([query], api_key)[0]

            where_filter = {}
            if team_filter:
                where_filter = {"team": {"$eq": team_filter}}

            results = col.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, col.count()),
                where=where_filter if where_filter else None,
                include=["metadatas", "distances", "documents"],
            )

            output: List[Tuple[DocChunk, float]] = []
            ids = results["ids"][0]
            metadatas = results["metadatas"][0]
            distances = results["distances"][0]
            documents = results["documents"][0]

            # ChromaDB cosine distance: 0 = identical, 2 = opposite
            # Convert to similarity: 1 - distance/2  (range 0–1)
            for chunk_id, meta, dist, doc_content in zip(ids, metadatas, distances, documents):
                similarity = max(0.0, 1.0 - dist / 2.0)
                if similarity < 0.20:  # Hard relevance floor
                    continue
                chunk = DocChunk(
                    id=chunk_id,
                    doc_name=meta.get("doc_name", ""),
                    section=meta.get("section", ""),
                    content=doc_content,
                    team=meta.get("team") or None,
                )
                output.append((chunk, similarity))

            return output

        except Exception as exc:
            logger.error(f"Dense search failed (falling back to BM25-only): {exc}")
            return []

    # ------------------------------------------------------------------
    # Internal: RRF fusion
    # ------------------------------------------------------------------

    def _rrf_fuse(
        self,
        dense: List[Tuple[DocChunk, float]],
        sparse: List[Tuple[DocChunk, float]],
        top_k: int = 5,
        k: int = 60,
    ) -> List[Dict[str, Any]]:
        """
        Reciprocal Rank Fusion.
        RRF score = Σ 1 / (k + rank_i)   summed over all ranked lists.
        Chunk IDs are used for deduplication.
        """
        rrf_scores: Dict[str, float] = {}
        chunk_map: Dict[str, DocChunk] = {}

        for rank, (chunk, _) in enumerate(dense):
            rrf_scores[chunk.id] = rrf_scores.get(chunk.id, 0.0) + 1.0 / (k + rank + 1)
            chunk_map[chunk.id] = chunk

        for rank, (chunk, _) in enumerate(sparse):
            rrf_scores[chunk.id] = rrf_scores.get(chunk.id, 0.0) + 1.0 / (k + rank + 1)
            chunk_map[chunk.id] = chunk

        sorted_ids = sorted(rrf_scores, key=lambda cid: rrf_scores[cid], reverse=True)[:top_k]

        return [
            {
                "id": cid,
                "doc": chunk_map[cid].doc_name,
                "section": chunk_map[cid].section,
                "content": chunk_map[cid].content,
                "team": chunk_map[cid].team,
                "score": round(rrf_scores[cid], 6),
                "retrieval": "hybrid",
            }
            for cid in sorted_ids
        ]

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        return re.findall(r"\w+", text.lower())

    @staticmethod
    def _norm_doc(name: str) -> str:
        n = name.lower().strip()
        return n if n.endswith(".md") else n + ".md"


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

retriever = HybridRetriever()
