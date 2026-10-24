import json
from typing import List, Dict, Any, Union, Optional
from backend.app.config import settings
from backend.app.schemas import ScoreBreakdown

def compute_team_scores(
    hire_skills: Union[List[str], List[Dict[str, Any]], Any],
    teams: List[Dict[str, Any]],
    projects: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Deterministic scoring engine implementing the exact formula:
      raw_score = (
          W_skill_match * skill_match +
          W_gap_coverage * gap_coverage +
          W_capacity * capacity -
          W_learning_gap * learning_gap
      )
    Positive weights (skill_match, gap_coverage, capacity) sum to 1.0 (default 0.45 + 0.30 + 0.25).
    Learning gap is a penalty with weight 0.15.
    Does NOT clamp negatives to 0. Provides both raw_score and display_score (0-100 scale).

    Verified skills count as 1.0, claimed-only as 0.7, unclear as 0.3.
    Deterministic tie-break: higher verified count -> higher capacity -> alphabetical team name.
    """
    # 1. Normalize hire skills into status map
    # status: "verified" (1.0), "claimed" (0.7), "unclear" (0.3)
    skill_status_map: Dict[str, str] = {}
    skill_display_map: Dict[str, str] = {}

    if hasattr(hire_skills, "skills"):  # SkillMap object
        raw_items = hire_skills.skills
    else:
        raw_items = hire_skills or []

    for item in raw_items:
        if isinstance(item, str):
            s_name = item.strip()
            s_status = "claimed"
        elif isinstance(item, dict):
            s_name = item.get("skill", "").strip()
            s_status = item.get("status", "claimed").lower()
        elif hasattr(item, "skill"):
            s_name = getattr(item, "skill", "").strip()
            s_status = getattr(item, "status", "claimed").lower()
        else:
            continue

        if s_name:
            key = s_name.lower()
            skill_status_map[key] = s_status
            skill_display_map[key] = s_name

    def get_skill_weight(status: str) -> float:
        if status == "verified":
            return settings.SKILL_WEIGHT_VERIFIED
        elif status == "unclear":
            return settings.SKILL_WEIGHT_UNCLEAR
        return settings.SKILL_WEIGHT_CLAIMED

    # Total weight of all candidate skills
    total_hire_skill_weight = sum(get_skill_weight(st) for st in skill_status_map.values())

    results = []

    for team in teams:
        team_name = team["name"]
        raw_req_skills = team.get("required_skills", [])
        capacity = max(0, team.get("capacity", 5))
        current_load = team.get("current_load", 0)
        available_slots = max(0, capacity - current_load)

        # 1. Skill Match: weighted fraction of team required skills possessed by hire
        matched_skills_info: List[Dict[str, str]] = []
        missing_skills_list: List[str] = []
        matched_weight_sum = 0.0

        for req_skill in raw_req_skills:
            req_key = req_skill.strip().lower()
            if req_key in skill_status_map:
                st = skill_status_map[req_key]
                w = get_skill_weight(st)
                matched_weight_sum += w
                matched_skills_info.append({
                    "skill": req_skill,
                    "status": st
                })
            else:
                missing_skills_list.append(req_skill)

        num_req = max(1, len(raw_req_skills))
        skill_match_val = round(matched_weight_sum / num_req, 4)

        # 2. Gap Coverage: how well hire's competencies cover team needs
        if total_hire_skill_weight > 0:
            gap_cov_val = min(1.0, round(matched_weight_sum / total_hire_skill_weight, 4))
        else:
            gap_cov_val = 0.0

        # 3. Available Capacity
        if capacity > 0:
            capacity_val = min(1.0, round(available_slots / capacity, 4))
        else:
            capacity_val = 0.0

        # 4. Learning Gap: fraction of required skills the hire is missing
        learning_gap_val = round(len(missing_skills_list) / num_req, 4)

        # Term contributions
        w_match = settings.SCORE_WEIGHT_SKILL_MATCH
        w_gap = settings.SCORE_WEIGHT_GAP_COVERAGE
        w_cap = settings.SCORE_WEIGHT_CAPACITY
        w_learn = settings.SCORE_WEIGHT_LEARNING_GAP

        contrib_match = round(w_match * skill_match_val, 4)
        contrib_gap = round(w_gap * gap_cov_val, 4)
        contrib_cap = round(w_cap * capacity_val, 4)
        contrib_learn = -round(w_learn * learning_gap_val, 4)  # negative penalty contribution

        # Raw score equals exact sum of term contributions
        raw_score = round(contrib_match + contrib_gap + contrib_cap + contrib_learn, 4)

        # Display score is raw_score * 100, formatted with 1 decimal
        display_score = round(raw_score * 100, 1)

        # Label from score bands (code-assigned, never LLM)
        if raw_score >= 0.60:
            label = "strong"
        elif raw_score >= 0.40:
            label = "moderate"
        elif raw_score >= 0.20:
            label = "weak"
        else:
            label = "not_recommended"

        # Detailed Formula Trace
        formula_trace = (
            f"{w_match:.2f} * {skill_match_val:.3f} (+{contrib_match:.3f}) + "
            f"{w_gap:.2f} * {gap_cov_val:.3f} (+{contrib_gap:.3f}) + "
            f"{w_cap:.2f} * {capacity_val:.3f} (+{contrib_cap:.3f}) - "
            f"{w_learn:.2f} * {learning_gap_val:.3f} (-{abs(contrib_learn):.3f}) = "
            f"{raw_score:.3f} ({display_score:.1f}/100)"
        )

        terms_dict = {
            "skill_match": {
                "value": skill_match_val,
                "weight": w_match,
                "contribution": contrib_match,
                "display_points": round(contrib_match * 100, 1)
            },
            "gap_coverage": {
                "value": gap_cov_val,
                "weight": w_gap,
                "contribution": contrib_gap,
                "display_points": round(contrib_gap * 100, 1)
            },
            "capacity": {
                "value": capacity_val,
                "weight": w_cap,
                "contribution": contrib_cap,
                "display_points": round(contrib_cap * 100, 1)
            },
            "learning_gap": {
                "value": learning_gap_val,
                "weight": w_learn,
                "contribution": contrib_learn,
                "display_points": round(contrib_learn * 100, 1)
            }
        }

        # Select best project for this team
        team_projects = [p for p in projects if p.get("team") == team_name]
        best_proj = team_projects[0]["name"] if team_projects else "General Engineering Onboarding"

        # Count verified skills for tie-breaking
        verified_count = sum(1 for m in matched_skills_info if m["status"] == "verified")

        results.append({
            "team": team_name,
            "project": best_proj,
            "raw_score": raw_score,
            "display_score": display_score,
            "label": label,
            "terms": terms_dict,
            "matched_skills": matched_skills_info,
            "missing_skills": missing_skills_list,
            "verified_count": verified_count,
            "available_slots": available_slots,
            "capacity_total": capacity,
            "current_load": current_load,
            "formula_trace": formula_trace,
            "breakdown": ScoreBreakdown(
                skill_match=skill_match_val,
                gap_coverage=gap_cov_val,
                capacity=capacity_val,
                learning_gap=learning_gap_val,
                total_score=raw_score,
                raw_score=raw_score,
                display_score=display_score,
                label=label,
                terms=terms_dict,
                formula_trace=formula_trace
            )
        })

    # Tie-break:
    # 1. raw_score descending
    # 2. verified_count descending
    # 3. available_slots descending
    # 4. team name ascending (alphabetical)
    results.sort(
        key=lambda x: (
            -x["raw_score"],
            -x["verified_count"],
            -x["available_slots"],
            x["team"].lower()
        )
    )

    # Task 3 Zero-Capacity Rule:
    # Never recommend a team with zero capacity as #1 unless all are zero.
    has_positive_capacity_team = any(r["available_slots"] > 0 for r in results)
    all_zero_capacity = not has_positive_capacity_team

    if has_positive_capacity_team and results and results[0]["available_slots"] == 0:
        # Find first candidate with available_slots > 0 and promote to top
        for idx in range(1, len(results)):
            if results[idx]["available_slots"] > 0:
                promoted = results.pop(idx)
                promoted["zero_capacity_override"] = True
                results.insert(0, promoted)
                break

    for r in results:
        r["all_teams_zero_capacity"] = all_zero_capacity
        if r["available_slots"] == 0:
            r["capacity_note"] = f"Team has 0 available seats ({r['current_load']}/{r['capacity_total']} filled)."

    return results
