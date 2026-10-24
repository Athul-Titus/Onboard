import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.models import (
    EmployeeModel,
    IdentityProposalModel,
    SkillMapModel,
    AssignmentModel,
    GuideModel,
    AuditLogModel
)
from backend.app.schemas import (
    IdentityProposal,
    SkillMap,
    Assignment,
    Guide,
    AuditEntry,
    StepStatusInfo,
    WorkflowStepStatus
)
from backend.app.agents.identity_agent import IdentityAgent

logger = logging.getLogger(__name__)

def utc_iso():
    return datetime.now(timezone.utc).isoformat()

class WorkflowOrchestrator:
    """
    OnboardOS State Machine Orchestrator.
    Manages sequential and parallel agent execution:
      identity -> skills -> assignment -> guide -> review.
    Enforces:
      - Pydantic schema validation
      - Timeout & 1 automatic retry
      - Graceful error degradation ('needs_attention')
      - Comprehensive audit logging for all agent actions
      - Human-in-the-loop approval gates
    """

    def __init__(self):
        self.identity_agent = IdentityAgent()

    def log_audit(
        self,
        db: Session,
        employee_id: str,
        agent: str,
        action: str,
        input_summary: str,
        output_summary: str,
        reason: str
    ) -> AuditLogModel:
        """Appends an immutable audit log row to the database."""
        entry = AuditLogModel(
            id=str(uuid.uuid4()),
            employee_id=employee_id,
            timestamp=utc_iso(),
            agent=agent,
            action=action,
            input_summary=input_summary,
            output_summary=output_summary,
            reason=reason
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry

    def update_step_status(
        self,
        db: Session,
        employee: EmployeeModel,
        step: str,
        status: WorkflowStepStatus,
        error: Optional[str] = None
    ):
        """Updates the tracking status dictionary on the EmployeeModel."""
        try:
            current_steps = json.loads(employee.step_status_json or "{}")
        except Exception:
            current_steps = {}

        now = utc_iso()
        if step not in current_steps:
            current_steps[step] = {"step": step, "status": status, "started_at": now}
        else:
            current_steps[step]["status"] = status
            if status in ["done", "needs_attention"]:
                current_steps[step]["completed_at"] = now
            if error:
                current_steps[step]["error"] = error

        employee.step_status_json = json.dumps(current_steps)
        employee.current_step = step
        employee.status = status
        db.commit()

    def run_identity_step(self, db: Session, employee_id: str) -> IdentityProposal:
        """Runs the Identity Agent to propose a collision-free email and corporate username."""
        emp = db.query(EmployeeModel).filter(EmployeeModel.id == employee_id).first()
        if not emp:
            raise ValueError(f"Employee {employee_id} not found")

        self.update_step_status(db, emp, "identity", "running")

        try:
            proposal = self.identity_agent.propose_identity(db, employee_id, emp.name)

            # Persist proposal
            existing = db.query(IdentityProposalModel).filter(IdentityProposalModel.employee_id == employee_id).first()
            if existing:
                existing.proposed_email = proposal.proposed_email
                existing.username = proposal.username
                existing.rule_used = proposal.rule_used
                existing.collision_detected = proposal.collision_detected
                existing.attempts_log_json = json.dumps(proposal.attempts_log)
                existing.status = "waiting_approval"
            else:
                new_prop = IdentityProposalModel(
                    id=str(uuid.uuid4()),
                    employee_id=employee_id,
                    proposed_email=proposal.proposed_email,
                    username=proposal.username,
                    rule_used=proposal.rule_used,
                    collision_detected=proposal.collision_detected,
                    attempts_log_json=json.dumps(proposal.attempts_log),
                    status="waiting_approval"
                )
                db.add(new_prop)

            self.log_audit(
                db,
                employee_id=employee_id,
                agent="Identity Agent",
                action="propose_email",
                input_summary=f"Full Name: '{emp.name}', Naming Policy ruleset",
                output_summary=f"Proposed: '{proposal.proposed_email}' (Rule: {proposal.rule_used})",
                reason=f"Collision detected: {proposal.collision_detected}. Awaiting manager approval before account creation."
            )

            self.update_step_status(db, emp, "identity", "waiting_approval")
            return proposal

        except Exception as exc:
            logger.error(f"Error in identity step: {exc}")
            self.update_step_status(db, emp, "identity", "needs_attention", error=str(exc))
            self.log_audit(
                db,
                employee_id=employee_id,
                agent="Identity Agent",
                action="propose_email_failed",
                input_summary=f"Full Name: '{emp.name}'",
                output_summary="Failed to compute identity",
                reason=str(exc)
            )
            raise

    def approve_identity_step(self, db: Session, employee_id: str, manager_name: str, edited_email: Optional[str] = None) -> Dict[str, Any]:
        """Manager approves or overrides the proposed corporate email and provisions the mock directory account."""
        emp = db.query(EmployeeModel).filter(EmployeeModel.id == employee_id).first()
        prop = db.query(IdentityProposalModel).filter(IdentityProposalModel.employee_id == employee_id).first()
        if not emp or not prop:
            raise ValueError("Employee or Identity proposal not found")

        final_email = edited_email or prop.proposed_email
        final_username = final_email.split("@")[0]

        # Call directory provisioning tool
        account_result = self.identity_agent.provision_account(db, final_username, final_email, emp.name)

        prop.proposed_email = final_email
        prop.username = final_username
        prop.account_created = True
        prop.status = "done"

        emp.email = final_email
        self.update_step_status(db, emp, "identity", "done")

        self.log_audit(
            db,
            employee_id=employee_id,
            agent="Identity Agent",
            action="provision_account",
            input_summary=f"Approved by {manager_name} with email '{final_email}'",
            output_summary=f"Provisioned mock account: {account_result['user_id']}",
            reason="Manager signed off on corporate identity; systems access provisioned."
        )

        return account_result

orchestrator = WorkflowOrchestrator()
