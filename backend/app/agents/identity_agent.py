import json
import re
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from backend.app.config import settings
from backend.app.tools.directory import check_email_available, check_username_available, create_account
from backend.app.schemas import IdentityProposal

class IdentityAgent:
    """
    Deterministic Identity Agent:
    - Reads ordered rules from naming_policy.json.
    - Tests candidate email against corporate directory (MockDirectoryUser).
    - Detects genuine collisions and progressively applies fallback rules.
    - Produces a proposed email & username awaiting manager approval.
    - On approval, provisions the account.
    """

    def __init__(self):
        policy_path = settings.SEED_DIR / "naming_policy.json"
        with open(policy_path, "r", encoding="utf-8") as f:
            self.policy = json.load(f)
        self.domain = self.policy.get("domain", "company.com")
        self.rules = self.policy.get("rules", [])

    def _normalize_name_parts(self, full_name: str) -> Tuple[str, str, str, str]:
        """Cleans and splits employee name into first, last, and initials."""
        # Clean special chars, lowercase
        cleaned = re.sub(r"[^a-zA-Z\s]", "", full_name).strip().lower()
        parts = cleaned.split()
        if not parts:
            return "user", "hire", "u", "h"
        if len(parts) == 1:
            first = parts[0]
            last = "team"
        else:
            first = parts[0]
            last = parts[-1]

        first_initial = first[0]
        last_initial = last[0]
        return first, last, first_initial, last_initial

    def propose_identity(self, db: Session, employee_id: str, full_name: str) -> IdentityProposal:
        """
        Runs through the naming policy rules sequentially until an available email and username are found.
        Logs collision attempts if any occur.
        """
        first, last, first_initial, last_initial = self._normalize_name_parts(full_name)
        attempts_log: List[str] = []
        collision_detected = False

        for rule in self.rules:
            rule_id = rule["id"]
            rule_name = rule["name"]
            template = rule["template"]

            username_candidate = template.format(
                first=first,
                last=last,
                first_initial=first_initial,
                last_initial=last_initial
            )
            email_candidate = f"{username_candidate}@{self.domain}".lower()

            email_ok = check_email_available(db, email_candidate)
            username_ok = check_username_available(db, username_candidate)

            if email_ok and username_ok:
                log_entry = f"Rule '{rule_name}' applied: '{email_candidate}' is available."
                attempts_log.append(log_entry)
                return IdentityProposal(
                    employee_id=employee_id,
                    proposed_email=email_candidate,
                    username=username_candidate,
                    rule_used=rule_name,
                    collision_detected=collision_detected,
                    attempts_log=attempts_log,
                    status="waiting_approval",
                    account_created=False
                )
            else:
                collision_detected = True
                collision_reason = []
                if not email_ok:
                    collision_reason.append(f"email '{email_candidate}' is already taken")
                if not username_ok:
                    collision_reason.append(f"username '{username_candidate}' is already taken")
                attempts_log.append(
                    f"Collision on rule '{rule_name}': {', '.join(collision_reason)}. Trying next rule..."
                )

        # Fallback if all standard rules collided: random 4-digit suffix
        import random
        rand_num = random.randint(100, 999)
        fallback_user = f"{first}.{last}{rand_num}"
        fallback_email = f"{fallback_user}@{self.domain}"
        attempts_log.append(f"All standard rules exhausted. Generated collision-free fallback '{fallback_email}'.")

        return IdentityProposal(
            employee_id=employee_id,
            proposed_email=fallback_email,
            username=fallback_user,
            rule_used="fallback_random_suffix",
            collision_detected=True,
            attempts_log=attempts_log,
            status="waiting_approval",
            account_created=False
        )

    def provision_account(self, db: Session, username: str, email: str, full_name: str) -> Dict[str, Any]:
        """Calls the directory service tool to create the account after manager approval."""
        return create_account(db, username, email, full_name)
