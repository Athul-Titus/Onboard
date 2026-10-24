import json
import logging
from pathlib import Path
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from backend.app.models import (
    EmployeeModel,
    IdentityProposalModel,
    SkillMapModel,
    AssignmentModel,
    GuideModel,
    AuditLogModel
)

logger = logging.getLogger("onboardos.seed")

def parse_dt(val):
    if not val:
        return datetime.now(timezone.utc)
    if isinstance(val, str):
        try:
            return datetime.fromisoformat(val)
        except Exception:
            return datetime.now(timezone.utc)
    return val

def init_demo_database(db: Session) -> None:
    """Pre-seeds the database with demo engineering hires if empty, ensuring Render/cloud instances have initial data."""
    if db.query(EmployeeModel).count() > 0:
        return

    seed_file = Path(__file__).resolve().parent.parent / "data" / "seed" / "initial_demo_database.json"
    if not seed_file.exists():
        logger.warning(f"Seed file not found at {seed_file}")
        return

    try:
        with open(seed_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        # 1. Employees
        for row in data.get("employees", []):
            emp = EmployeeModel(
                id=row["id"],
                name=row["name"],
                role=row["role"],
                start_date=row["start_date"],
                email=row.get("email"),
                status=row.get("status", "queued"),
                github_username=row.get("github_username"),
                resume_text=row.get("resume_text"),
                current_step=row.get("current_step", "identity"),
                step_status_json=row.get("step_status_json", "{}"),
                created_at=parse_dt(row.get("created_at")),
                updated_at=parse_dt(row.get("updated_at"))
            )
            db.add(emp)
        db.commit()

        # 2. Identities
        for row in data.get("identity_proposals", []):
            ident = IdentityProposalModel(
                id=row["id"],
                employee_id=row["employee_id"],
                proposed_email=row["proposed_email"],
                username=row["username"],
                rule_used=row["rule_used"],
                collision_detected=bool(row.get("collision_detected", False)),
                attempts_log_json=row.get("attempts_log_json", "[]"),
                status=row.get("status", "waiting_approval"),
                account_created=bool(row.get("account_created", False)),
                created_at=parse_dt(row.get("created_at"))
            )
            db.add(ident)
        db.commit()

        # 3. Skill Maps
        for row in data.get("skill_maps", []):
            sm = SkillMapModel(
                id=row["id"],
                employee_id=row["employee_id"],
                skills_json=row.get("skills_json", "[]"),
                gaps_by_team_json=row.get("gaps_by_team_json", "{}"),
                created_at=parse_dt(row.get("created_at"))
            )
            db.add(sm)
        db.commit()

        # 4. Assignments
        for row in data.get("assignments", []):
            assign = AssignmentModel(
                id=row["id"],
                employee_id=row["employee_id"],
                team=row["team"],
                project=row["project"],
                score_breakdown_json=row.get("score_breakdown_json", "{}"),
                candidates_json=row.get("candidates_json", "[]"),
                reason=row.get("reason", ""),
                approved_by=row.get("approved_by"),
                overridden=bool(row.get("overridden", False)),
                status=row.get("status", "waiting_approval"),
                created_at=parse_dt(row.get("created_at"))
            )
            db.add(assign)
        db.commit()

        # 5. Guides
        for row in data.get("guides", []):
            guide = GuideModel(
                id=row["id"],
                employee_id=row["employee_id"],
                sections_json=row.get("sections_json", "[]"),
                verified=bool(row.get("verified", False)),
                verified_count=row.get("verified_count", 0) or 0,
                total_count=row.get("total_count", 0) or 0,
                created_at=parse_dt(row.get("created_at"))
            )
            db.add(guide)
        db.commit()

        # 6. Audit Logs
        for row in data.get("audit_logs", []):
            log = AuditLogModel(
                id=row["id"],
                employee_id=row["employee_id"],
                timestamp=row["timestamp"],
                agent=row["agent"],
                action=row["action"],
                input_summary=row["input_summary"],
                output_summary=row["output_summary"],
                reason=row["reason"],
                entry_type=row.get("entry_type", "agent_step"),
                actor=row.get("actor", "System"),
                duration_ms=float(row.get("duration_ms", 0.0) or 0.0),
                previous_hash=row.get("previous_hash"),
                entry_hash=row.get("entry_hash")
            )
            db.add(log)
        db.commit()

        logger.info(f"Successfully seeded database with {len(data.get('employees', []))} demo hires.")
    except Exception as e:
        logger.error(f"Error seeding demo database: {e}")
        db.rollback()
