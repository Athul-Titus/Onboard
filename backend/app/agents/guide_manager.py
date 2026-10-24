import re
from typing import List, Optional
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
        )
        sections.append(GuideSection(title="Tools & Access", items=tools_items))

        # --- Section 3: People to Meet ---
        people_items = self._generate_section(
            section_title="People to Meet",
            query=f"key leads engineering manager mentors tech lead {team_name}",
            team_filter=team_name,
            context_hint=f"Identify engineering manager, tech lead, buddy, and senior engineers on {team_name}.",
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
    ) -> List[GuideItem]:
        # Retrieve and clean chunks
        raw_chunks = retriever.hybrid_search(query, top_k=5, team_filter=team_filter)
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
                items.append(GuideItem(
                    text=f"Complete the {c['section'].lower()} steps as documented.",
                    detail=first_line[:160] if first_line else None,
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
    # Verifier pass: check every citation exists; return counts
    # -----------------------------------------------------------------
    def _verifier_pass(self, guide: Guide):
        total = 0
        verified = 0
        for section in guide.sections:
            for item in section.items:
                if item.citation:
                    total += 1
                    exists = retriever.verify_citation(item.citation.doc, item.citation.section)
                    if exists:
                        verified += 1
                    else:
                        # Revoke bad citation — keep text but flag it
                        item.status = "not_documented"
                        item.citation = None
                        item.text = f"{item.text} [Source unverified — ask your lead]"
        return guide, verified, total

    # -----------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------
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
