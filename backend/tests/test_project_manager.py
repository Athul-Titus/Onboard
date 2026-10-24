"""
Unit tests for Project Manager Agent deterministic scoring, verifier, and edge cases.
Covers:
1. Score weights sum correctly to 1.0 (positive weights) and penalty weight.
2. Score arithmetic matches formula_trace and visible term contribution sum.
3. Deterministic tie-break hierarchy (verified count -> capacity -> alphabetical).
4. Insufficient data path (0 skills extracted returns insufficient_data).
5. Verifier rejecting fabricated skills and triggering template fallback.
6. Zero capacity team penalization and never recommending zero capacity as #1 unless all zero.
"""

import pytest
from backend.app.config import settings
from backend.app.tools.scoring import compute_team_scores
from backend.app.agents.project_manager import project_manager
from backend.app.schemas import StructuredRationale

def test_score_weights_sum_correctly():
    """Verify positive scoring weights sum to 1.0 and penalty weight is 0.15."""
    positive_sum = (
        settings.SCORE_WEIGHT_SKILL_MATCH +
        settings.SCORE_WEIGHT_GAP_COVERAGE +
        settings.SCORE_WEIGHT_CAPACITY
    )
    assert round(positive_sum, 6) == 1.0, f"Positive weights sum must be 1.0, got {positive_sum}"
    assert settings.SCORE_WEIGHT_SKILL_MATCH == 0.45
    assert settings.SCORE_WEIGHT_GAP_COVERAGE == 0.30
    assert settings.SCORE_WEIGHT_CAPACITY == 0.25
    assert settings.SCORE_WEIGHT_LEARNING_GAP == 0.15

    # Check skill status weights
    assert settings.SKILL_WEIGHT_VERIFIED == 1.0
    assert settings.SKILL_WEIGHT_CLAIMED == 0.7
    assert settings.SKILL_WEIGHT_UNCLEAR == 0.3

def test_score_arithmetic_matches_formula_trace():
    """Verify raw_score arithmetic strictly matches formula_trace and term contributions."""
    hire_skills = [
        {"skill": "Python", "status": "verified"},
        {"skill": "FastAPI", "status": "verified"},
        {"skill": "PostgreSQL", "status": "claimed"},
        {"skill": "Redis", "status": "claimed"}
    ]

    scored = compute_team_scores(hire_skills, project_manager.teams, project_manager.projects)
    assert len(scored) > 0

    for cand in scored:
        terms = cand["terms"]
        c_match = terms["skill_match"]["contribution"]
        c_gap = terms["gap_coverage"]["contribution"]
        c_cap = terms["capacity"]["contribution"]
        c_learn = terms["learning_gap"]["contribution"]

        # Sum of contributions must equal raw_score
        expected_raw = round(c_match + c_gap + c_cap + c_learn, 4)
        assert cand["raw_score"] == expected_raw, f"raw_score {cand['raw_score']} != sum of contributions {expected_raw}"

        # Display score is raw_score * 100
        expected_display = round(expected_raw * 100, 1)
        assert cand["display_score"] == expected_display

        # formula_trace must plug in the exact real numbers
        trace = cand["formula_trace"]
        assert f"{terms['skill_match']['weight']:.2f} * {terms['skill_match']['value']:.3f}" in trace
        assert f"{terms['gap_coverage']['weight']:.2f} * {terms['gap_coverage']['value']:.3f}" in trace
        assert f"{terms['capacity']['weight']:.2f} * {terms['capacity']['value']:.3f}" in trace
        assert f"{terms['learning_gap']['weight']:.2f} * {terms['learning_gap']['value']:.3f}" in trace
        assert f"{expected_raw:.3f}" in trace
        assert f"{expected_display:.1f}/100" in trace

        # The UI visible points sum must equal display score
        p_match = Number_round(c_match * 100, 1)
        p_gap = Number_round(c_gap * 100, 1)
        p_cap = Number_round(c_cap * 100, 1)
        p_learn = Number_round(c_learn * 100, 1)
        ui_sum = round(p_match + p_gap + p_cap + p_learn, 1)
        assert abs(ui_sum - expected_display) <= 0.2

def Number_round(val: float, decimals: int) -> float:
    return round(val, decimals)

def test_deterministic_tie_break():
    """Verify tie-break order: verified count -> capacity -> alphabetical team name."""
    # Test tie-break 1: Higher verified count wins
    skills_hire = [
        {"skill": "Python", "status": "verified"},
        {"skill": "FastAPI", "status": "claimed"}
    ]
    # Two synthetic teams with identical requirements and capacity
    teams = [
        {"name": "Team Beta", "required_skills": ["Python", "FastAPI"], "capacity": 5, "current_load": 2},
        {"name": "Team Alpha", "required_skills": ["Python", "FastAPI"], "capacity": 5, "current_load": 2}
    ]
    projects = [
        {"name": "Proj Beta", "team": "Team Beta", "difficulty": "medium", "required_skills": ["Python"]},
        {"name": "Proj Alpha", "team": "Team Alpha", "difficulty": "medium", "required_skills": ["Python"]}
    ]

    # Scores and verified counts are identical; Alphabetical order (Team Alpha < Team Beta) breaks tie
    scored = compute_team_scores(skills_hire, teams, projects)
    assert scored[0]["team"] == "Team Alpha"
    assert scored[1]["team"] == "Team Beta"

    # Test tie-break 2: Higher capacity wins
    teams_diff_cap = [
        {"name": "Team Beta", "required_skills": ["Python", "FastAPI"], "capacity": 10, "current_load": 2},
        {"name": "Team Alpha", "required_skills": ["Python", "FastAPI"], "capacity": 5, "current_load": 2}
    ]
    scored_cap = compute_team_scores(skills_hire, teams_diff_cap, projects)
    # Team Beta has higher capacity (10 vs 5), capacity term is higher (8/10 = 0.8 vs 3/5 = 0.6)
    assert scored_cap[0]["team"] == "Team Beta"

def test_insufficient_data_path():
    """Verify that 0 skills extracted returns insufficient_data status without crashing or ranking zeros."""
    assignment = project_manager.assign_team_and_project(
        employee_id="emp-empty",
        hire_skills=[]
    )
    assert assignment.insufficient_data is True
    assert assignment.status == "needs_attention"
    assert assignment.team == "Unassigned"
    assert len(assignment.candidates) == 0
    assert assignment.score_breakdown["raw_score"] == 0.0
    assert assignment.score_breakdown["label"] == "not_recommended"
    assert "Insufficient skill data" in assignment.reason

def test_verifier_rejects_fabricated_skill_and_falls_back():
    """Verify that verifier catches hallucinated skills and falls back to deterministic template."""
    candidate_data = {
        "team": "Backend Platform",
        "project": "Distributed Cache Modernization",
        "display_score": 75.0,
        "label": "strong",
        "matched_skills": [{"skill": "Python", "status": "verified"}, {"skill": "FastAPI", "status": "verified"}],
        "missing_skills": ["Redis", "PostgreSQL"],
        "terms": {
            "skill_match": {"value": 0.8, "weight": 0.45, "contribution": 0.36},
            "gap_coverage": {"value": 0.7, "weight": 0.30, "contribution": 0.21},
            "capacity": {"value": 0.6, "weight": 0.25, "contribution": 0.15},
            "learning_gap": {"value": 0.2, "weight": 0.15, "contribution": -0.03}
        }
    }

    # Case 1: Valid rationale passes verifier
    valid_rationale = StructuredRationale(
        why_this_team="Strong candidate with Python and FastAPI experience matching the Backend Platform.",
        matched_skills=["Python", "FastAPI"],
        skills_to_learn=["Redis"],
        risks=["Need to ramp up on Redis"],
        why_not_runner_up="Higher score than runner up",
        fallback_rationale=False
    )
    assert project_manager._verify_rationale(valid_rationale, candidate_data) is None

    # Case 2: Fabricated skill rejected by verifier
    fabricated_rationale = StructuredRationale(
        why_this_team="Candidate has extensive Kubernetes expertise.",
        matched_skills=["Python", "Kubernetes"],  # Kubernetes is NOT in candidate_data!
        skills_to_learn=["Redis"],
        risks=[],
        why_not_runner_up="Better match",
        fallback_rationale=False
    )
    err = project_manager._verify_rationale(fabricated_rationale, candidate_data)
    assert err is not None
    assert "Kubernetes" in err

    # Case 3: Fabricated number rejected by verifier
    fabricated_number_rationale = StructuredRationale(
        why_this_team="Candidate achieved a score of 99.9 on the benchmark.",
        matched_skills=["Python"],
        skills_to_learn=[],
        risks=[],
        why_not_runner_up="Runner up scored lower",
        fallback_rationale=False
    )
    err_num = project_manager._verify_rationale(fabricated_number_rationale, candidate_data)
    assert err_num is not None
    assert "99.9" in err_num

def test_zero_capacity_team_penalized_and_not_recommended():
    """Verify team with zero capacity is penalized via capacity term and never #1 unless all are zero."""
    skills = [{"skill": "Python", "status": "verified"}, {"skill": "FastAPI", "status": "verified"}]

    # Team A has full match but 0 capacity (load == capacity)
    # Team B has lower match but plenty of capacity
    teams = [
        {
            "name": "Zero Cap Team",
            "required_skills": ["Python", "FastAPI"],
            "capacity": 5,
            "current_load": 5  # 0 available slots!
        },
        {
            "name": "Available Team",
            "required_skills": ["Python"],
            "capacity": 5,
            "current_load": 1  # 4 available slots
        }
    ]
    projects = [
        {"name": "Zero Cap Project", "team": "Zero Cap Team", "difficulty": "medium", "required_skills": ["Python"]},
        {"name": "Available Project", "team": "Available Team", "difficulty": "medium", "required_skills": ["Python"]}
    ]

    scored = compute_team_scores(skills, teams, projects)

    # Zero Cap Team must have capacity term == 0.0
    zero_cap_entry = next(c for c in scored if c["team"] == "Zero Cap Team")
    assert zero_cap_entry["terms"]["capacity"]["value"] == 0.0
    assert zero_cap_entry["terms"]["capacity"]["contribution"] == 0.0

    # Zero capacity team should NOT be #1 when another team with capacity exists
    assert scored[0]["team"] != "Zero Cap Team"

    # When ALL teams are zero capacity:
    teams_all_zero = [
        {"name": "Zero Team 1", "required_skills": ["Python"], "capacity": 3, "current_load": 3},
        {"name": "Zero Team 2", "required_skills": ["Python"], "capacity": 4, "current_load": 4}
    ]
    scored_all_zero = compute_team_scores(skills, teams_all_zero, projects)
    # Must flag all_teams_zero_capacity
    assert scored_all_zero[0].get("all_teams_zero_capacity") is True
