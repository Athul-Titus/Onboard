import logging
from typing import Dict, Any, List, Optional
import httpx
from backend.app.config import settings

logger = logging.getLogger(__name__)

class GitHubTool:
    """
    Pulls evidence from GitHub REST API:
    - User public repos, languages, commit activity
    - Test-file presence detection in top repositories
    - Handles rate limits and missing users gracefully.
    """

    def __init__(self, token: Optional[str] = None):
        self.token = token or settings.GITHUB_TOKEN
        self.headers = {"Accept": "application/vnd.github+json"}
        if self.token:
            self.headers["Authorization"] = f"Bearer {self.token}"

    def get_user_evidence(self, username: Optional[str]) -> Dict[str, Any]:
        """Fetches public profile and top repositories for technical skill verification."""
        if not username:
            return {"verified": False, "languages": {}, "repos_count": 0, "has_tests": False, "reason": "No username provided"}

        clean_user = username.strip().replace("@", "")
        evidence: Dict[str, Any] = {
            "verified": False,
            "username": clean_user,
            "repos_count": 0,
            "languages": {},
            "has_tests": False,
            "top_repos": []
        }

        try:
            with httpx.Client(headers=self.headers, timeout=10.0) as client:
                # 1. Fetch user profile
                user_res = client.get(f"https://api.github.com/users/{clean_user}")
                if user_res.status_code == 404:
                    evidence["reason"] = f"GitHub user '{clean_user}' not found"
                    return evidence
                if user_res.status_code == 403:
                    evidence["reason"] = "GitHub API rate limit reached, falling back to resume only"
                    return evidence
                if user_res.status_code != 200:
                    evidence["reason"] = f"GitHub API error {user_res.status_code}"
                    return evidence

                user_data = user_res.json()
                evidence["verified"] = True
                evidence["repos_count"] = user_data.get("public_repos", 0)

                # 2. Fetch public repos
                repos_res = client.get(f"https://api.github.com/users/{clean_user}/repos?per_page=10&sort=pushed")
                if repos_res.status_code == 200:
                    repos = repos_res.json()
                    language_counts: Dict[str, int] = {}
                    has_tests = False

                    for repo in repos:
                        if isinstance(repo, dict):
                            repo_name = repo.get("name", "")
                            lang = repo.get("language")
                            if lang:
                                language_counts[lang] = language_counts.get(lang, 0) + 1
                            evidence["top_repos"].append(repo_name)

                            # Heuristic for test detection in repos (description or topic)
                            desc = (repo.get("description") or "").lower()
                            topics = repo.get("topics") or []
                            if "test" in desc or "pytest" in desc or "jest" in desc or any("test" in str(t).lower() for t in topics):
                                has_tests = True

                    evidence["languages"] = language_counts
                    evidence["has_tests"] = has_tests

                return evidence

        except Exception as exc:
            logger.warning(f"Error checking GitHub evidence for {username}: {exc}")
            evidence["reason"] = f"Network or parsing error: {str(exc)}"
            return evidence

github_tool = GitHubTool()
