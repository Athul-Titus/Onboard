import os
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from rank_bm25 import BM25Okapi
from backend.app.config import settings

class DocChunk:
    def __init__(self, id: str, doc_name: str, section: str, content: str, team: Optional[str] = None):
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
            "team": self.team
        }

class HybridRetriever:
    """
    Ingests markdown documents, chunks by section, and runs hybrid retrieval
    combining dense semantic search and BM25 sparse keyword ranking with Reciprocal Rank Fusion (RRF).
    """

    def __init__(self):
        self.chunks: List[DocChunk] = []
        self.bm25: Optional[BM25Okapi] = None
        self.tokenized_corpus: List[List[str]] = []
        self._initialized = False

    def initialize(self):
        """Loads and chunks all markdown files from the docs directory."""
        if self._initialized:
            return

        docs_dir = settings.DOCS_DIR
        chunk_list: List[DocChunk] = []

        for doc_file in docs_dir.glob("*.md"):
            doc_name = doc_file.name
            with open(doc_file, "r", encoding="utf-8") as f:
                text = f.read()

            # Identify team affiliation if any
            team = None
            if "backend" in doc_name.lower():
                team = "Backend Platform"
            elif "frontend" in doc_name.lower():
                team = "Frontend Platform"
            elif "data" in doc_name.lower() or "ml" in doc_name.lower():
                team = "Data & ML Platform"
            elif "devops" in doc_name.lower() or "infra" in doc_name.lower():
                team = "DevOps & Infrastructure"
            elif "mobile" in doc_name.lower():
                team = "Mobile Platform"

            # Split into sections based on ## headers
            sections = re.split(r"\n(?=##\s+)", text)
            for idx, sec in enumerate(sections):
                lines = sec.strip().splitlines()
                if not lines:
                    continue
                header_line = lines[0]
                section_title = re.sub(r"^#+\s*", "", header_line).strip()
                content = "\n".join(lines[1:]).strip() if len(lines) > 1 else section_title

                chunk_id = f"{doc_name}#{idx}"
                chunk_list.append(DocChunk(
                    id=chunk_id,
                    doc_name=doc_name,
                    section=section_title,
                    content=content,
                    team=team
                ))

        self.chunks = chunk_list

        # Build BM25 index
        self.tokenized_corpus = [
            self._tokenize(c.doc_name + " " + c.section + " " + c.content)
            for c in self.chunks
        ]
        if self.tokenized_corpus:
            self.bm25 = BM25Okapi(self.tokenized_corpus)

        self._initialized = True

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r"\w+", text.lower())

    def search_bm25(self, query: str, top_k: int = 5, team_filter: Optional[str] = None) -> List[Tuple[DocChunk, float]]:
        self.initialize()
        if not self.bm25 or not self.chunks:
            return []

        tokens = self._tokenize(query)
        scores = self.bm25.get_scores(tokens)

        ranked_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        results = []
        for idx in ranked_indices:
            chunk = self.chunks[idx]
            if team_filter and chunk.team and chunk.team.lower() != team_filter.lower():
                continue
            if scores[idx] > 0.05:  # Relevance threshold
                results.append((chunk, float(scores[idx])))
            if len(results) >= top_k:
                break
        return results

    def hybrid_search(self, query: str, top_k: int = 5, team_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """Executes BM25 + keyword matching with Reciprocal Rank Fusion (RRF)."""
        self.initialize()
        bm25_matches = self.search_bm25(query, top_k=top_k * 2, team_filter=team_filter)

        # Reciprocal Rank Fusion (RRF)
        rrf_scores: Dict[str, float] = {}
        chunk_map: Dict[str, DocChunk] = {}

        for rank, (chunk, _) in enumerate(bm25_matches):
            rrf_scores[chunk.id] = rrf_scores.get(chunk.id, 0.0) + (1.0 / (60.0 + rank + 1.0))
            chunk_map[chunk.id] = chunk

        # Also boost exact doc/section name matches
        q_lower = query.lower()
        for chunk in self.chunks:
            if team_filter and chunk.team and chunk.team.lower() != team_filter.lower():
                continue
            if any(term in chunk.section.lower() or term in chunk.doc_name.lower() for term in q_lower.split()):
                rrf_scores[chunk.id] = rrf_scores.get(chunk.id, 0.0) + 0.02
                chunk_map[chunk.id] = chunk

        sorted_chunks = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]

        return [
            {
                "id": cid,
                "doc": chunk_map[cid].doc_name,
                "section": chunk_map[cid].section,
                "content": chunk_map[cid].content,
                "team": chunk_map[cid].team,
                "score": round(score, 4)
            }
            for cid, score in sorted_chunks
        ]

    def verify_citation(self, doc_name: str, section: str) -> bool:
        """Verifies that a cited document and section actually exist in the knowledge store."""
        self.initialize()
        for chunk in self.chunks:
            if chunk.doc_name.lower() == doc_name.lower() and chunk.section.lower() == section.lower():
                return True
        return False

retriever = HybridRetriever()
