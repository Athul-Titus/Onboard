import pytest
from pydantic import BaseModel, ValidationError
from backend.app.db import SessionLocal
from backend.app.orchestrator import orchestrator
from backend.app.models import EmployeeModel, AuditLogModel, MockDirectoryUser
from backend.app.llm_client import LLMClient

class MockSchema(BaseModel):
    required_name: str
    required_number: int

def test_failures_and_recovery_logging():
    db = SessionLocal()
    emp_id = "test-fail-emp-1"
    try:
        emp = EmployeeModel(
            id=emp_id,
            name="John Doe",  # Triggers collision with seeded 'john.doe@company.com'
            role="Platform Engineer",
            start_date="2026-11-01"
        )
        db.add(emp)
        db.commit()

        # 1. Identity step triggers email collision resolution
        orchestrator.run_identity_step(db, emp_id)

        # 2. Trigger needs_attention event by giving invalid employee id or forcing step error
        with pytest.raises(Exception):
            orchestrator.run_identity_step(db, "non-existent-employee-xyz")

        # 3. Test LLM client schema validation failure and retry logging
        llm = LLMClient()
        llm.mock_mode = False  # disable mock to hit structured validation logic

        # Force a call with invalid mock provider or broken JSON parse to test schema failure
        def bad_invoke(sys, usr, model):
            return "{\"invalid\": \"schema\"}"

        llm._invoke_provider = bad_invoke

        fallback_called = False
        def fallback():
            nonlocal fallback_called
            fallback_called = True
            return MockSchema(required_name="recovered", required_number=42)

        result = llm.call_structured(
            system_prompt="Test",
            user_prompt="Test prompt",
            response_model=MockSchema,
            fallback_factory=fallback,
            employee_id=emp_id,
            db=db,
            agent_name="Test LLM"
        )

        assert fallback_called is True
        assert result.required_name == "recovered"

        # 4. Test timeout logging
        def timeout_invoke(sys, usr, model):
            raise TimeoutError("Simulated LLM socket timeout")

        llm._invoke_provider = timeout_invoke
        llm.call_structured(
            system_prompt="Test",
            user_prompt="Test timeout",
            response_model=MockSchema,
            fallback_factory=fallback,
            employee_id=emp_id,
            db=db,
            agent_name="Test LLM"
        )

        # Query all failure_recovery entries
        fail_logs = db.query(AuditLogModel).filter(
            AuditLogModel.employee_id == emp_id,
            AuditLogModel.entry_type == "failure_recovery"
        ).all()

        actions = [l.action for l in fail_logs]

        # Verify email collision resolution
        assert "email_collision_resolved" in actions, f"Missing email_collision_resolved in {actions}"
        collision_log = next(l for l in fail_logs if l.action == "email_collision_resolved")
        assert "Rule tried:" in collision_log.input_summary
        assert "Next rule:" in collision_log.output_summary

        # Verify schema validation failure
        assert "schema_validation_failed" in actions, f"Missing schema_validation_failed in {actions}"
        schema_log = next(l for l in fail_logs if l.action == "schema_validation_failed")
        assert "MockSchema" in schema_log.input_summary

        # Verify retry
        assert "retry_initiated" in actions, f"Missing retry_initiated in {actions}"

        # Verify timeout
        assert "timeout" in actions, f"Missing timeout in {actions}"

    finally:
        db.query(AuditLogModel).filter(AuditLogModel.employee_id == emp_id).delete()
        db.query(EmployeeModel).filter(EmployeeModel.id == emp_id).delete()
        db.commit()
        db.close()
