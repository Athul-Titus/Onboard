import json
import logging
import re
from typing import List, Dict, Any, Optional, Union, Callable
from pydantic import BaseModel, Field

from backend.app.config import settings
from backend.app.schemas import (
    Assignment,
    TeamCandidate,
    ScoreBreakdown,
    StructuredRationale
)
from backend.app.tools.scoring import compute_team_scores
from backend.app.llm_client import LLMClient
from backend.app.prompts.agent_prompts import PROJECT_SYSTEM_PROMPT

logger = logging.getLogger("onboardos.project_manager")

class ProjectManager:
    """
    Project Manager Agent:
    - Runs deterministic scoring engine across all teams and projects.
    - Pure Python scoring; weights from settings (skill_match 0.45, gap_coverage 0.30, capacity 0.25, penalty 0.15).
    - Code-assigned fit labels: strong / moderate / weak / not_recommended.
    - Structured LLM rationale with a verification pass checking against actual matched/missing skills and numbers.
    - Automatic 1-retry with error feedback, and deterministic template fallback if verifier rejects.
    - Edge cases: insufficient_data, zero_capacity penalty, weak_fit, and close_call flags.
    """

    def __init__(self):
        self.llm = LLMClient()
        teams_path = settings.SEED_DIR / "teams.json"
        with open(teams_path, "r", encoding="utf-8") as f:
            self.teams = json.load(f)

        projects_path = settings.SEED_DIR / "projects.json"
        with open(projects_path, "r", encoding="utf-8") as f:
            self.projects = json.load(f)

    def _verify_rationale(
        self,
        rationale: StructuredRationale,
        candidate_data: Dict[str, Any]
    ) -> Optional[str]:
        """
        Verifier pass:
        1. Every skill in matched_skills must exist in the candidate's actual matched skills.
        2. Every skill in skills_to_learn must exist in the candidate's actual missing skills.
        3. No fabricated numbers in the text.
        Returns None if valid, or a descriptive error string if invalid.
        """
        valid_matched = {m["skill"].lower() for m in candidate_data.get("matched_skills", [])}
        valid_missing = {s.lower() for s in candidate_data.get("missing_skills", [])}

        # 1. Verify matched_skills
        for s in rationale.matched_skills:
            if s.lower() not in valid_matched:
                return (
                    f"Fabricated skill detected in matched_skills: '{s}'. "
                    f"Allowed matched skills for {candidate_data['team']} are: "
                    f"{[m['skill'] for m in candidate_data.get('matched_skills', [])]}."
                )

        # 2. Verify skills_to_learn
        for s in rationale.skills_to_learn:
            if s.lower() not in valid_missing:
                return (
                    f"Fabricated skill detected in skills_to_learn: '{s}'. "
                    f"Allowed missing skills for {candidate_data['team']} are: "
                    f"{candidate_data.get('missing_skills', [])}."
                )

        # 3. Quoted numbers & percentages verification
        # Any number or percentage quoted must match deterministic metrics in candidate_data
        display_score = candidate_data.get("display_score", 0.0)
        raw_score = candidate_data.get("raw_score", 0.0)
        terms = candidate_data.get("terms", {})

        allowed_numbers = {
            round(display_score, 1),
            int(round(display_score)),
            round(raw_score, 4),
            round(raw_score, 2),
            round(raw_score, 3),
        }
        for t_info in terms.values():
            val = t_info.get("value", 0.0)
            contrib = t_info.get("contribution", 0.0)
            weight = t_info.get("weight", 0.0)
            allowed_numbers.update([
                round(val, 1), round(val, 2), round(val, 3), round(val, 4),
                round(val * 100, 1), int(round(val * 100)),
                round(contrib, 1), round(contrib, 2), round(contrib, 3), round(contrib, 4),
                round(contrib * 100, 1),
                round(weight, 2), round(weight * 100, 1)
            ])
        # Add integer counts and standard config terms
        allowed_numbers.update([
            len(candidate_data.get("matched_skills", [])),
            len(candidate_data.get("missing_skills", [])),
            candidate_data.get("capacity", 0),
            candidate_data.get("current_load", 0),
            candidate_data.get("available_slots", 0),
            1, 2, 3, 4, 5, 10, 30, 45, 25, 15
        ])

        text_content = f"{rationale.why_this_team} {rationale.why_not_runner_up} {' '.join(rationale.risks)}"

        # Verify decimal numbers
        decimal_matches = re.findall(r"\b\d+\.\d+\b", text_content)
        for d_str in decimal_matches:
            d_val = float(d_str)
            if not any(abs(d_val - allowed) < 0.15 for allowed in allowed_numbers):
                return (
                    f"Fabricated metric/number '{d_str}' quoted in rationale. "
                    f"It does not match any deterministic score metric for {candidate_data['team']}."
                )

        # Verify percentages
        percent_matches = re.findall(r"(\d+(?:\.\d+)?)\s*%", text_content)
        for pct_str in percent_matches:
            pct_val = float(pct_str)
            if not any(abs(pct_val - allowed) < 0.15 for allowed in allowed_numbers):
                return (
                    f"Fabricated percentage '{pct_str}%' quoted in rationale. "
                    f"Actual deterministic metrics are: Score={display_score}%, terms={allowed_numbers}."
                )

        return None

    def _generate_template_fallback_rationale(
        self,
        candidate_data: Dict[str, Any],
        runner_up_data: Optional[Dict[str, Any]]
    ) -> StructuredRationale:
        """Deterministic template fallback constructed purely from real scoring numbers and skills."""
        team = candidate_data["team"]
        proj = candidate_data["project"]
        disp_score = candidate_data["display_score"]
        label = candidate_data["label"]
        matched_names = [m["skill"] for m in candidate_data.get("matched_skills", [])]
        missing_names = candidate_data.get("missing_skills", [])
        cap_pct = round(candidate_data["terms"]["capacity"]["value"] * 100)

        why_team = (
            f"Recommended for {team} ({proj}) with deterministic score {disp_score}/100 ({label} fit). "
            f"Candidate covers {len(matched_names)} required skills with {cap_pct}% available team capacity."
        )

        risks = [
            f"Candidate must ramp up on required technologies: {', '.join(missing_names[:3]) or 'team conventions'}."
        ]
        if candidate_data.get("available_slots", 1) == 0:
            risks.append("Team is currently at full capacity (0 slots open).")
        else:
            risks.append(f"Team has {candidate_data.get('available_slots', 1)} open bandwidth slots.")

        if runner_up_data:
            ru_team = runner_up_data["team"]
            ru_score = runner_up_data["display_score"]
            ru_missing = len(runner_up_data.get("missing_skills", []))
            why_not_ru = f"Runner-up {ru_team} scored {ru_score}/100 with higher learning gap ({ru_missing} missing skills)."
        else:
            why_not_ru = "No other candidate teams met criteria."

        return StructuredRationale(
            why_this_team=why_team,
            matched_skills=matched_names,
            skills_to_learn=missing_names[:4],
            risks=risks,
            why_not_runner_up=why_not_ru,
            fallback_rationale=True
        )

    def assign_team_and_project(
        self,
        employee_id: str,
        hire_skills: Union[List[str], List[Dict[str, Any]], Any],
        audit_callback: Optional[Callable[[str, str, str, str, str], None]] = None
    ) -> Assignment:
        """
        Executes deterministic scoring and generates verified structured rationale.
        Handles insufficient_data, zero capacity penalties, weak_fit, and close_call.
        """
        # Edge Case 1: Insufficient Data (0 skills extracted)
        skill_count = 0
        if hasattr(hire_skills, "skills"):
            skill_count = len(hire_skills.skills)
        elif isinstance(hire_skills, list):
            skill_count = len(hire_skills)

        if skill_count == 0:
            logger.warning(f"No skills extracted for employee {employee_id}; returning insufficient_data state.")
            if audit_callback:
                audit_callback(
                    employee_id,
                    "Project Manager",
                    "insufficient_data",
                    "0 candidate skills provided",
                    "Status: insufficient_data",
                    "No technical skills extracted from resume; paused before team scoring."
                )

            return Assignment(
                employee_id=employee_id,
                team="Unassigned",
                project="Pending Technical Competencies",
                score_breakdown={
                    "skill_match": 0.0,
                    "gap_coverage": 0.0,
                    "capacity": 0.0,
                    "learning_gap": 1.0,
                    "total_score": 0.0,
                    "raw_score": 0.0,
                    "display_score": 0.0,
                    "label": "not_recommended"
                },
                reason="Insufficient skill data extracted from candidate resume to compute deterministic team assignment.",
                approved_by=None,
                overridden=False,
                candidates=[],
                status="needs_attention",
                insufficient_data=True,
                structured_rationale=StructuredRationale(
                    why_this_team="Cannot assign team without extracted candidate skills.",
                    matched_skills=[],
                    skills_to_learn=[],
                    risks=["No skills provided on candidate profile."],
                    why_not_runner_up="No candidate teams could be evaluated.",
                    fallback_rationale=True
                )
            )

        # 1. Compute deterministic scores
        scored_teams = compute_team_scores(hire_skills, self.teams, self.projects)
        top_3 = scored_teams[:3]
        best_data = top_3[0]
        runner_up_data = top_3[1] if len(top_3) > 1 else None

        # 2. Prepare candidate objects and LLM input
        candidates: List[TeamCandidate] = []
        best_structured_rationale: Optional[StructuredRationale] = None

        for idx, candidate_data in enumerate(top_3):
            team_name = candidate_data["team"]
            proj_name = candidate_data["project"]
            breakdown: ScoreBreakdown = candidate_data["breakdown"]

            # Prompt LLM with ONLY scoring output numbers, matched/missing skills, labels
            user_prompt = (
                f"Candidate Ranking: #{idx + 1}\n"
                f"Team: {team_name}\n"
                f"Project: {proj_name}\n"
                f"Deterministic Fit Label: {candidate_data['label']}\n"
                f"Score Metrics:\n"
                f"- Raw Score: {candidate_data['raw_score']}\n"
                f"- Display Score: {candidate_data['display_score']}/100\n"
                f"- Skill Match: {candidate_data['terms']['skill_match']['value']} (weight: {candidate_data['terms']['skill_match']['weight']}, contrib: +{candidate_data['terms']['skill_match']['contribution']})\n"
                f"- Gap Coverage: {candidate_data['terms']['gap_coverage']['value']} (weight: {candidate_data['terms']['gap_coverage']['weight']}, contrib: +{candidate_data['terms']['gap_coverage']['contribution']})\n"
                f"- Available Capacity: {candidate_data['terms']['capacity']['value']} (weight: {candidate_data['terms']['capacity']['weight']}, contrib: +{candidate_data['terms']['capacity']['contribution']})\n"
                f"- Learning Gap Penalty: {candidate_data['terms']['learning_gap']['value']} (weight: {candidate_data['terms']['learning_gap']['weight']}, contrib: {candidate_data['terms']['learning_gap']['contribution']})\n"
                f"Matched Skills (Allowed): {[m['skill'] for m in candidate_data['matched_skills']]}\n"
                f"Missing Skills to Learn (Allowed): {candidate_data['missing_skills']}\n"
            )

            if idx == 0 and runner_up_data:
                user_prompt += (
                    f"\nRunner-up Team (#2): {runner_up_data['team']} "
                    f"(Score: {runner_up_data['display_score']}/100, Label: {runner_up_data['label']}, "
                    f"Missing: {runner_up_data['missing_skills'][:3]})\n"
                )

            user_prompt += (
                f"\nGenerate JSON strictly matching schema. "
                f"DO NOT change scores or labels. "
                f"DO NOT include skills that are not in the allowed lists."
            )

            # LLM invocation with Verifier and 1 Retry
            rationale_result: Optional[StructuredRationale] = None
            max_attempts = 2

            for attempt in range(max_attempts):
                try:
                    candidate_rationale = self.llm.call_structured(
                        system_prompt=PROJECT_SYSTEM_PROMPT,
                        user_prompt=user_prompt,
                        response_model=StructuredRationale,
                        fallback_factory=lambda: self._generate_template_fallback_rationale(candidate_data, runner_up_data if idx == 0 else None)
                    )

                    # Run Verifier
                    verification_err = self._verify_rationale(candidate_rationale, candidate_data)
                    if verification_err is None:
                        # Passed verification!
                        rationale_result = candidate_rationale
                        break
                    else:
                        logger.warning(f"Project Manager verifier failed on attempt {attempt + 1}: {verification_err}")
                        if attempt == 0:
                            # Feedback error to LLM for retry
                            user_prompt += (
                                f"\n\nCRITICAL VERIFICATION ERROR: {verification_err}\n"
                                f"You must fix this error immediately. Do not invent skills or change numbers."
                            )
                            if audit_callback:
                                audit_callback(
                                    employee_id,
                                    "Project Manager",
                                    "rationale_verifier_retry",
                                    f"Attempt 1 failed verification for {team_name}",
                                    f"Error: {verification_err}",
                                    "Triggering automatic 1-retry with verification error feedback."
                                )
                        else:
                            # Second attempt failed -> Fall back to template
                            logger.error(f"Attempt 2 failed verification; falling back to template rationale.")
                            rationale_result = self._generate_template_fallback_rationale(
                                candidate_data,
                                runner_up_data if idx == 0 else None
                            )
                            if audit_callback:
                                audit_callback(
                                    employee_id,
                                    "Project Manager",
                                    "rationale_fallback_triggered",
                                    f"Attempt 2 failed verification for {team_name}",
                                    "Status: fallback_rationale: true",
                                    f"Verifier rejected generated output ({verification_err}); reverted to deterministic template."
                                )
                except Exception as exc:
                    logger.error(f"Error calling LLM for {team_name}: {exc}")
                    rationale_result = self._generate_template_fallback_rationale(
                        candidate_data,
                        runner_up_data if idx == 0 else None
                    )

            if not rationale_result:
                rationale_result = self._generate_template_fallback_rationale(
                    candidate_data,
                    runner_up_data if idx == 0 else None
                )

            if idx == 0:
                best_structured_rationale = rationale_result

            candidates.append(TeamCandidate(
                team=team_name,
                project=proj_name,
                score_breakdown=breakdown,
                reason=rationale_result.why_this_team,
                risk="; ".join(rationale_result.risks) if rationale_result.risks else "None identified",
                learning_opportunities=rationale_result.skills_to_learn,
                raw_score=candidate_data["raw_score"],
                display_score=candidate_data["display_score"],
                label=candidate_data["label"],
                terms=candidate_data["terms"],
                matched_skills=candidate_data["matched_skills"],
                missing_skills=candidate_data["missing_skills"],
                formula_trace=candidate_data["formula_trace"],
                structured_rationale=rationale_result
            ))

        best_cand = candidates[0]

        # Flags for Task 3
        weak_fit = best_data["raw_score"] < settings.SCORE_WEAK_FIT_THRESHOLD
        close_call = False
        if runner_up_data:
            diff = abs(best_data["raw_score"] - runner_up_data["raw_score"])
            if diff <= settings.SCORE_CLOSE_CALL_MARGIN:
                close_call = True

        all_zero_cap = best_data.get("all_teams_zero_capacity", False)

        return Assignment(
            employee_id=employee_id,
            team=best_cand.team,
            project=best_cand.project,
            score_breakdown={
                "skill_match": best_cand.score_breakdown.skill_match,
                "gap_coverage": best_cand.score_breakdown.gap_coverage,
                "capacity": best_cand.score_breakdown.capacity,
                "learning_gap": best_cand.score_breakdown.learning_gap,
                "total_score": best_cand.score_breakdown.total_score,
                "raw_score": best_cand.raw_score,
                "display_score": best_cand.display_score,
                "label": best_cand.label,
                "terms": best_cand.terms,
                "formula_trace": best_cand.formula_trace
            },
            reason=best_cand.reason,
            approved_by=None,
            overridden=False,
            candidates=candidates,
            status="waiting_approval",
            insufficient_data=False,
            weak_fit=weak_fit,
            close_call=close_call,
            all_teams_zero_capacity=all_zero_cap,
            structured_rationale=best_structured_rationale,
            recommended_team=best_cand.team,
            recommended_project=best_cand.project,
            recommended_score=best_cand.display_score
        )

project_manager = ProjectManager()
