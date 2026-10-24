import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from backend.app.config import settings
from backend.app.schemas import Assignment, TeamCandidate, ScoreBreakdown
from backend.app.tools.scoring import compute_team_scores
from backend.app.llm_client import LLMClient
from backend.app.prompts.agent_prompts import PROJECT_SYSTEM_PROMPT

class LLMExplanation(BaseModel):
    reason: str
    risk: str
    learning_opportunities: List[str] = Field(default_factory=list)

class ProjectManager:
    """
    Project Manager Agent:
    - Runs deterministic scoring engine across all teams and projects.
    - Ranks teams strictly by numerical score (LLM cannot change rankings).
    - LLM generates context-aware explanation, risks, and learning opportunities.
    - Yields an Assignment proposal awaiting manager sign-off or override.
    """

    def __init__(self):
        self.llm = LLMClient()
        teams_path = settings.SEED_DIR / "teams.json"
        with open(teams_path, "r", encoding="utf-8") as f:
            self.teams = json.load(f)

        projects_path = settings.SEED_DIR / "projects.json"
        with open(projects_path, "r", encoding="utf-8") as f:
            self.projects = json.load(f)

    def assign_team_and_project(self, employee_id: str, hire_skills: List[str]) -> Assignment:
        # 1. Compute deterministic scores
        scored_teams = compute_team_scores(hire_skills, self.teams, self.projects)
        top_3 = scored_teams[:3]

        candidates: List[TeamCandidate] = []

        for candidate_data in top_3:
            team_name = candidate_data["team"]
            proj_name = candidate_data["project"]
            breakdown: ScoreBreakdown = candidate_data["breakdown"]

            # Prompt LLM for structured explanation
            user_prompt = (
                f"Candidate Skills: {hire_skills}\n"
                f"Team: {team_name}\n"
                f"Project: {proj_name}\n"
                f"Deterministic Score Breakdown:\n"
                f"- Skill Match: {breakdown.skill_match}\n"
                f"- Gap Coverage: {breakdown.gap_coverage}\n"
                f"- Available Capacity: {breakdown.capacity}\n"
                f"- Learning Gap: {breakdown.learning_gap}\n"
                f"- Total Score: {breakdown.total_score}\n"
                f"Missing Team Skills to Ramp Up: {candidate_data['missing_skills']}\n\n"
                f"Generate a clear rationale explaining why this team fits, key onboarding risks, and learning roadmap."
            )

            def fallback_exp() -> LLMExplanation:
                return LLMExplanation(
                    reason=f"Strong match for {team_name} with {round(breakdown.skill_match*100)}% required skill coverage.",
                    risk=f"Candidate will need to ramp up on: {', '.join(candidate_data['missing_skills'][:2]) or 'team conventions'}.",
                    learning_opportunities=candidate_data["missing_skills"][:3] or ["System telemetry", "Service architecture"]
                )

            explanation: LLMExplanation = self.llm.call_structured(
                system_prompt=PROJECT_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                response_model=LLMExplanation,
                fallback_factory=fallback_exp
            )

            candidates.append(TeamCandidate(
                team=team_name,
                project=proj_name,
                score_breakdown=breakdown,
                reason=explanation.reason,
                risk=explanation.risk,
                learning_opportunities=explanation.learning_opportunities
            ))

        best = candidates[0]
        return Assignment(
            employee_id=employee_id,
            team=best.team,
            project=best.project,
            score_breakdown={
                "skill_match": best.score_breakdown.skill_match,
                "gap_coverage": best.score_breakdown.gap_coverage,
                "capacity": best.score_breakdown.capacity,
                "learning_gap": best.score_breakdown.learning_gap,
                "total_score": best.score_breakdown.total_score
            },
            reason=best.reason,
            approved_by=None,
            overridden=False,
            candidates=candidates,
            status="waiting_approval"
        )

project_manager = ProjectManager()
