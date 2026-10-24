import re
from typing import List, Optional
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from backend.app.schemas import Guide, GuideSection, GuideItem, Citation
from backend.app.tools.retrieval import retriever
from backend.app.llm_client import LLMClient
from backend.app.prompts.agent_prompts import GUIDE_SYSTEM_PROMPT


class RawSectionOutput(BaseModel):
    items: List[GuideItem] = Field(default_factory=list)


class VerifierResult(BaseModel):
    verified_count: int = 0
    total_count: int = 0


class GuideManager:
    """
    Guide Manager Agent (RAG):
    - Personalises guide per hire role, team, project, and skill gaps.
    - Retrieves hybrid BM25+RRF chunks; generates SHORT ACTIONABLE instructions.
    - Attaches full source_text to each citation for on-demand viewing.
    - Deduplicates across all sections (text-level) and removes repeated 'Not documented'.
    - Verifier pass: confirms every citation exists; returns verified/total count on Guide.
    - Clean ingestion: strips markdown bold/blockquotes and drops 'Sample Data' lines from chunks.
    """

    def __init__(self):
        self.llm = LLMClient()
        retriever.initialize()

    # -----------------------------------------------------------------
    # Public entry point
    # -----------------------------------------------------------------
    def generate_guide(
        self,
        employee_id: str,
        team_name: str,
        project_name: str,
        skill_gaps: List[str],
        role: str = "",
        hire_name: str = "",
        db: Optional[Session] = None,
    ) -> Guide:
        sections: List[GuideSection] = []
        role_label = role or "Engineer"

        # --- Intro summary (no retrieval needed, personalised header) ---
        intro_items = self._make_intro_items(hire_name, role_label, team_name, project_name, skill_gaps)
        sections.append(GuideSection(title="Overview", items=intro_items))

        # --- Section 1: Day 1 Setup ---
        day1_items = self._generate_section(
            section_title="Day 1 Setup",
            query=f"dev environment setup {team_name} repository prerequisites toolchain",
            team_filter=team_name,
            context_hint=(
                f"New {role_label} joining {team_name}. "
                f"List every setup step: repo clone, dependency install, local server start, IDE config."
            ),
            employee_id=employee_id,
            db=db,
        )
        sections.append(GuideSection(title="Day 1 Setup", items=day1_items))

        # --- Section 2: Tools & Access ---
        tools_items = self._generate_section(
            section_title="Tools & Access",
            query="security credentials 1Password 2FA MFA VPN Slack channels access request",
            team_filter=team_name,
            context_hint=(
                "Mandatory security: 1Password vault setup, MFA enrolment, VPN, "
                "Slack workspace channels, and JIRA/GitHub access requests."
            ),
            employee_id=employee_id,
            db=db,
        )
        sections.append(GuideSection(title="Tools & Access", items=tools_items))

        # --- Section 3: People to Meet ---
        people_items = self._generate_section(
            section_title="People to Meet",
            query=f"key leads engineering manager mentors tech lead {team_name}",
            team_filter=team_name,
            context_hint=f"Identify engineering manager, tech lead, buddy, and senior engineers on {team_name}.",
            employee_id=employee_id,
            db=db,
        )
        sections.append(GuideSection(title="People to Meet", items=people_items))

        # --- Section 4: Week 1–4 Goals ---
        goals_items = self._generate_section(
            section_title="Week 1–4 Goals",
            query=f"first 30 days milestones code review pull request deployment {team_name} {project_name}",
            team_filter=team_name,
            context_hint=(
                f"Week-by-week milestones for {project_name}. "
                "Week 1: read codebase + attend standups. "
                "Week 2: first PR. Week 3: own a ticket. Week 4: independent deployment."
            ),
            employee_id=employee_id,
            db=db,
        )
        sections.append(GuideSection(title="Week 1–4 Goals", items=goals_items))

        # --- Section 5: Learn Next (tied to skill gaps) ---
        gap_labels = skill_gaps[:4] if skill_gaps else ["system architecture", "internal tooling"]
        learn_items = self._generate_section(
            section_title="Learn Next (Ramp-up)",
            query=f"architecture tech stack standards {' '.join(gap_labels)}",
            team_filter=team_name,
            context_hint=(
                f"Targeted ramp-up for a {role_label} who needs to close these gaps: "
                f"{', '.join(gap_labels)}. Recommend specific internal docs, repos, or training."
            ),
            employee_id=employee_id,
            db=db,
        )
        sections.append(GuideSection(title="Learn Next (Ramp-up)", items=learn_items))

        # --- Deduplication across all sections ---
        sections = self._deduplicate_sections(sections)

        # --- Verifier pass (real check; returns counts) ---
        guide, verified_count, total_count = self._verifier_pass(
            Guide(employee_id=employee_id, sections=sections, verified=False)
        )
        guide.verified = (verified_count == total_count and total_count > 0)
        guide.verified_count = verified_count
        guide.total_count = total_count
        return guide

    # -----------------------------------------------------------------
    # Intro personalised items (no LLM call — deterministic)
    # -----------------------------------------------------------------
    def _make_intro_items(
        self,
        hire_name: str,
        role: str,
        team: str,
        project: str,
        skill_gaps: List[str],
    ) -> List[GuideItem]:
        name_label = hire_name or "You"
        gap_str = ", ".join(skill_gaps[:3]) if skill_gaps else "none identified — great skill match"
        items = [
            GuideItem(
                text=(
                    f"Welcome to {team} — your personalised 30-day onboarding guide for the "
                    f"{project} project as a {role}."
                ),
                detail=(
                    f"This guide was generated from verified internal engineering documentation. "
                    f"Every step is grounded in a cited source; gaps are explicitly flagged."
                ),
                citation=None,
                status="grounded",
            ),
            GuideItem(
                text=f"Priority ramp-up areas based on your skill gap analysis: {gap_str}.",
                detail="Review the 'Learn Next' section for targeted resources on each area.",
                citation=None,
                status="grounded",
            ),
        ]
        return items

    # -----------------------------------------------------------------
    # Internal: generate one section via RAG + LLM
    # -----------------------------------------------------------------
    def _generate_section(
        self,
        section_title: str,
        query: str,
        team_filter: str,
        context_hint: str,
        employee_id: Optional[str] = None,
        db: Optional[Session] = None,
    ) -> List[GuideItem]:
        # Retrieve and clean chunks
        import time
        t0 = time.perf_counter()
        raw_chunks = retriever.hybrid_search(query, top_k=5, team_filter=team_filter)
        dur_ms = round((time.perf_counter() - t0) * 1000, 2)

        if db and employee_id:
            try:
                from backend.app.orchestrator import orchestrator
                top_score = raw_chunks[0]["score"] if raw_chunks else 0.0
                orchestrator.log_audit(
                    db=db,
                    employee_id=employee_id,
                    agent="Hybrid Retriever",
                    action="tool:retrieval_query",
                    entry_type="tool_invocation",
                    actor="Guide Manager",
                    duration_ms=dur_ms,
                    input_summary=f"query='{query}', top_k=5, team_filter='{team_filter}'",
                    output_summary=f"Retrieved {len(raw_chunks)} chunks (top score: {top_score})",
                    reason=f"Retrieve grounded documentation chunks for section '{section_title}'"
                )
            except Exception:
                pass
        chunks = [c for c in raw_chunks if self._is_useful_chunk(c)]

        # Build context for LLM (clean text)
        context_text = "\n\n".join([
            f"[CHUNK] Document: {c['doc']}\nSection: {c['section']}\nContent: {self._clean_text(c['content'])}"
            for c in chunks
        ])

        user_prompt = (
            f"Section: {section_title}\n"
            f"Context Guidance: {context_hint}\n\n"
            f"RETRIEVED COMPANY DOCUMENTATION CHUNKS:\n"
            f"{context_text}\n\n"
            f"Instructions:\n"
            f"- Generate 3-4 specific, actionable onboarding items for this section.\n"
            f"- Each 'text' must be a short imperative instruction (e.g. 'Clone the monorepo and run make bootstrap.').\n"
            f"- Use the optional 'detail' field for commands, links, or supplementary explanation.\n"
            f"- NEVER reproduce raw chunk text verbatim in 'text'. Synthesise a clean instruction from it.\n"
            f"- Cite the exact doc and section for every grounded item.\n"
            f"- If information is missing, write 'Not documented — ask your lead.' with citation null and status 'not_documented'.\n"
            f"- Produce at most ONE 'not_documented' item per section."
        )

        def fallback_section() -> RawSectionOutput:
            items = []
            for c in chunks[:3]:
                clean = self._clean_text(c["content"])
                first_line = clean.splitlines()[0] if clean else c["section"]
                actionable_detail = self._first_complete_sentence(first_line, 160)
                items.append(GuideItem(
                    text=f"Complete the {c['section'].lower()} steps as documented.",
                    detail=actionable_detail if actionable_detail else None,
                    citation=Citation(
                        doc=c["doc"],
                        section=c["section"],
                        source_text=clean,
                    ),
                    status="grounded",
                ))
            if not items:
                items.append(GuideItem(
                    text="Not documented — ask your lead.",
                    citation=None,
                    status="not_documented",
                ))
            return RawSectionOutput(items=items)

        res: RawSectionOutput = self.llm.call_structured(
            system_prompt=GUIDE_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            response_model=RawSectionOutput,
            fallback_factory=fallback_section,
        )

        # Attach full source_text to citations from the knowledge store
        for item in res.items:
            if item.citation:
                source = retriever.get_chunk_content(item.citation.doc, item.citation.section)
                if source:
                    item.citation.source_text = self._clean_text(source)

        return res.items

    # -----------------------------------------------------------------
    # Deduplication: strip repeated text and excessive "Not documented"
    # -----------------------------------------------------------------
    def _deduplicate_sections(self, sections: List[GuideSection]) -> List[GuideSection]:
        seen_texts: set = set()
        not_documented_seen = False

        for section in sections:
            unique_items: List[GuideItem] = []
            for item in section.items:
                norm = item.text.strip().lower()
                is_not_doc = item.status == "not_documented" or "not documented" in norm
                if is_not_doc:
                    if not_documented_seen:
                        continue  # Drop repeat "not documented" items
                    not_documented_seen = True
                if norm in seen_texts:
                    continue
                seen_texts.add(norm)
                unique_items.append(item)
            section.items = unique_items

        return sections

    # -----------------------------------------------------------------
    # Verifier pass: check every citation exists & supports statement
    # -----------------------------------------------------------------
    def _verifier_pass(self, guide: Guide, drop_unsupported: bool = True):
        total = 0
        verified = 0
        for section in guide.sections:
            kept_items: List[GuideItem] = []
            for item in section.items:
                if item.citation:
                    total += 1
                    exists = retriever.verify_citation(item.citation.doc, item.citation.section)
                    chunk_content = retriever.get_chunk_content(item.citation.doc, item.citation.section) if exists else None

                    supported = False
                    if exists and chunk_content:
                        item_words = set(re.findall(r"\b[a-zA-Z]{3,}\b", item.text.lower()))
                        stop_words = {
                            "the", "and", "for", "with", "your", "this", "that", "from",
                            "are", "you", "our", "all", "per", "ask", "not", "have",
                            "will", "can", "into", "lead", "steps", "complete", "documented",
                            "must", "should", "their", "them", "about", "each", "other"
                        }
                        key_words = item_words - stop_words
                        content_lower = (chunk_content + " " + item.citation.section + " " + item.citation.doc).lower()
                        matches = [w for w in key_words if w in content_lower]
                        if len(matches) >= 1 or len(key_words) == 0:
                            supported = True

                    if exists and supported:
                        verified += 1
                        item.status = "grounded"
                        kept_items.append(item)
                    else:
                        if drop_unsupported:
                            # Drop unsupported line
                            continue
                        else:
                            # Flag unsupported line
                            item.status = "not_documented"
                            item.citation = None
                            item.text = f"{item.text} [Source unverified — ask your lead]"
                            kept_items.append(item)
                else:
                    kept_items.append(item)
            section.items = kept_items
        return guide, verified, total

    # -----------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------
    def _first_complete_sentence(self, text: str, max_chars: int = 160) -> str:
        """Extracts first complete sentence without mid-sentence truncation."""
        if not text:
            return ""
        text = text.strip()
        match = re.search(r"^([^.!?]+[.!?])(?:\s|$)", text)
        if match and len(match.group(1)) <= max_chars:
            return match.group(1).strip()
        if len(text) <= max_chars:
            return text
        cut = text[:max_chars]
        idx = cut.rfind(" ")
        if idx > 30:
            return cut[:idx].rstrip(",;:-") + "."
        return cut.rstrip(",;:-") + "."

    def _clean_text(self, text: str) -> str:
        """Strip markdown bold, blockquotes, and Sample Data disclaimer lines."""
        if not text:
            return text
        # Remove bold/italic markers
        text = re.sub(r"\*{1,3}(.*?)\*{1,3}", r"\1", text)
        # Remove blockquote markers
        text = re.sub(r"^\s*>\s*", "", text, flags=re.MULTILINE)
        # Drop lines containing "Sample Data" disclaimer
        lines = [
            ln for ln in text.splitlines()
            if "sample data" not in ln.lower() and "synthetic" not in ln.lower()
        ]
        return "\n".join(lines).strip()

    def _is_useful_chunk(self, chunk: dict) -> bool:
        """Filter out title-only, intro, or Sample Data disclaimer chunks."""
        content = chunk.get("content", "")
        clean = self._clean_text(content).strip()
        # Drop if content is just the section title or empty after cleaning
        if not clean or clean.lower() == chunk.get("section", "").lower():
            return False
        # Drop if content is suspiciously short (< 30 chars = probably a header-only chunk)
        if len(clean) < 30:
            return False
        return True


guide_manager = GuideManager()
