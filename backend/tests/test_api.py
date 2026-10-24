from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "OnboardOS" in data["app"]

def test_create_and_get_hire():
    # Test intake creation
    payload = {
        "name": "Alex Vance",
        "role": "Distributed Systems Engineer",
        "start_date": "2026-11-15",
        "github_username": "octocat",
        "resume_text": "Experienced engineer with Python, FastAPI, Docker, PostgreSQL, Redis, and high-throughput systems."
    }
    create_res = client.post("/hires", json=payload)
    assert create_res.status_code == 200
    created_hire = create_res.json()
    assert created_hire["employee"]["name"] == "Alex Vance"
    hire_id = created_hire["employee"]["id"]

    # Test get hire details
    get_res = client.get(f"/hires/{hire_id}")
    assert get_res.status_code == 200
    detail = get_res.json()
    assert detail["employee"]["id"] == hire_id
    assert "identity" in detail
    assert "steps" in detail

    # Test audit log endpoint
    audit_res = client.get(f"/hires/{hire_id}/audit")
    assert audit_res.status_code == 200
    audit_list = audit_res.json()
    assert len(audit_list) >= 1

    # Test export package
    export_res = client.get(f"/hires/{hire_id}/export")
    assert export_res.status_code == 200
    assert "OnboardOS Employee Onboarding Package" in export_res.text

def test_hire_validation_errors():
    # Empty name
    res = client.post("/hires", json={"name": "", "role": "Backend", "start_date": "2026-11-01", "resume_text": "A" * 60})
    assert res.status_code == 400
    assert "Full Name is required" in res.json()["detail"]

    # Short resume (< 50 chars)
    res = client.post("/hires", json={"name": "Valid Name", "role": "Backend", "start_date": "2026-11-01", "resume_text": "Too short"})
    assert res.status_code == 400
    assert "at least 50 characters" in res.json()["detail"]

def test_validate_github_endpoint():
    res = client.get("/validate-github/octocat")
    assert res.status_code == 200
    data = res.json()
    assert "exists" in data
