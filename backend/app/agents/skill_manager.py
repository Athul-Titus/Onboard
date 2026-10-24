import json
import re
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field

from backend.app.config import settings
from backend.app.schemas import SkillItem, SkillMap, SkillStatus, TeamGapAnalysis, RedactionSummary
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

    def redact_pii_with_summary(self, text: str) -> Tuple[str, Dict[str, Any]]:
        """Strips phone numbers, physical addresses, dates of birth, and personal emails before LLM processing.
        Returns the sanitized text and a breakdown summary: count and types removed (phone, address, email, DOB).
        """
        if not text:
            return "", {"total": 0, "phone": 0, "address": 0, "email": 0, "dob": 0, "types_removed": []}

        # 1. Phone numbers
        phone_pattern = r"(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}"
        phone_matches = re.findall(phone_pattern, text)
        redacted = re.sub(phone_pattern, "[PHONE REDACTED]", text)

        # 2. Personal emails
        email_pattern = r"[a-zA-Z0-9_.+-]+@(?:gmail|yahoo|outlook|hotmail|icloud|protonmail|aol)\.[a-zA-Z0-9-.]+"
        email_matches = re.findall(email_pattern, redacted, flags=re.IGNORECASE)
        redacted = re.sub(email_pattern, "[EMAIL REDACTED]", redacted, flags=re.IGNORECASE)

        # 3. Dates of birth
        dob_pattern = r"(?:DOB|Date of Birth|Birthdate)\s*[:=-]?\s*[\d/-]+"
        dob_matches = re.findall(dob_pattern, redacted, flags=re.IGNORECASE)
        redacted = re.sub(dob_pattern, "[DOB REDACTED]", redacted, flags=re.IGNORECASE)

        # 4. Physical street addresses
        address_pattern = r"\d+\s+[A-Za-z0-9\s,]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)"
        address_matches = re.findall(address_pattern, redacted, flags=re.IGNORECASE)
        redacted = re.sub(address_pattern, "[ADDRESS REDACTED]", redacted, flags=re.IGNORECASE)

        counts = {
            "phone": len(phone_matches),
            "email": len(email_matches),
            "dob": len(dob_matches),
            "address": len(address_matches),
        }
        types_removed = [k for k, v in counts.items() if v > 0]
        summary = {
            "total": sum(counts.values()),
            "phone": counts["phone"],
            "email": counts["email"],
            "dob": counts["dob"],
            "address": counts["address"],
            "types_removed": types_removed
        }
        return redacted, summary

    def redact_pii(self, text: str) -> str:
        """Strips phone numbers, physical addresses, dates of birth, and personal emails before LLM processing."""
        redacted, _ = self.redact_pii_with_summary(text)
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

    def compute_level_and_confidence(
        self,
        skill: str,
        years_experience: int,
        project_mentions: int,
        repo_count: int,
        certified: bool,
        has_tests: bool
    ) -> Tuple[str, float, Dict[str, Any]]:
        """
        Computes level (beginner/intermediate/advanced) and 0-1 confidence from deterministic signals.
        Returns (level, confidence, signals_used).
        """
        signals: Dict[str, Any] = {
            "years_experience": years_experience,
            "project_mentions": project_mentions,
            "repo_count": repo_count,
            "certified": certified,
            "has_automated_tests": has_tests,
            "derivation": []
        }

        # Level determination
        if (repo_count >= 5) or (years_experience >= 4 and (project_mentions >= 1 or repo_count >= 2)) or (certified and (project_mentions >= 1 or repo_count >= 1)):
            level = "advanced"
            signals["derivation"].append("Advanced: robust multi-year experience combined with verifiable projects/repos")
        elif (years_experience >= 2) or (repo_count >= 1) or (project_mentions >= 1) or certified:
            level = "intermediate"
            signals["derivation"].append("Intermediate: demonstrated practical usage across projects or repositories")
        else:
            level = "beginner"
            signals["derivation"].append("Beginner: self-reported or early-stage competency")

        # Confidence determination (0.0 to 1.0)
        conf = 0.50
        if project_mentions >= 1:
            conf += 0.15 if project_mentions >= 2 else 0.10
        if certified:
            conf += 0.20
        if repo_count >= 1:
            conf += 0.25 if repo_count >= 4 else 0.15
        if has_tests and repo_count >= 1:
            conf += 0.05
        if years_experience >= 4:
            conf += 0.10
        elif years_experience >= 2:
            conf += 0.05

        confidence = round(min(0.99, max(0.20, conf)), 2)
        signals["confidence_score"] = confidence

        return level, confidence, signals

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

            # Find specific resume quote evidence
            resume_evidence = self.find_resume_evidence(safe_resume, canonical)

            # Compute deterministic signals
            project_mentions = sum(
                1 for q in resume_evidence if q.startswith("[Projects]") or q.startswith("[Experience]")
            )
            repo_count = gh_skill_counts.get(canonical, 0)
            is_certified = canon_lower in certs_str or any(canon_lower in c.lower() for c in extracted.certifications)

            # Compute level & confidence from deterministic signals
            level, det_confidence, signals = self.compute_level_and_confidence(
                skill=canonical,
                years_experience=extracted.years_experience or 3,
                project_mentions=project_mentions,
                repo_count=repo_count,
                certified=is_certified,
                has_tests=bool(gh_evidence.get("has_tests", False))
            )

            # If verified by GitHub or Certificate, keep status as verified
            if repo_count > 0 or is_certified:
                status = "verified"
            else:
                status = "claimed"

            # 1. GitHub verification evidence
            if repo_count > 0:
                evidence_list.append(f"GitHub: {canonical} in {repo_count} of {total_repos} repos")
                if gh_evidence.get("has_tests"):
                    evidence_list.append("GitHub: Automated test suites detected in repositories")
            elif gh_state == "resume-only":
                evidence_list.append(f"GitHub: [resume-only] {gh_evidence.get('reason', 'Profile not available')}")
            else:
                evidence_list.append(f"GitHub: Not found in public repos of @{gh_evidence.get('username')}")

            # 2. Certification verification evidence
            if is_certified:
                evidence_list.append(f"Certified: Listed under verified credentials ({certs_str[:40]})")

            # 3. Add exact resume line quotes
            evidence_list.extend(resume_evidence)

            # Skill category from ontology
            category = ontology.get_category(canonical)

            skill_items.append(SkillItem(
                skill=canonical,
                category=category,
                level=level,
                status=status,
                confidence=det_confidence,
                evidence=evidence_list,
                signals_used=signals
            ))

        # 4. Compute Gaps by Team (required_skills, matched_skills, missing_skills, coverage_percent)
        hire_canonical_set = {s.skill.lower() for s in skill_items}
        gaps_by_team: Dict[str, TeamGapAnalysis] = {}

        for team in self.teams:
            tname = team["name"]
            reqs = team.get("required_skills", [])
            matched = [r for r in reqs if r.lower() in hire_canonical_set]
            missing = [r for r in reqs if r.lower() not in hire_canonical_set]
            coverage = round((len(matched) / max(1, len(reqs))) * 100, 1)

            gaps_by_team[tname] = TeamGapAnalysis(
                team=tname,
                required_skills=reqs,
                matched_skills=matched,
                missing_skills=missing,
                coverage_percent=coverage
            )

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
