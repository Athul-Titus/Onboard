from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, Integer, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from backend.app.db import Base

def utc_now():
    return datetime.now(timezone.utc)

class EmployeeModel(Base):
    __tablename__ = "employees"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    start_date = Column(String, nullable=False)
    email = Column(String, nullable=True)
    status = Column(String, default="queued")
    github_username = Column(String, nullable=True)
    resume_text = Column(Text, nullable=True)
    current_step = Column(String, default="identity")
    step_status_json = Column(Text, default="{}")
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    identity = relationship("IdentityProposalModel", back_populates="employee", uselist=False, cascade="all, delete-orphan")
    skill_map = relationship("SkillMapModel", back_populates="employee", uselist=False, cascade="all, delete-orphan")
    assignment = relationship("AssignmentModel", back_populates="employee", uselist=False, cascade="all, delete-orphan")
    guide = relationship("GuideModel", back_populates="employee", uselist=False, cascade="all, delete-orphan")
    audit_logs = relationship("AuditLogModel", back_populates="employee", cascade="all, delete-orphan")


class IdentityProposalModel(Base):
    __tablename__ = "identity_proposals"

    id = Column(String, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employees.id"), unique=True, nullable=False)
    proposed_email = Column(String, nullable=False)
    username = Column(String, nullable=False)
    rule_used = Column(String, nullable=False)
    collision_detected = Column(Boolean, default=False)
    attempts_log_json = Column(Text, default="[]")
    status = Column(String, default="waiting_approval")
    account_created = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)

    employee = relationship("EmployeeModel", back_populates="identity")


class SkillMapModel(Base):
    __tablename__ = "skill_maps"

    id = Column(String, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employees.id"), unique=True, nullable=False)
    skills_json = Column(Text, default="[]")
    gaps_by_team_json = Column(Text, default="{}")
    created_at = Column(DateTime, default=utc_now)

    employee = relationship("EmployeeModel", back_populates="skill_map")


class AssignmentModel(Base):
    __tablename__ = "assignments"

    id = Column(String, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employees.id"), unique=True, nullable=False)
    team = Column(String, nullable=False)
    project = Column(String, nullable=False)
    score_breakdown_json = Column(Text, default="{}")
    reason = Column(Text, nullable=False)
    approved_by = Column(String, nullable=True)
    overridden = Column(Boolean, default=False)
    candidates_json = Column(Text, default="[]")
    status = Column(String, default="waiting_approval")
    created_at = Column(DateTime, default=utc_now)

    employee = relationship("EmployeeModel", back_populates="assignment")


class GuideModel(Base):
    __tablename__ = "guides"

    id = Column(String, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employees.id"), unique=True, nullable=False)
    sections_json = Column(Text, default="[]")
    verified = Column(Boolean, default=False)
    verified_count = Column(Integer, default=0)
    total_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=utc_now)

    employee = relationship("EmployeeModel", back_populates="guide")


class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employees.id"), index=True, nullable=False)
    timestamp = Column(String, nullable=False)
    agent = Column(String, nullable=False)
    action = Column(String, nullable=False)
    input_summary = Column(Text, nullable=False)
    output_summary = Column(Text, nullable=False)
    reason = Column(Text, nullable=False)

    employee = relationship("EmployeeModel", back_populates="audit_logs")


class MockDirectoryUser(Base):
    """Pre-populated mock directory table to genuinely trigger email collisions and simulate account provisioning."""
    __tablename__ = "mock_directory_users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
