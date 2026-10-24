import json
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.config import settings
from backend.app.db import Base
from backend.app.models import MockDirectoryUser, EmployeeModel
from backend.app.tools.directory import (
    init_mock_directory,
    check_email_available,
    check_username_available,
    create_account
)
from backend.app.schemas import Team, Project

def test_m1_scaffold_and_db():
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=test_engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    db = TestingSessionLocal()
    try:
        # 2. Test mock directory seeding
        init_mock_directory(db)
        count = db.query(MockDirectoryUser).count()
        assert count >= 8, f"Expected at least 8 seeded mock users, got {count}"

        # 3. Test collision detection with known pre-seeded email
        assert check_email_available(db, "john.doe@company.com") is False
        assert check_email_available(db, "brand.new.user@company.com") is True

        # 4. Test account creation
        new_account = create_account(db, "brand.new", "brand.new@company.com", "Brand New")
        assert new_account["mock"] is True
        assert new_account["email"] == "brand.new@company.com"
        assert check_email_available(db, "brand.new@company.com") is False
    finally:
        db.close()

def test_seed_data_integrity():
    # Verify teams.json
    teams_path = settings.SEED_DIR / "teams.json"
    assert teams_path.exists(), "teams.json does not exist"
    with open(teams_path, "r", encoding="utf-8") as f:
        teams_data = json.load(f)
    assert len(teams_data) >= 5
    for t in teams_data:
        team_obj = Team(**t)
        assert len(team_obj.required_skills) > 0
        assert team_obj.capacity > 0

    # Verify projects.json
    projects_path = settings.SEED_DIR / "projects.json"
    assert projects_path.exists(), "projects.json does not exist"
    with open(projects_path, "r", encoding="utf-8") as f:
        projects_data = json.load(f)
    assert len(projects_data) >= 8
    for p in projects_data:
        proj_obj = Project(**p)
        assert len(proj_obj.required_skills) > 0

    # Verify skills_ontology.json
    skills_path = settings.SEED_DIR / "skills_ontology.json"
    assert skills_path.exists(), "skills_ontology.json does not exist"
    with open(skills_path, "r", encoding="utf-8") as f:
        skills_data = json.load(f)
    assert len(skills_data["skills"]) >= 50

    # Verify docs
    doc_files = list(settings.DOCS_DIR.glob("*.md"))
    assert len(doc_files) >= 12, f"Expected >= 12 docs, found {len(doc_files)}"
