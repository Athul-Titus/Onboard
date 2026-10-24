from backend.app.agents.skill_manager import skill_manager
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_redact_pii_with_summary_all_types():
    raw_resume = """
    Jane Smith - Senior Platform Engineer
    Phone: +1 (555) 234-5678
    Email: jane.smith@gmail.com
    DOB: 1993-08-21
    Address: 742 Evergreen Terrace, Springfield
    Skills: Python, Go, Docker, Kubernetes, Terraform.
    Experience: 7 years developing distributed cloud infrastructure.
    """
    redacted, summary = skill_manager.redact_pii_with_summary(raw_resume)

    assert "[PHONE REDACTED]" in redacted
    assert "[EMAIL REDACTED]" in redacted
    assert "[DOB REDACTED]" in redacted
    assert "[ADDRESS REDACTED]" in redacted

    assert summary["phone"] >= 1
    assert summary["email"] >= 1
    assert summary["dob"] >= 1
    assert summary["address"] >= 1
    assert summary["total"] >= 4
    for pii_type in ["phone", "email", "dob", "address"]:
        assert pii_type in summary["types_removed"]

def test_redact_pii_clean_resume():
    clean_resume = """
    Software Engineer with 4 years of experience in React, TypeScript, and Node.js.
    Led migration from REST to GraphQL API, improving query latency by 45%.
    Proficient in automated CI/CD pipelines, Jest unit testing, and Docker containers.
    """
    redacted, summary = skill_manager.redact_pii_with_summary(clean_resume)
    assert summary["total"] == 0
    assert summary["types_removed"] == []
    assert summary["phone"] == 0
    assert summary["email"] == 0

def test_hire_endpoint_returns_redaction_summary():
    payload = {
        "name": "Jordan Lee",
        "role": "Backend",
        "start_date": "2026-11-20",
        "github_username": "octocat",
        "resume_text": (
            "Senior Backend Engineer with 5 years experience in Python and FastAPI. "
            "Contact: +1-555-8888, 456 Market Street, jordan@gmail.com, DOB: 1995-02-14. "
            "Skills: Python, FastAPI, Docker, PostgreSQL."
        )
    }
    res = client.post("/hires", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "redaction_summary" in data
    rs = data["redaction_summary"]
    assert rs["total"] >= 4
    assert rs["phone"] >= 1
    assert rs["email"] >= 1
    assert rs["address"] >= 1
    assert rs["dob"] >= 1
