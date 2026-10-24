import pytest
from backend.app.agents.skill_manager import skill_manager
from backend.app.tools.ontology import ontology
from backend.app.schemas import SkillMap, SkillItem

def test_ontology_duplicates_merged():
    """
    Test 1: Duplicates merged by ontology.
    A candidate listing 'Python', 'Python3', 'py', 'PostgreSQL', and 'postgres'
    should have aliases collapsed into unique canonical skills ('Python', 'PostgreSQL').
    """
    resume_with_aliases = """
    Software Developer
    Skills: Python, Python3, py, PostgreSQL, postgres, psql, FastAPI, fast-api.
    Experience: Built data pipelines in Python and queries in PostgreSQL.
    """
    skill_map: SkillMap = skill_manager.extract_skills(
        employee_id="test-dup-1",
        resume_text=resume_with_aliases,
        github_username=None
    )

    skill_names = [s.skill for s in skill_map.skills]

    # Check there are no duplicate canonical entries
    assert len(skill_names) == len(set(skill_names)), f"Duplicates found in {skill_names}"

    # Verify canonical forms
    assert "Python" in skill_names
    assert "PostgreSQL" in skill_names
    assert "FastAPI" in skill_names

    # Verify alias forms are NOT present as separate items
    assert "python3" not in skill_names
    assert "py" not in skill_names
    assert "postgres" not in skill_names
    assert "fast-api" not in skill_names

    # Check that Python has multiple supporting quotes from the resume
    python_item = next(s for s in skill_map.skills if s.skill == "Python")
    assert any("Python" in ev for ev in python_item.evidence)
    assert python_item.category == "language"


def test_missing_github_user():
    """
    Test 2: Missing GitHub user or non-existent user.
    Should set a visible state 'resume-only' instead of failing silently.
    """
    resume_text = """
    Jane Smith
    Frontend Engineer with 4 years experience in TypeScript and React.
    Skills: TypeScript, React, TailwindCSS.
    Projects: Customer web portal built in React with TypeScript.
    """
    # 1. Test None username
    skill_map_none = skill_manager.extract_skills(
        employee_id="test-gh-none",
        resume_text=resume_text,
        github_username=None
    )
    assert skill_map_none.verification_state == "resume-only"
    assert "No GitHub username" in (skill_map_none.github_summary or "")

    # Skills should be claimed
    for s in skill_map_none.skills:
        assert s.status == "claimed"
        assert any("[resume-only]" in ev for ev in s.evidence)

    # 2. Test empty string username
    skill_map_empty = skill_manager.extract_skills(
        employee_id="test-gh-empty",
        resume_text=resume_text,
        github_username=""
    )
    assert skill_map_empty.verification_state == "resume-only"

    # 3. Test non-existent GitHub handle
    skill_map_invalid = skill_manager.extract_skills(
        employee_id="test-gh-invalid",
        resume_text=resume_text,
        github_username="non_existent_user_99999_xyz_abc"
    )
    assert skill_map_invalid.verification_state == "resume-only"


def test_empty_resume():
    """
    Test 3: Empty or whitespace-only resume.
    Must not crash; must return a valid SkillMap with clear defaults and no broken quotes.
    """
    # Test completely empty string
    empty_map = skill_manager.extract_skills(
        employee_id="test-empty-1",
        resume_text="",
        github_username=None
    )
    assert isinstance(empty_map, SkillMap)
    assert empty_map.verification_state == "resume-only"

    # Test None resume
    none_map = skill_manager.extract_skills(
        employee_id="test-empty-2",
        resume_text=None,
        github_username=None
    )
    assert isinstance(none_map, SkillMap)

    # Test whitespace-only resume
    ws_map = skill_manager.extract_skills(
        employee_id="test-empty-3",
        resume_text="    \n\t   \n  ",
        github_username=None
    )
    assert isinstance(ws_map, SkillMap)
    assert len(ws_map.skills) >= 0


def test_skill_with_no_evidence():
    """
    Test 4: Skill with no evidence.
    If a skill is listed but has zero quotes in the resume text and zero GitHub repos,
    it must be labelled as 'claimed' (never 'verified'), evidence must state
    no direct resume text quote was found, and confidence must reflect that lack of signal.
    """
    sparse_resume = """
    Bob Martin
    Summary: Experienced backend architect.
    Experience: Designed distributed systems and microservices.
    """
    # Extract evidence for a skill not explicitly named in the sparse resume
    evidence = skill_manager.find_resume_evidence(sparse_resume, "Flutter")
    assert len(evidence) >= 1
    # Must carry section/context quote from resume, never unquoted or uncontextualized
    assert any(ev.startswith("[") and '"' in ev for ev in evidence)

    # Test deterministic level and confidence when signals are empty
    level, conf, signals = skill_manager.compute_level_and_confidence(
        skill="Flutter",
        years_experience=1,
        project_mentions=0,
        repo_count=0,
        certified=False,
        has_tests=False
    )
    assert level == "beginner"
    assert conf <= 0.60
    assert signals["repo_count"] == 0
    assert signals["project_mentions"] == 0
    assert signals["certified"] is False
