import pytest
from backend.app.db import SessionLocal
from backend.app.models import EmployeeModel, AuditLogModel, SkillMapModel, AssignmentModel
from backend.app.orchestrator import orchestrator

def test_skill_and_project_manager_audit_entries():
    db = SessionLocal()
    emp_id = "test-sp-emp-1"
    try:
        emp = EmployeeModel(
            id=emp_id,
            name="John Doe",
            role="Software Engineer",
            start_date="2026-11-01",
            github_username="johndoe",
            resume_text="Experienced engineer with Python, FastAPI, Docker, and Kubernetes skills."
        )
        db.add(emp)
        db.commit()

        # Run skill step
        orchestrator.run_skills_step(db, emp_id)

        # Run assignment step
        orchestrator.run_assignment_step(db, emp_id)

        # 1. Check Skill Manager audit entry
        skill_log = db.query(AuditLogModel).filter(
            AuditLogModel.employee_id == emp_id,
            AuditLogModel.agent == "Skill Manager",
            AuditLogModel.action == "extract_and_verify_skills"
        ).first()

        assert skill_log is not None
        # Must state why skills were or weren't verified (repos, languages, GitHub user)
        assert "Verified" in skill_log.output_summary
        assert "Unverified" in skill_log.output_summary or "Claimed" in skill_log.output_summary
        assert "repos" in skill_log.output_summary.lower() or "languages" in skill_log.output_summary.lower()
        assert "johndoe" in skill_log.reason.lower() or "repos" in skill_log.reason.lower()

        # 2. Check Project Manager audit entry
        proj_log = db.query(AuditLogModel).filter(
            AuditLogModel.employee_id == emp_id,
            AuditLogModel.agent == "Project Manager",
            AuditLogModel.action == "rank_and_assign_team"
        ).first()

        assert proj_log is not None
        # Must include score breakdown components
        assert "skill_match=" in proj_log.output_summary
        assert "gap_coverage=" in proj_log.output_summary
        assert "capacity=" in proj_log.output_summary
        assert "learning_gap=" in proj_log.output_summary
        assert "total_score=" in proj_log.output_summary

        # Check in reason as well
        assert "Skill Match=" in proj_log.reason
        assert "Gap Coverage=" in proj_log.reason
        assert "Available Capacity=" in proj_log.reason

    finally:
        db.query(AuditLogModel).filter(AuditLogModel.employee_id == emp_id).delete()
        db.query(SkillMapModel).filter(SkillMapModel.employee_id == emp_id).delete()
        db.query(AssignmentModel).filter(AssignmentModel.employee_id == emp_id).delete()
        db.query(EmployeeModel).filter(EmployeeModel.id == emp_id).delete()
        db.commit()
        db.close()
