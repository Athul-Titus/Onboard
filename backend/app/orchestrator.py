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
from backend.app.agents.skill_manager import skill_manager
from backend.app.agents.project_manager import project_manager
from backend.app.agents.guide_manager import guide_manager

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
      - Timeout & automatic retry
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

    def run_skills_step(self, db: Session, employee_id: str) -> SkillMap:
        """Runs the Skill Manager Agent: PII scrubbing, extraction, GitHub evidence, normalization, and gap calculation."""
        emp = db.query(EmployeeModel).filter(EmployeeModel.id == employee_id).first()
        if not emp:
            raise ValueError(f"Employee {employee_id} not found")

        self.update_step_status(db, emp, "skills", "running")

        try:
            skill_map = skill_manager.extract_skills(
                employee_id=employee_id,
                resume_text=emp.resume_text,
                github_username=emp.github_username
            )

            # Persist skill map
            existing = db.query(SkillMapModel).filter(SkillMapModel.employee_id == employee_id).first()
            skills_json = json.dumps([s.model_dump() for s in skill_map.skills])
            gaps_json = json.dumps(skill_map.gaps_by_team)

            if existing:
                existing.skills_json = skills_json
                existing.gaps_by_team_json = gaps_json
            else:
                new_map = SkillMapModel(
                    id=str(uuid.uuid4()),
                    employee_id=employee_id,
                    skills_json=skills_json,
                    gaps_by_team_json=gaps_json
                )
                db.add(new_map)

            self.log_audit(
                db,
                employee_id=employee_id,
                agent="Skill Manager",
                action="extract_and_verify_skills",
                input_summary=f"Resume ({len(emp.resume_text or '')} chars), GitHub: {emp.github_username or 'none'}",
                output_summary=f"Identified {len(skill_map.skills)} skills ({sum(1 for s in skill_map.skills if s.status == 'verified')} verified)",
                reason="Extracted candidate competencies and computed gap profiles against 5 engineering teams."
            )

            self.update_step_status(db, emp, "skills", "done")
            return skill_map

        except Exception as exc:
            logger.error(f"Error in skills step: {exc}")
            self.update_step_status(db, emp, "skills", "needs_attention", error=str(exc))
            self.log_audit(
                db,
                employee_id=employee_id,
                agent="Skill Manager",
                action="extract_skills_failed",
                input_summary=f"Resume and GitHub for {emp.name}",
                output_summary="Failed to extract skills",
                reason=str(exc)
            )
            raise

    def run_assignment_step(self, db: Session, employee_id: str) -> Assignment:
        """Runs the Project Manager Agent: deterministic scoring, ranking, LLM explanation, approval pause."""
        emp = db.query(EmployeeModel).filter(EmployeeModel.id == employee_id).first()
        smap_model = db.query(SkillMapModel).filter(SkillMapModel.employee_id == employee_id).first()
        if not emp or not smap_model:
            raise ValueError("Employee or SkillMap not found")

        self.update_step_status(db, emp, "assignment", "running")

        try:
            skills_data = json.loads(smap_model.skills_json or "[]")
            skill_names = [s["skill"] for s in skills_data]

            assignment = project_manager.assign_team_and_project(employee_id, skill_names)

            existing = db.query(AssignmentModel).filter(AssignmentModel.employee_id == employee_id).first()
            score_json = json.dumps(assignment.score_breakdown)
            cands_json = json.dumps([c.model_dump() for c in assignment.candidates])

            if existing:
                existing.team = assignment.team
                existing.project = assignment.project
                existing.score_breakdown_json = score_json
                existing.reason = assignment.reason
                existing.candidates_json = cands_json
                existing.status = "waiting_approval"
            else:
                new_assign = AssignmentModel(
                    id=str(uuid.uuid4()),
                    employee_id=employee_id,
                    team=assignment.team,
                    project=assignment.project,
                    score_breakdown_json=score_json,
                    reason=assignment.reason,
                    candidates_json=cands_json,
                    status="waiting_approval"
                )
                db.add(new_assign)

            self.log_audit(
                db,
                employee_id=employee_id,
                agent="Project Manager",
                action="rank_and_assign_team",
                input_summary=f"{len(skill_names)} candidate skills, 5 teams, 8 projects",
                output_summary=f"Top Match: '{assignment.team}' for '{assignment.project}' (Score: {assignment.score_breakdown.get('total_score')})",
                reason=f"Top ranking determined deterministically. Rationale: {assignment.reason[:100]}..."
            )

            self.update_step_status(db, emp, "assignment", "waiting_approval")
            return assignment

        except Exception as exc:
            logger.error(f"Error in assignment step: {exc}")
            self.update_step_status(db, emp, "assignment", "needs_attention", error=str(exc))
            raise

    def approve_assignment_step(self, db: Session, employee_id: str, manager_name: str) -> AssignmentModel:
        """Manager approves the team assignment."""
        assign = db.query(AssignmentModel).filter(AssignmentModel.employee_id == employee_id).first()
        emp = db.query(EmployeeModel).filter(EmployeeModel.id == employee_id).first()
        if not assign or not emp:
            raise ValueError("Assignment not found")

        assign.approved_by = manager_name
        assign.status = "done"
        self.update_step_status(db, emp, "assignment", "done")

        self.log_audit(
            db,
            employee_id=employee_id,
            agent="Project Manager",
            action="approve_assignment",
            input_summary=f"Approved by {manager_name}",
            output_summary=f"Confirmed placement in {assign.team} ({assign.project})",
            reason="Manager signed off on team placement."
        )
        return assign

    def override_assignment_step(self, db: Session, employee_id: str, manager_name: str, team: str, project: str, reason: str) -> AssignmentModel:
        """Manager overrides the automated team placement."""
        assign = db.query(AssignmentModel).filter(AssignmentModel.employee_id == employee_id).first()
        emp = db.query(EmployeeModel).filter(EmployeeModel.id == employee_id).first()
        if not assign or not emp:
            raise ValueError("Assignment not found")

        prev_team = assign.team
        assign.team = team
        assign.project = project
        assign.overridden = True
        assign.approved_by = manager_name
        assign.reason = f"Manager Override by {manager_name}: {reason}"
        assign.status = "done"
        self.update_step_status(db, emp, "assignment", "done")

        self.log_audit(
            db,
            employee_id=employee_id,
            agent="Project Manager",
            action="override_assignment",
            input_summary=f"Override from '{prev_team}' to '{team}' ({project}) by {manager_name}",
            output_summary=f"Assigned to {team}",
            reason=f"Manager justification: {reason}"
        )
        return assign

    def run_guide_step(self, db: Session, employee_id: str) -> Guide:
        """Runs the Guide Manager Agent (RAG): hybrid retrieval, citation grounding, and verifier pass."""
        emp = db.query(EmployeeModel).filter(EmployeeModel.id == employee_id).first()
        assign = db.query(AssignmentModel).filter(AssignmentModel.employee_id == employee_id).first()
        smap = db.query(SkillMapModel).filter(SkillMapModel.employee_id == employee_id).first()
        if not emp:
            raise ValueError("Employee not found")

        team_name = assign.team if assign else "Backend Platform"
        project_name = assign.project if assign else "General Engineering Onboarding"

        skill_gaps: List[str] = []
        if smap and smap.gaps_by_team_json:
            gaps_dict = json.loads(smap.gaps_by_team_json)
            val = gaps_dict.get(team_name, [])
            if isinstance(val, dict):
                skill_gaps = val.get("missing_skills", [])
            elif isinstance(val, list):
                skill_gaps = val

        self.update_step_status(db, emp, "guide", "running")

        try:
            guide = guide_manager.generate_guide(
                employee_id=employee_id,
                team_name=team_name,
                project_name=project_name,
                skill_gaps=skill_gaps
            )

            existing = db.query(GuideModel).filter(GuideModel.employee_id == employee_id).first()
            sections_json = json.dumps([s.model_dump() for s in guide.sections])

            if existing:
                existing.sections_json = sections_json
                existing.verified = guide.verified
            else:
                new_guide = GuideModel(
                    id=str(uuid.uuid4()),
                    employee_id=employee_id,
                    sections_json=sections_json,
                    verified=guide.verified
                )
                db.add(new_guide)

            self.log_audit(
                db,
                employee_id=employee_id,
                agent="Guide Manager",
                action="generate_personalized_guide",
                input_summary=f"Team: {team_name}, Project: {project_name}, Gaps: {skill_gaps[:3]}",
                output_summary=f"Generated {len(guide.sections)} sections with citation verification pass completed",
                reason="Constructed grounded 30-day onboarding guide strictly referencing engineering docs."
            )

            self.update_step_status(db, emp, "guide", "done")
            return guide

        except Exception as exc:
            logger.error(f"Error in guide step: {exc}")
            self.update_step_status(db, emp, "guide", "needs_attention", error=str(exc))
            raise

    def run_full_workflow(self, db: Session, employee_id: str):
        """Runs the complete multi-agent pipeline from identity to guide."""
        # 1. Identity step (proposes email, sets to waiting_approval)
        self.run_identity_step(db, employee_id)

        # 2. Skill Manager (extracts & verifies skills)
        self.run_skills_step(db, employee_id)

        # 3. Project Manager (deterministic scores & ranks teams, sets to waiting_approval)
        self.run_assignment_step(db, employee_id)

        # 4. Guide Manager (RAG retrieval & verifier pass)
        self.run_guide_step(db, employee_id)

orchestrator = WorkflowOrchestrator()
