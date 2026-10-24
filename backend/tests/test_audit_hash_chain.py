import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db import SessionLocal
from backend.app.models import EmployeeModel, AuditLogModel
from backend.app.orchestrator import orchestrator

client = TestClient(app)

def test_hash_chain_and_append_only():
    db = SessionLocal()
    emp_id = "test-hash-emp-1"
    try:
        emp = EmployeeModel(
            id=emp_id,
            name="Alice Smith",
            role="Frontend Engineer",
            start_date="2026-11-01"
        )
        db.add(emp)
        db.commit()

        # Run identity step which logs tool invocation and step entry
        orchestrator.run_identity_step(db, emp_id)
        # Run skills step which logs tool invocation and step entry
        orchestrator.run_skills_step(db, emp_id)

        # 1. Verify integrity endpoint returns INTACT
        res = client.get(f"/hires/{emp_id}/audit/verify")
        assert res.status_code == 200
        data = res.json()
        assert data["valid"] is True
        assert data["chain_status"] == "INTACT"
        assert data["total_entries"] > 0

        # Verify hash continuity in database
        logs = db.query(AuditLogModel).filter(AuditLogModel.employee_id == emp_id).order_by(AuditLogModel.timestamp.asc(), AuditLogModel.id.asc()).all()
        for idx in range(1, len(logs)):
            assert logs[idx].previous_hash == logs[idx - 1].entry_hash

        # 2. Verify append-only enforcement: attempt to update AuditLogModel raises PermissionError
        with pytest.raises(PermissionError, match="strictly append-only"):
            first_log = logs[0]
            first_log.input_summary = "TAMPERED INPUT"
            db.commit()
        db.rollback()

        # 3. Verify API reject paths: PUT/DELETE /hires/{id}/audit return 405
        put_res = client.put(f"/hires/{emp_id}/audit")
        assert put_res.status_code == 405

        del_res = client.delete(f"/hires/{emp_id}/audit")
        assert del_res.status_code == 405

    finally:
        db.query(AuditLogModel).filter(AuditLogModel.employee_id == emp_id).delete()
        db.query(EmployeeModel).filter(EmployeeModel.id == emp_id).delete()
        db.commit()
        db.close()
