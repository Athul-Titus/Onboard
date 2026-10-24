import uuid
import pytest
from backend.app.db import SessionLocal
from backend.app.models import EmployeeModel, AuditLogModel
from backend.app.orchestrator import orchestrator
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_audit_logs_never_contain_raw_pii_from_resume_or_intake():
    """
    Step 7 requirement: Never log redacted PII values; log only counts and types removed.
    Verifies that when a candidate with phone, personal email, address, and DOB is processed:
    1. Zero raw PII strings appear in any audit log row.
    2. PII Scrubber logs only counts and types removed.
    """
    db = SessionLocal()
    uid = uuid.uuid4().hex[:8]
    emp_id = f"test-pii-emp-{uid}"

    phone_val = "+1 (555) 789-0123"
    email_val = f"cand.priv.{uid}@gmail.com"
    addr_val = "742 Evergreen Terrace, Springfield"
    dob_val = "1994-06-15"

    raw_resume = f"""
    Elena Rostova - Cloud Infrastructure Architect
    Contact: {phone_val}, {addr_val}, {email_val}
    DOB: {dob_val}
    Experience: 8 years building distributed systems, Kubernetes operators, and high-throughput APIs in Python and Go.
    Projects: Led multi-region failover architecture on AWS.
    Skills: Python, Go, Docker, Kubernetes, Terraform, AWS, PostgreSQL.
    """

    try:
        emp = EmployeeModel(
            id=emp_id,
            name="Elena Rostova",
            role="Cloud Architect",
            start_date="2026-11-15",
            github_username="elena-cloud",
            resume_text=raw_resume
        )
        db.add(emp)
        db.commit()

        # Run skills step (which invokes PII scrubbing and logs tool calls + verification)
        orchestrator.run_skills_step(db, emp_id)

        # Retrieve all audit entries for this employee
        audit_entries = db.query(AuditLogModel).filter(AuditLogModel.employee_id == emp_id).all()
        assert len(audit_entries) >= 2, "Expected at least PII scrubber and skill verification audit logs"

        # 1. Strict verification: NO raw PII values exist in ANY audit entry field
        for entry in audit_entries:
            combined_text = f"{entry.input_summary} {entry.output_summary} {entry.reason}"
            assert phone_val not in combined_text, f"Raw phone leaked in audit log: {combined_text}"
            assert "789-0123" not in combined_text, f"Partial phone leaked in audit log: {combined_text}"
            assert email_val not in combined_text, f"Raw personal email leaked in audit log: {combined_text}"
            assert addr_val not in combined_text, f"Raw address leaked in audit log: {combined_text}"
            assert dob_val not in combined_text, f"Raw DOB leaked in audit log: {combined_text}"

        # 2. Check PII Scrubber entry specifically: must state counts and types only
        pii_log = next((e for e in audit_entries if e.agent == "PII Scrubber" or e.action == "redact_pii"), None)
        assert pii_log is not None, "Expected an explicit 'PII Scrubber' audit log entry"
        assert pii_log.entry_type == "agent_step"
        assert pii_log.actor == "Skill Manager"

        # Check output summary has counts and types removed
        assert "Total items removed:" in pii_log.output_summary
        assert "Types:" in pii_log.output_summary
        for expected_type in ["phone", "email", "address", "dob"]:
            assert expected_type in pii_log.output_summary.lower()

        # Check reason explains counts removed without raw values
        assert "phone" in pii_log.reason.lower()
        assert "email" in pii_log.reason.lower()
        assert "address" in pii_log.reason.lower()
        assert "dob" in pii_log.reason.lower()
        assert "discarded" in pii_log.reason.lower() or "privacy" in pii_log.reason.lower()

    finally:
        db.close()


def test_log_audit_guardrail_sanitizes_accidental_pii():
    """
    Verifies that orchestrator.log_audit defensive sanitizer strips any raw PII
    accidentally passed in input_summary, output_summary, or reason, recording
    only counts and types removed.
    """
    db = SessionLocal()
    uid = uuid.uuid4().hex[:8]
    emp_id = f"test-leak-emp-{uid}"

    raw_phone = "+1 (555) 444-3322"
    raw_addr = "99 Bellevue Boulevard"
    raw_email = "direct.leak@yahoo.com"
    raw_dob = "DOB: 1989-11-23"

    try:
        entry = orchestrator.log_audit(
            db=db,
            employee_id=emp_id,
            agent="SecurityAuditor",
            action="test_sanitization",
            input_summary=f"Candidate contact: {raw_phone} located at {raw_addr}",
            output_summary=f"Personal candidate email is {raw_email}",
            reason=f"Candidate background verified with {raw_dob}",
            entry_type="agent_step",
            actor="System"
        )

        # Retrieve saved record
        saved = db.query(AuditLogModel).filter(AuditLogModel.id == entry.id).first()
        assert saved is not None

        # Verify raw values are NOT stored
        assert raw_phone not in saved.input_summary
        assert "444-3322" not in saved.input_summary
        assert raw_addr not in saved.input_summary
        assert raw_email not in saved.output_summary
        assert "1989-11-23" not in saved.reason

        # Verify counts and types are recorded
        assert "PII Sanitized:" in saved.input_summary
        assert "phone" in saved.input_summary.lower()
        assert "address" in saved.input_summary.lower()

        assert "PII Sanitized:" in saved.output_summary
        assert "email" in saved.output_summary.lower()

        assert "PII Sanitized:" in saved.reason
        assert "dob" in saved.reason.lower()

        # Verify hash integrity remains valid
        res = client.get(f"/hires/{emp_id}/audit/verify")
        assert res.status_code == 200
        verify_data = res.json()
        assert verify_data["valid"] is True
        assert verify_data["chain_status"] == "INTACT"

    finally:
        db.close()
