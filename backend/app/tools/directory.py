import uuid
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from backend.app.models import MockDirectoryUser

INITIAL_MOCK_EMPLOYEES = [
    {"name": "John Doe", "email": "john.doe@company.com", "username": "john.doe"},
    {"name": "Jane Doe", "email": "j.doe@company.com", "username": "j.doe"},
    {"name": "Alex Chen", "email": "alex.chen@company.com", "username": "alex.chen"},
    {"name": "Alice Chen", "email": "a.chen@company.com", "username": "a.chen"},
    {"name": "Sarah Miller", "email": "sarah.miller@company.com", "username": "sarah.miller"},
    {"name": "Priya Sharma", "email": "priya.sharma@company.com", "username": "priya.sharma"},
    {"name": "David Kim", "email": "david.kim@company.com", "username": "david.kim"},
    {"name": "Emily Watson", "email": "emily.watson@company.com", "username": "emily.watson"},
]

def init_mock_directory(db: Session) -> None:
    """Pre-seeds the directory table so that realistic email collisions will trigger."""
    count = db.query(MockDirectoryUser).count()
    if count == 0:
        for emp in INITIAL_MOCK_EMPLOYEES:
            user = MockDirectoryUser(
                id=str(uuid.uuid4()),
                email=emp["email"].lower(),
                username=emp["username"].lower(),
                full_name=emp["name"],
                is_active=True
            )
            db.add(user)
        db.commit()

def check_email_available(db: Session, email: str) -> bool:
    """Checks whether the requested email is available in the mock corporate directory."""
    existing = db.query(MockDirectoryUser).filter(MockDirectoryUser.email == email.lower()).first()
    return existing is None

def check_username_available(db: Session, username: str) -> bool:
    """Checks whether the requested corporate username is available."""
    existing = db.query(MockDirectoryUser).filter(MockDirectoryUser.username == username.lower()).first()
    return existing is None

def create_account(db: Session, username: str, email: str, full_name: str) -> Dict[str, Any]:
    """
    [MOCK DIRECTORY SERVICE]
    Provisions a new corporate account in the directory service after manager approval.
    """
    if not check_email_available(db, email):
        raise ValueError(f"Email {email} is already in use!")

    user = MockDirectoryUser(
        id=str(uuid.uuid4()),
        email=email.lower(),
        username=username.lower(),
        full_name=full_name,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "status": "created",
        "mock": True,
        "user_id": user.id,
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "provisioned_systems": ["Google Workspace", "GitHub Organization", "Slack", "AWS SSO"]
    }
