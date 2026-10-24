from __future__ import annotations
from typing import List, Dict, Optional, Literal, Any
from datetime import datetime
from pydantic import BaseModel, Field

# Skill Status Literal
SkillStatus = Literal["verified", "claimed", "unclear"]
GuideItemStatus = Literal["grounded", "not_documented"]
WorkflowStepStatus = Literal["queued", "running", "waiting_approval", "done", "needs_attention"]

# 1. Employee
class Employee(BaseModel):
    id: str
    name: str
    role: str
    start_date: str
    email: Optional[str] = None
    status: str = "queued"
    github_username: Optional[str] = None
    created_at: Optional[str] = None

# 2. SkillItem & SkillMap
SkillLevel = Literal["beginner", "intermediate", "advanced"]

class SkillItem(BaseModel):
    skill: str
    category: str = "General Engineering"
    level: SkillLevel = "intermediate"
    status: SkillStatus = "claimed"
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)
    evidence: List[str] = Field(default_factory=list)
    signals_used: Dict[str, Any] = Field(default_factory=dict)

class TeamGapAnalysis(BaseModel):
    team: str
    required_skills: List[str] = Field(default_factory=list)
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    coverage_percent: float = 0.0

class RedactionSummary(BaseModel):
    total: int = 0
    phone: int = 0
    address: int = 0
    email: int = 0
    dob: int = 0
    types_removed: List[str] = Field(default_factory=list)

class SkillMap(BaseModel):
    employee_id: str
    skills: List[SkillItem] = Field(default_factory=list)
    gaps_by_team: Dict[str, TeamGapAnalysis] = Field(default_factory=dict)
    verification_state: str = "resume-only"  # "verified" | "resume-only"
    github_summary: Optional[str] = None
    redaction_summary: Optional[RedactionSummary] = None

# 3. Team & Project
class Team(BaseModel):
    name: str
    required_skills: List[str] = Field(default_factory=list)
    capacity: int
    current_load: int
    description: Optional[str] = None

class Project(BaseModel):
    name: str
    team: str
    required_skills: List[str] = Field(default_factory=list)
    difficulty: str = "medium"  # beginner, medium, advanced
    description: Optional[str] = None

# 4. Assignment
class ScoreBreakdown(BaseModel):
    skill_match: float
    gap_coverage: float
    capacity: float
    learning_gap: float
    total_score: float

class TeamCandidate(BaseModel):
    team: str
    project: str
    score_breakdown: ScoreBreakdown
    reason: str
    risk: str
    learning_opportunities: List[str] = Field(default_factory=list)

class Assignment(BaseModel):
    employee_id: str
    team: str
    project: str
    score_breakdown: Dict[str, float] = Field(default_factory=dict)
    reason: str
    approved_by: Optional[str] = None
    overridden: bool = False
    candidates: List[TeamCandidate] = Field(default_factory=list)
    status: WorkflowStepStatus = "waiting_approval"

# 5. Guide & Citations
class Citation(BaseModel):
    doc: str
    section: str

class GuideItem(BaseModel):
    text: str
    citation: Optional[Citation] = None
    status: GuideItemStatus = "grounded"

class GuideSection(BaseModel):
    title: str
    items: List[GuideItem] = Field(default_factory=list)

class Guide(BaseModel):
    employee_id: str
    sections: List[GuideSection] = Field(default_factory=list)
    verified: bool = False

# 6. Audit Entry
class AuditEntry(BaseModel):
    timestamp: str
    agent: str
    action: str
    input_summary: str
    output_summary: str
    reason: str

# 7. Identity Proposal
class IdentityProposal(BaseModel):
    employee_id: str
    proposed_email: str
    username: str
    rule_used: str
    collision_detected: bool = False
    attempts_log: List[str] = Field(default_factory=list)
    status: WorkflowStepStatus = "waiting_approval"
    account_created: bool = False

# 8. API Requests & Responses
class HireCreateRequest(BaseModel):
    name: str
    role: str = "Software Engineer"
    start_date: str = "2026-11-01"
    github_username: Optional[str] = None
    resume_text: Optional[str] = None

class ApprovalRequest(BaseModel):
    manager_name: str = "Engineering Manager"
    notes: Optional[str] = None
    edited_value: Optional[str] = None

class OverrideAssignmentRequest(BaseModel):
    manager_name: str = "Engineering Manager"
    team: str
    project: str
    reason: str

class StepStatusInfo(BaseModel):
    step: str
    status: WorkflowStepStatus
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None

class HireDetailResponse(BaseModel):
    employee: Employee
    steps: Dict[str, StepStatusInfo]
    identity: Optional[IdentityProposal] = None
    skill_map: Optional[SkillMap] = None
    assignment: Optional[Assignment] = None
    guide: Optional[Guide] = None
    audit_logs: List[AuditEntry] = Field(default_factory=list)
    redaction_summary: Optional[RedactionSummary] = None
