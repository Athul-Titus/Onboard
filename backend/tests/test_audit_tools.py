import pytest
from backend.app.db import SessionLocal
from backend.app.orchestrator import orchestrator
from backend.app.models import EmployeeModel, AuditLogModel

def test_tool_invocations_logged_separately():
    db = SessionLocal()
    emp_id = "test-tool-emp-1"
    try:
        # Create test employee
        emp = EmployeeModel(
            id=emp_id,
            name="Alex Chen",
            role="Backend Engineer",
            start_date="2026-11-01",
            github_username="octocat",
            resume_text="Senior Python Engineer with Docker, FastAPI and Kubernetes experience."
        )
        db.add(emp)
        db.commit()

        # 1. Identity step -> check_email_available tool logged
        orchestrator.run_identity_step(db, emp_id)

        # 2. Approve identity -> create_account tool logged
        orchestrator.approve_identity_step(db, emp_id, manager_name="Manager John")

        # 3. Skills step -> github_fetch tool logged
        orchestrator.run_skills_step(db, emp_id)

        # 4. Guide step -> retrieval_query tool logged
        orchestrator.run_guide_step(db, emp_id)

        # Query all tool invocations for this employee
        tool_logs = db.query(AuditLogModel).filter(
            AuditLogModel.employee_id == emp_id,
            AuditLogModel.entry_type == "tool_invocation"
        ).all()

        actions = [l.action for l in tool_logs]
        assert "tool:check_email_available" in actions, f"Missing check_email_available in {actions}"
        assert "tool:create_account" in actions, f"Missing create_account in {actions}"
        assert "tool:github_fetch" in actions, f"Missing github_fetch in {actions}"
        assert "tool:retrieval_query" in actions, f"Missing retrieval_query in {actions}"

        # Verify parameters summary, result, and duration
        for log in tool_logs:
            assert log.input_summary is not None and len(log.input_summary) > 0
            assert log.output_summary is not None and len(log.output_summary) > 0
            assert log.duration_ms is not None and log.duration_ms >= 0.0

    finally:
        # Cleanup
        db.query(AuditLogModel).filter(AuditLogModel.employee_id == emp_id).delete()
        db.query(EmployeeModel).filter(EmployeeModel.id == emp_id).delete()
        db.commit()
        db.close()
