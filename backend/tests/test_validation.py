from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_missing_required_name():
    res = client.post("/hires", json={
        "name": "   ",
        "role": "Backend",
        "start_date": "2026-11-01",
        "resume_text": "Experienced engineer with Python, FastAPI, Docker, PostgreSQL, Redis."
    })
    assert res.status_code == 400
    assert "Full Name is required" in res.json()["detail"]

def test_missing_required_role():
    res = client.post("/hires", json={
        "name": "Morgan Riley",
        "role": "   ",
        "start_date": "2026-11-01",
        "resume_text": "Experienced engineer with Python, FastAPI, Docker, PostgreSQL, Redis."
    })
    assert res.status_code == 400
    assert "Role is required" in res.json()["detail"]

def test_missing_required_start_date():
    res = client.post("/hires", json={
        "name": "Morgan Riley",
        "role": "Backend",
        "start_date": "   ",
        "resume_text": "Experienced engineer with Python, FastAPI, Docker, PostgreSQL, Redis."
    })
    assert res.status_code == 400
    assert "Start Date is required" in res.json()["detail"]

def test_minimum_resume_length_enforcement():
    # Less than 50 chars
    res = client.post("/hires", json={
        "name": "Morgan Riley",
        "role": "Backend",
        "start_date": "2026-11-01",
        "resume_text": "Too brief"
    })
    assert res.status_code == 400
    assert "at least 50 characters" in res.json()["detail"]

def test_github_validation_found():
    res = client.get("/validate-github/octocat")
    assert res.status_code == 200
    data = res.json()
    assert data.get("exists") is True

def test_github_validation_not_found():
    # Query non-existent user with random uuid
    res = client.get("/validate-github/user-definitely-does-not-exist-xyz987654321")
    assert res.status_code == 200
    data = res.json()
    assert data.get("exists") is False
    assert "not found" in data.get("error", "").lower()
