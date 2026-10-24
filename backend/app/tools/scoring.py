import json
from typing import List, Dict, Any, Tuple
from backend.app.config import settings
from backend.app.schemas import Team, Project, ScoreBreakdown

def compute_team_scores(
    hire_skills: List[str],
    teams: List[Dict[str, Any]],
    projects: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Deterministic scoring engine implementing the exact formula:
      score = 0.40*skill_match + 0.25*gap_coverage + 0.20*capacity - 0.15*learning_gap
    Each component is normalised 0.0 - 1.0.
    Returns ranked teams with complete score breakdown.
    """
    from backend.app.tools.ontology import ontology
    
    # Expand candidate skills to canonical and all aliases to prevent thin parse distortion
    hire_skill_set = set()
    for s in hire_skills:
        clean_s = s.strip().lower()
        hire_skill_set.add(clean_s)
        canon, matched = ontology.normalize(s)
        if matched:
            hire_skill_set.add(canon.lower())
            for alias in ontology.get_aliases(canon):
                hire_skill_set.add(alias.lower())

    results = []

    for team in teams:
        team_name = team["name"]
        raw_req_skills = team.get("required_skills", [])
        capacity = max(1, team.get("capacity", 5))
        current_load = team.get("current_load", 0)

        # Canonicalize required skills for robust matching
        matched_skills = []
        missing_skills = []
        for req in raw_req_skills:
            req_canon, _ = ontology.normalize(req)
            if req.lower() in hire_skill_set or req_canon.lower() in hire_skill_set:
                matched_skills.append(req)
            else:
                missing_skills.append(req)

        skill_match = len(matched_skills) / max(1, len(raw_req_skills))

        # 2. Gap Coverage: how many of the hire's skills address the team's need
        gap_coverage = len(matched_skills) / max(1, len(hire_skill_set)) if hire_skill_set else 0.0
        gap_coverage = min(1.0, gap_coverage)

        # 3. Capacity: available bandwidth (capacity - current_load) / capacity
        available_slots = max(0, capacity - current_load)
        capacity_score = min(1.0, available_slots / capacity)

        # 4. Learning Gap: fraction of required skills the hire still needs to learn
        learning_gap = len(missing_skills) / max(1, len(raw_req_skills))

        # Weighted calculation
        total_score = (
            settings.SCORE_WEIGHT_SKILL_MATCH * skill_match
            + settings.SCORE_WEIGHT_GAP_COVERAGE * gap_coverage
            + settings.SCORE_WEIGHT_CAPACITY * capacity_score
            - settings.SCORE_WEIGHT_LEARNING_GAP * learning_gap
        )
        total_score = round(max(0.0, min(1.0, total_score)), 4)

        # Find best matching project for this team
        team_projects = [p for p in projects if p.get("team") == team_name]
        best_proj = team_projects[0]["name"] if team_projects else "General Engineering Onboarding"

        results.append({
            "team": team_name,
            "project": best_proj,
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "breakdown": ScoreBreakdown(
                skill_match=round(skill_match, 3),
                gap_coverage=round(gap_coverage, 3),
                capacity=round(capacity_score, 3),
                learning_gap=round(learning_gap, 3),
                total_score=total_score
            ),
            "total_score": total_score
        })

    # Sort descending by deterministic score
    results.sort(key=lambda x: x["total_score"], reverse=True)
    return results
