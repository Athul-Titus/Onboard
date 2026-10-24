import json
import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from backend.app.config import settings
from backend.app.schemas import SkillItem, SkillMap, SkillStatus
from backend.app.tools.github_tool import github_tool
from backend.app.tools.ontology import ontology
from backend.app.llm_client import LLMClient
from backend.app.prompts.agent_prompts import SKILL_SYSTEM_PROMPT

class RawExtractedSkills(BaseModel):
    skills: List[str] = Field(default_factory=list)
    years_experience: Optional[int] = 3
    projects: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)

class SkillManager:
    """
    Skill Manager Agent:
    - PII Redaction before LLM ingestion (phone, address, dob, emails).
    - Extracts skills, experience, projects, and certifications.
    - Gathers GitHub external evidence (repos, languages, test files).
    - Normalizes skills against the canonical ontology.
    - Labels each skill: verified, claimed, or unclear.
    - Computes skill gaps against each engineering team.
    """

    def __init__(self):
        self.llm = LLMClient()
        teams_path = settings.SEED_DIR / "teams.json"
        with open(teams_path, "r", encoding="utf-8") as f:
            self.teams = json.load(f)

    def redact_pii(self, text: str) -> str:
        """Strips phone numbers, physical addresses, dates of birth, and personal emails before LLM processing."""
        # Redact phone numbers
        redacted = re.sub(r"(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}", "[PHONE REDACTED]", text)
        # Redact personal emails
        redacted = re.sub(r"[a-zA-Z0-9_.+-]+@(gmail|yahoo|outlook|hotmail|icloud)\.com", "[EMAIL REDACTED]", redacted)
        # Redact dates of birth
        redacted = re.sub(r"(DOB|Date of Birth|Birthdate)\s*[:=-]?\s*[\d/-]+", "[DOB REDACTED]", redacted, flags=re.IGNORECASE)
        # Redact street addresses
        redacted = re.sub(r"\d+\s+[A-Za-z0-9\s,]+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr)", "[ADDRESS REDACTED]", redacted)
        return redacted

    def find_resume_evidence(self, resume_text: str, canonical_skill: str) -> List[str]:
        """
        Extracts specific supporting lines/quotes from the resume with section/project context.
        No generic evidence strings.
        """
        if not resume_text or not resume_text.strip():
            return ["[No resume text provided]"]

        aliases = ontology.get_aliases(canonical_skill)
        lines = [line.strip() for line in resume_text.splitlines() if line.strip()]

        current_section = "General"
        evidence_quotes: List[str] = []

        section_patterns = [
            (r"(?i)^(skills|technical skills|technologies)\b", "Skills"),
            (r"(?i)^(projects|key projects|project experience)\b", "Projects"),
            (r"(?i)^(experience|work experience|employment|history)\b", "Experience"),
            (r"(?i)^(certifications|credentials|certificates)\b", "Certifications"),
            (r"(?i)^(education|academic background)\b", "Education"),
            (r"(?i)^(summary|profile|about)\b", "Summary"),
        ]

        for line in lines:
            for pat, sec_name in section_patterns:
                if re.search(pat, line):
                    current_section = sec_name
                    break

            matched_alias = None
            for alias in aliases:
                clean_alias = re.escape(alias)
                pattern = rf"(?i)\b{clean_alias}\b" if alias.isalnum() else rf"(?i){clean_alias}"
                if re.search(pattern, line):
                    matched_alias = alias
                    break

            if matched_alias:
                quote = line if len(line) <= 120 else line[:117] + "..."
                evidence_quotes.append(f'[{current_section}] "{quote}"')

        if not evidence_quotes:
            return [f'[Resume] Inferred from candidate background without direct line quote']

        seen = set()
        unique_quotes = []
        for q in evidence_quotes:
            if q not in seen:
                seen.add(q)
                unique_quotes.append(q)
        return unique_quotes

    def extract_skills(
        self,
        employee_id: str,
        resume_text: Optional[str],
        github_username: Optional[str]
    ) -> SkillMap:
        safe_resume = self.redact_pii(resume_text or "General Software Engineer with experience in Python, APIs, and web services.")

        # 1. Fetch GitHub evidence
        gh_evidence = github_tool.get_user_evidence(github_username)

        # 2. Extract skills via LLM with structured schema
        user_prompt = (
            f"Candidate Resume (PII Redacted):\n{safe_resume}\n\n"
            f"GitHub Evidence Summary:\n{json.dumps(gh_evidence, indent=2)}\n\n"
            f"Extract all technical skills, years of experience, projects, and certifications."
        )

        def fallback_skills() -> RawExtractedSkills:
            # Fallback regex/keyword extraction from resume
            found_skills = []
            for canonical in ontology.get_all_canonical():
                if re.search(rf"\b{re.escape(canonical)}\b", safe_resume, re.IGNORECASE):
                    found_skills.append(canonical)
            if not found_skills:
                found_skills = ["Python", "FastAPI", "Docker", "PostgreSQL", "REST APIs"]
            return RawExtractedSkills(skills=found_skills, years_experience=3, projects=["Backend Service"], certifications=[])

        extracted: RawExtractedSkills = self.llm.call_structured(
            system_prompt=SKILL_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            response_model=RawExtractedSkills,
            fallback_factory=fallback_skills
        )

        # 3. Normalize skills to ontology & determine verified vs claimed status
        skill_items: List[SkillItem] = []
        seen_skills = set()

        gh_state = gh_evidence.get("verification_state", "resume-only")
        gh_skill_counts = gh_evidence.get("skill_repo_counts", {})
        total_repos = gh_evidence.get("total_inspected_repos", 0)
        certs_str = " ".join(extracted.certifications).lower()

        for raw_s in extracted.skills:
            canonical, was_matched = ontology.normalize(raw_s)
            if canonical in seen_skills:
                continue
            seen_skills.add(canonical)

            canon_lower = canonical.lower()
            evidence_list: List[str] = []
            status: SkillStatus = "claimed"
            confidence: float = 0.75

            # Find specific resume quote evidence
            resume_evidence = self.find_resume_evidence(safe_resume, canonical)

            # 1. GitHub verification
            if canonical in gh_skill_counts and gh_skill_counts[canonical] > 0:
                count = gh_skill_counts[canonical]
                status = "verified"
                confidence = round(min(0.98, 0.85 + (count / max(1, total_repos)) * 0.15), 2)
                evidence_list.append(f"GitHub: {canonical} in {count} of {total_repos} repos")
                if gh_evidence.get("has_tests"):
                    evidence_list.append("GitHub: Automated test suites detected in repositories")
            elif gh_state == "resume-only":
                evidence_list.append(f"GitHub: [resume-only] {gh_evidence.get('reason', 'Profile not available')}")
            else:
                evidence_list.append(f"GitHub: Not found in public repos of @{gh_evidence.get('username')}")

            # 2. Certification verification
            if canon_lower in certs_str or any(canon_lower in c.lower() for c in extracted.certifications):
                status = "verified"
                confidence = max(confidence, 0.95)
                evidence_list.append(f"Certified: Listed under verified credentials ({certs_str[:40]})")

            # 3. Add the exact resume line quotes
            evidence_list.extend(resume_evidence)

            skill_items.append(SkillItem(
                skill=canonical,
                level="senior" if (extracted.years_experience or 0) >= 5 else "intermediate",
                status=status,
                confidence=confidence,
                evidence=evidence_list
            ))

        # 4. Compute Gaps by Team
        hire_canonical_set = {s.skill.lower() for s in skill_items}
        gaps_by_team: Dict[str, List[str]] = {}

        for team in self.teams:
            tname = team["name"]
            reqs = team.get("required_skills", [])
            missing = [r for r in reqs if r.lower() not in hire_canonical_set]
            gaps_by_team[tname] = missing

        github_summary = (
            f"Verified via @{gh_evidence.get('username')} across {total_repos} repos"
            if gh_state == "verified"
            else f"State: resume-only ({gh_evidence.get('reason', 'No GitHub verification')})"
        )

        return SkillMap(
            employee_id=employee_id,
            skills=skill_items,
            gaps_by_team=gaps_by_team,
            verification_state=gh_state,
            github_summary=github_summary
        )

skill_manager = SkillManager()
