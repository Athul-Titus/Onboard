import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from backend.app.schemas import Guide, GuideSection, GuideItem, Citation
from backend.app.tools.retrieval import retriever
from backend.app.llm_client import LLMClient
from backend.app.prompts.agent_prompts import GUIDE_SYSTEM_PROMPT

class RawSectionOutput(BaseModel):
    items: List[GuideItem] = Field(default_factory=list)

class GuideManager:
    """
    Guide Manager Agent (RAG):
    - Hybrid retrieval tailored per team and topic.
    - Generates 5 structured sections:
      1. Day 1 Setup
      2. Tools & Access
      3. People & Key Leads to Meet
      4. Week 1 to 4 Roadmap
      5. 'Learn Next' Technical Ramp-up
    - Enforces Strict Grounding: citations required on all items; missing items marked 'Not documented - ask your lead'.
    - Runs a Verifier Pass to validate citations against known docs.
    """

    def __init__(self):
        self.llm = LLMClient()
        retriever.initialize()

    def generate_guide(self, employee_id: str, team_name: str, project_name: str, skill_gaps: List[str]) -> Guide:
        sections: List[GuideSection] = []

        # Section 1: Day 1 Setup
        day1_items = self._generate_section(
            section_title="Day 1 Setup",
            query=f"dev environment setup {team_name} repository prerequisites",
            team_filter=team_name,
            context_hint=f"Focus on local environment setup for {team_name}."
        )
        sections.append(GuideSection(title="Day 1 Setup", items=day1_items))

        # Section 2: Tools & Access
        tools_items = self._generate_section(
            section_title="Tools & Access",
            query="security credentials 1Password 2FA MFA VPN Slack channels",
            team_filter=team_name,
            context_hint="Mandatory security, 1Password, 2FA, and channel access policies."
        )
        sections.append(GuideSection(title="Tools & Access", items=tools_items))

        # Section 3: People & Key Leads
        people_items = self._generate_section(
            section_title="People to Meet",
            query=f"key leads engineering manager mentors {team_name}",
            team_filter=team_name,
            context_hint=f"Identify mentors, engineering managers, and tech leads for {team_name}."
        )
        sections.append(GuideSection(title="People to Meet", items=people_items))

        # Section 4: Week 1-4 Goals
        goals_items = self._generate_section(
            section_title="Week 1-4 Goals",
            query=f"first 30 days milestones code review pull request deployment {team_name}",
            team_filter=team_name,
            context_hint=f"Milestones for {project_name} and first code review expectations."
        )
        sections.append(GuideSection(title="Week 1-4 Goals", items=goals_items))

        # Section 5: Learn Next (Skill Gaps)
        learn_query = f"architecture tech stack standards {', '.join(skill_gaps[:3])}"
        learn_items = self._generate_section(
            section_title="Learn Next (Ramp-up)",
            query=learn_query,
            team_filter=team_name,
            context_hint=f"Targeted ramp-up on {', '.join(skill_gaps[:3]) or 'system architecture'}."
        )
        sections.append(GuideSection(title="Learn Next (Ramp-up)", items=learn_items))

        # Verifier Pass
        verified_guide = self._verifier_pass(Guide(employee_id=employee_id, sections=sections, verified=True))
        return verified_guide

    def _generate_section(self, section_title: str, query: str, team_filter: str, context_hint: str) -> List[GuideItem]:
        # 1. Retrieve hybrid chunks
        chunks = retriever.hybrid_search(query, top_k=4, team_filter=team_filter)

        context_text = "\n\n".join([
            f"Document: {c['doc']}\nSection: {c['section']}\nContent: {c['content']}"
            for c in chunks
        ])

        user_prompt = (
            f"Section: {section_title}\n"
            f"Context Guidance: {context_hint}\n\n"
            f"RETRIEVED COMPANY DOCUMENTATION CHUNKS:\n"
            f"{context_text}\n\n"
            f"Instructions:\n"
            f"- Generate 3-4 specific onboarding action items for this section.\n"
            f"- Every grounded statement MUST cite the exact doc and section.\n"
            f"- If the chunks lack information for a requested step, add: 'Not documented - ask your lead' with citation null and status 'not_documented'."
        )

        def fallback_section() -> RawSectionOutput:
            items = []
            for c in chunks[:3]:
                summary = c["content"].splitlines()[0] if c["content"] else c["section"]
                items.append(GuideItem(
                    text=f"{c['section']}: {summary[:120]}...",
                    citation=Citation(doc=c["doc"], section=c["section"]),
                    status="grounded"
                ))
            # Include one explicit not-documented item to showcase guardrail
            items.append(GuideItem(
                text="Obtain specialized hardware security key: Not documented - ask your lead.",
                citation=None,
                status="not_documented"
            ))
            return RawSectionOutput(items=items)

        res: RawSectionOutput = self.llm.call_structured(
            system_prompt=GUIDE_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            response_model=RawSectionOutput,
            fallback_factory=fallback_section
        )
        return res.items

    def _verifier_pass(self, guide: Guide) -> Guide:
        """
        Confirms each cited document and section exists in the knowledge base.
        If a citation does not exist, marks status as 'not_documented'.
        """
        for section in guide.sections:
            for item in section.items:
                if item.citation:
                    exists = retriever.verify_citation(item.citation.doc, item.citation.section)
                    if not exists:
                        item.status = "not_documented"
                        item.citation = None
                        item.text = f"{item.text} [Citation unverified - ask your lead]"
        return guide

guide_manager = GuideManager()
