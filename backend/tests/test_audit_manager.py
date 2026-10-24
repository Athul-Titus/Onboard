import pytest
from backend.app.db import SessionLocal
from backend.app.orchestrator import orchestrator
from backend.app.models import EmployeeModel, AuditLogModel, AssignmentModel, IdentityProposalModel

import uuid
def test_manager_actions_logged_with_actor_timestamp_reason():
    db = SessionLocal()
    uid = uuid.uuid4().hex[:8]
    emp_id = f"test-mgr-emp-{uid}"
    try:
        emp = EmployeeModel(
            id=emp_id,
            name="Sarah Connor",
            role="DevOps Engineer",
            start_date="2026-11-01"
        )
        db.add(emp)
        db.commit()

        # Run identity step
        orchestrator.run_identity_step(db, emp_id)

        # 1. Manager performs an edit and approval on identity
        manager = "Marcus Vance (Engineering Lead)"
        orchestrator.approve_identity_step(
            db,
            emp_id,
            manager_name=manager,
            edited_email=f"s.connor.{uid}@company.com"
        )

        # Run assignment proposal
        new_assign = AssignmentModel(
            id="test-assign-1",
            employee_id=emp_id,
            team="Backend Platform",
            project="API Gateway",
            score_breakdown_json="{}",
            reason="Strong Python background",
            status="waiting_approval"
        )
        db.add(new_assign)
        db.commit()

        # 2. Manager approves assignment
        orchestrator.approve_assignment_step(db, emp_id, manager_name=manager)

        # 3. Manager overrides assignment
        override_reason = "Critical strategic business need for cloud migration in DevOps team"
        orchestrator.override_assignment_step(
            db,
            emp_id,
            manager_name=manager,
            team="DevOps & Infrastructure",
            project="Terraform Migration",
            reason=override_reason
        )

        # Query manager actions
        manager_logs = db.query(AuditLogModel).filter(
            AuditLogModel.employee_id == emp_id,
            AuditLogModel.entry_type == "manager_action"
        ).all()

        actions = [l.action for l in manager_logs]
        assert "manager_edit:identity_email" in actions, f"Missing manager_edit in {actions}"
        assert "manager_approval:identity" in actions, f"Missing identity approval in {actions}"
        assert "manager_approval:assignment" in actions, f"Missing assignment approval in {actions}"
        assert "manager_override:assignment" in actions, f"Missing assignment override in {actions}"

        for log in manager_logs:
            assert log.actor == manager
            assert log.timestamp is not None and "T" in log.timestamp
            assert log.reason is not None and len(log.reason.strip()) > 0

        # Specifically check override log reason matches the justification
        override_log = next(l for l in manager_logs if l.action == "manager_override:assignment")
        assert override_reason in override_log.reason

    finally:
        db.query(AuditLogModel).filter(AuditLogModel.employee_id == emp_id).delete()
        db.query(IdentityProposalModel).filter(IdentityProposalModel.employee_id == emp_id).delete()
        db.query(AssignmentModel).filter(AssignmentModel.employee_id == emp_id).delete()
        db.query(EmployeeModel).filter(EmployeeModel.id == emp_id).delete()
        db.commit()
        db.close()
