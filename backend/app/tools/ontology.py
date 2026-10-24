import json
from typing import Dict, Any, List, Optional, Tuple
from backend.app.config import settings

class SkillOntology:
    """
    Normalizes candidate extracted skills to canonical ontology names using:
    1. Exact alias dictionary lookup (O(1))
    2. Case-insensitive substring matching
    3. Normalization fallback
    Provides categories and alias mappings.
    """

    def __init__(self):
        ontology_path = settings.SEED_DIR / "skills_ontology.json"
        with open(ontology_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.skills_list = data.get("skills", [])

        # Build alias lookup map: lowercase_alias -> canonical_name
        self.alias_map: Dict[str, str] = {}
        self.canonical_skills: set = set()
        self.skill_categories: Dict[str, str] = {}
        self.canonical_to_aliases: Dict[str, List[str]] = {}

        for item in self.skills_list:
            canonical = item["name"]
            cat = item.get("category", "General Engineering")
            aliases = item.get("aliases", [])

            self.canonical_skills.add(canonical)
            self.skill_categories[canonical.lower()] = cat
            self.canonical_to_aliases[canonical.lower()] = [canonical] + aliases

            self.alias_map[canonical.lower()] = canonical
            for alias in aliases:
                self.alias_map[alias.lower()] = canonical

    def normalize(self, raw_skill: str) -> Tuple[str, bool]:
        """
        Returns (canonical_name, was_matched).
        If matched, returns the canonical ontology string.
        Otherwise returns cleaned raw_skill.
        """
        clean = raw_skill.strip()
        lowered = clean.lower()

        # 1. Direct alias match
        if lowered in self.alias_map:
            return self.alias_map[lowered], True

        # 2. Substring/prefix match
        for alias, canonical in self.alias_map.items():
            if alias in lowered or lowered in alias:
                return canonical, True

        return clean, False

    def get_category(self, canonical_name: str) -> str:
        """
        Returns one of the 7 canonical categories:
        language, framework, data/ml, devops, database, tool, soft skill.
        """
        lowered = canonical_name.lower()

        # Specific skill category overrides
        special_map = {
            "git": "tool",
            "unit testing": "tool",
            "ui/ux design": "tool",
            "system design": "soft skill",
            "agile / scrum": "soft skill",
            "security": "devops"
        }
        if lowered in special_map:
            return special_map[lowered]

        raw_cat = self.skill_categories.get(lowered, "tool").lower()
        if "database" in raw_cat:
            return "database"
        elif "language" in raw_cat:
            return "language"
        elif "framework" in raw_cat or "mobile" in raw_cat:
            return "framework"
        elif "data" in raw_cat or "ai" in raw_cat or "ml" in raw_cat:
            return "data/ml"
        elif "devops" in raw_cat or "cloud" in raw_cat:
            return "devops"
        elif "soft" in raw_cat or "architecture" in raw_cat:
            return "soft skill"
        else:
            return "tool"

    def get_aliases(self, canonical_name: str) -> List[str]:
        """Returns all recognized aliases for a canonical skill."""
        return self.canonical_to_aliases.get(canonical_name.lower(), [canonical_name])

    def get_all_canonical(self) -> List[str]:
        return sorted(list(self.canonical_skills))

ontology = SkillOntology()
