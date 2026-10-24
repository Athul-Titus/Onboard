import asyncio
import json
import logging
import uuid
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.db import engine, get_db, Base
from backend.app.models import (
    EmployeeModel,
    IdentityProposalModel,
    SkillMapModel,
    AssignmentModel,
    GuideModel,
    AuditLogModel
)
from backend.app.schemas import (
    HireCreateRequest,
    HireDetailResponse,
    ApprovalRequest,
    OverrideAssignmentRequest,
    Employee,
    IdentityProposal,
    SkillMap,
    Assignment,
    Guide,
    AuditEntry,
    StepStatusInfo,
    TeamGapAnalysis
)
from backend.app.tools.directory import init_mock_directory
from backend.app.orchestrator import orchestrator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("onboardos")

# Initialize database schema
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    description="Multi-agent Employee Onboarding Orchestrator for Engineering Teams",
    version="1.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, List[WebSocket]] = {}

    async def connect(self, hire_id: str, websocket: WebSocket):
        await websocket.accept()
        if hire_id not in self.active_connections:
            self.active_connections[hire_id] = []
        self.active_connections[hire_id].append(websocket)

    def disconnect(self, hire_id: str, websocket: WebSocket):
        if hire_id in self.active_connections:
            self.active_connections[hire_id] = [
                ws for ws in self.active_connections[hire_id] if ws != websocket
            ]

    async def broadcast(self, hire_id: str, message: dict):
        if hire_id in self.active_connections:
            for connection in self.active_connections[hire_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

ws_manager = ConnectionManager()

@app.on_event("startup")
def startup_event():
    """Initializes tables and seeds the mock directory table for email collision tests."""
    with next(get_db()) as db:
        init_mock_directory(db)
    logger.info("OnboardOS backend initialized with seed directory.")

@app.get("/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME, "mock_llm": settings.MOCK_LLM_MODE}

@app.post("/hires", response_model=HireDetailResponse)
def create_hire(req: HireCreateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Creates a new hire intake record and triggers the multi-agent workflow in the background."""
    emp_id = str(uuid.uuid4())
    emp = EmployeeModel(
        id=emp_id,
        name=req.name,
        role=req.role,
        start_date=req.start_date,
        github_username=req.github_username,
        resume_text=req.resume_text,
        status="running",
        current_step="identity",
        step_status_json=json.dumps({
            "identity": {"step": "identity", "status": "queued"},
            "skills": {"step": "skills", "status": "queued"},
            "assignment": {"step": "assignment", "status": "queued"},
            "guide": {"step": "guide", "status": "queued"}
        })
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)

    orchestrator.log_audit(
        db,
        employee_id=emp_id,
        agent="Orchestrator",
        action="intake_created",
        input_summary=f"New Hire: {req.name}, Role: {req.role}",
        output_summary=f"Record {emp_id} initialized",
        reason="Triggered multi-agent onboarding workflow."
    )

    # Run workflow in background thread
    def run_workflow_sync(hire_id: str):
        with next(get_db()) as bg_db:
            try:
                orchestrator.run_full_workflow(bg_db, hire_id)
            except Exception as e:
                logger.error(f"Error in background workflow for {hire_id}: {e}")

    background_tasks.add_task(run_workflow_sync, emp_id)

    return get_hire(emp_id, db)

@app.get("/hires", response_model=List[Employee])
def list_hires(db: Session = Depends(get_db)):
    """Returns a list of all active employee onboarding records."""
    employees = db.query(EmployeeModel).order_by(EmployeeModel.created_at.desc()).all()
    return [
        Employee(
            id=e.id,
            name=e.name,
            role=e.role,
            start_date=e.start_date,
            email=e.email,
            status=e.status,
            github_username=e.github_username
        )
        for e in employees
    ]

@app.get("/hires/{id}", response_model=HireDetailResponse)
def get_hire(id: str, db: Session = Depends(get_db)):
    """Retrieves full detail for a hire, including all agent cards and audit trail."""
    emp = db.query(EmployeeModel).filter(EmployeeModel.id == id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Hire not found")

    # Step status map
    try:
        steps_dict = json.loads(emp.step_status_json or "{}")
        step_status_map = {k: StepStatusInfo(**v) for k, v in steps_dict.items()}
    except Exception:
        step_status_map = {}

    # Identity Proposal
    identity = None
    if emp.identity:
        try:
            attempts = json.loads(emp.identity.attempts_log_json or "[]")
        except Exception:
            attempts = []
        identity = IdentityProposal(
            employee_id=emp.id,
            proposed_email=emp.identity.proposed_email,
            username=emp.identity.username,
            rule_used=emp.identity.rule_used,
            collision_detected=emp.identity.collision_detected,
            attempts_log=attempts,
            status=emp.identity.status,
            account_created=emp.identity.account_created
        )

    # Skill Map
    skill_map = None
    if emp.skill_map:
        try:
            skills = json.loads(emp.skill_map.skills_json or "[]")
            raw_gaps = json.loads(emp.skill_map.gaps_by_team_json or "{}")
            formatted_gaps = {}
            for tname, gval in raw_gaps.items():
                if isinstance(gval, dict):
                    formatted_gaps[tname] = TeamGapAnalysis(**gval)
                elif isinstance(gval, list):
                    formatted_gaps[tname] = TeamGapAnalysis(
                        team=tname,
                        required_skills=[],
                        matched_skills=[],
                        missing_skills=gval,
                        coverage_percent=0.0
                    )
            skill_map = SkillMap(
                employee_id=emp.id,
                skills=skills,
                gaps_by_team=formatted_gaps
            )
        except Exception as e:
            logger.error(f"Error parsing skill map: {e}")

    # Assignment
    assignment = None
    if emp.assignment:
        try:
            breakdown = json.loads(emp.assignment.score_breakdown_json or "{}")
            cands = json.loads(emp.assignment.candidates_json or "[]")
            assignment = Assignment(
                employee_id=emp.id,
                team=emp.assignment.team,
                project=emp.assignment.project,
                score_breakdown=breakdown,
                reason=emp.assignment.reason,
                approved_by=emp.assignment.approved_by,
                overridden=emp.assignment.overridden,
                candidates=cands,
                status=emp.assignment.status
            )
        except Exception as e:
            logger.error(f"Error parsing assignment: {e}")

    # Guide
    guide = None
    if emp.guide:
        try:
            sections = json.loads(emp.guide.sections_json or "[]")
            guide = Guide(
                employee_id=emp.id,
                sections=sections,
                verified=emp.guide.verified
            )
        except Exception as e:
            logger.error(f"Error parsing guide: {e}")

    # Audit Logs
    audit_logs = [
        AuditEntry(
            timestamp=log.timestamp,
            agent=log.agent,
            action=log.action,
            input_summary=log.input_summary,
            output_summary=log.output_summary,
            reason=log.reason
        )
        for log in sorted(emp.audit_logs, key=lambda x: x.timestamp)
    ]

    return HireDetailResponse(
        employee=Employee(
            id=emp.id,
            name=emp.name,
            role=emp.role,
            start_date=emp.start_date,
            email=emp.email,
            status=emp.status,
            github_username=emp.github_username
        ),
        steps=step_status_map,
        identity=identity,
        skill_map=skill_map,
        assignment=assignment,
        guide=guide,
        audit_logs=audit_logs
    )

@app.get("/hires/{id}/audit", response_model=List[AuditEntry])
def get_hire_audit(id: str, db: Session = Depends(get_db)):
    """Returns the immutable audit log rows for a hire."""
    logs = db.query(AuditLogModel).filter(AuditLogModel.employee_id == id).order_by(AuditLogModel.timestamp.asc()).all()
    return [
        AuditEntry(
            timestamp=l.timestamp,
            agent=l.agent,
            action=l.action,
            input_summary=l.input_summary,
            output_summary=l.output_summary,
            reason=l.reason
        )
        for l in logs
    ]

@app.post("/hires/{id}/approve/{step}")
def approve_step(id: str, step: str, req: ApprovalRequest, db: Session = Depends(get_db)):
    """Manager approval gate for consequential steps (e.g. identity, assignment)."""
    if step == "identity":
        res = orchestrator.approve_identity_step(db, id, req.manager_name, req.edited_value)
        return {"status": "approved", "step": "identity", "account": res}
    elif step == "assignment":
        res = orchestrator.approve_assignment_step(db, id, req.manager_name)
        return {"status": "approved", "step": "assignment", "team": res.team, "project": res.project}
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported approval step '{step}'")

@app.post("/hires/{id}/override-assignment")
def override_assignment(id: str, req: OverrideAssignmentRequest, db: Session = Depends(get_db)):
    """Manager override for team and project placement with audited justification."""
    res = orchestrator.override_assignment_step(db, id, req.manager_name, req.team, req.project, req.reason)
    return {"status": "overridden", "team": res.team, "project": res.project, "reason": res.reason}

@app.get("/hires/{id}/export", response_class=PlainTextResponse)
def export_hire_package(id: str, db: Session = Depends(get_db)):
    """Exports a reviewed, markdown-formatted onboarding package for the engineer."""
    hire = get_hire(id, db)
    lines = [
        f"# OnboardOS Employee Onboarding Package",
        f"**Employee Name:** {hire.employee.name}",
        f"**Role:** {hire.employee.role}",
        f"**Start Date:** {hire.employee.start_date}",
        f"**Corporate Email:** {hire.employee.email or 'Pending'}",
        f"**GitHub:** {hire.employee.github_username or 'N/A'}",
        "\n---\n",
        f"## 1. Corporate Identity Provisioning",
    ]

    if hire.identity:
        lines.append(f"- **Provisioned Email:** `{hire.identity.proposed_email}`")
        lines.append(f"- **Rule Used:** `{hire.identity.rule_used}`")
        lines.append(f"- **Collision Encountered:** `{hire.identity.collision_detected}`")
        lines.append(f"- **Resolution Log:**")
        for log in hire.identity.attempts_log:
            lines.append(f"  - {log}")

    lines.append("\n## 2. Evidence-Backed Skill Map")
    if hire.skill_map:
        for s in hire.skill_map.skills:
            badge = "[VERIFIED]" if s.status == "verified" else "[CLAIMED]"
            lines.append(f"- **{s.skill}** {badge} ({s.level}, confidence: {round(s.confidence*100)}%)")
            for ev in s.evidence:
                lines.append(f"  - Evidence: {ev}")

    lines.append("\n## 3. Team & Project Placement")
    if hire.assignment:
        lines.append(f"- **Assigned Team:** {hire.assignment.team}")
        lines.append(f"- **Starter Project:** {hire.assignment.project}")
        lines.append(f"- **Deterministic Score:** {hire.assignment.score_breakdown.get('total_score', 'N/A')}")
        lines.append(f"- **Manager Sign-off:** {hire.assignment.approved_by or 'Pending Approval'}")
        lines.append(f"- **Strategic Rationale:** {hire.assignment.reason}")

    lines.append("\n## 4. Grounded 30-Day Onboarding Guide")
    if hire.guide:
        for sec in hire.guide.sections:
            lines.append(f"\n### {sec.title}")
            for item in sec.items:
                if item.citation:
                    lines.append(f"- {item.text} *(Source: [{item.citation.doc}] {item.citation.section})*")
                else:
                    lines.append(f"- **{item.text}**")

    lines.append("\n---\n*Generated by OnboardOS Multi-Agent Orchestrator*")
    return "\n".join(lines)

@app.websocket("/ws/hires/{id}")
async def websocket_hire(websocket: WebSocket, id: str):
    """Live streaming websocket for real-time hire status updates."""
    await ws_manager.connect(id, websocket)
    try:
        while True:
            # Keep-alive heartbeat and receive client pings
            data = await websocket.receive_text()
            with next(get_db()) as db:
                hire_data = get_hire(id, db)
                await websocket.send_json(hire_data.model_dump())
    except WebSocketDisconnect:
        ws_manager.disconnect(id, websocket)
