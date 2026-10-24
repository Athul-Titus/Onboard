import json
from typing import Dict, Any, List, Optional, Tuple
from backend.app.config import settings

class SkillOntology:
    """
    Normalizes candidate extracted skills to canonical ontology names using:
    1. Exact alias dictionary lookup (O(1))
    2. Case-insensitive substring matching
    3. Normalization fallback
    """

    def __init__(self):
        ontology_path = settings.SEED_DIR / "skills_ontology.json"
        with open(ontology_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.skills_list = data.get("skills", [])

        # Build alias lookup map: lowercase_alias -> canonical_name
        self.alias_map: Dict[str, str] = {}
        self.canonical_skills: set = set()

        for item in self.skills_list:
            canonical = item["name"]
            self.canonical_skills.add(canonical)
            self.alias_map[canonical.lower()] = canonical
            for alias in item.get("aliases", []):
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

    def get_all_canonical(self) -> List[str]:
        return sorted(list(self.canonical_skills))

ontology = SkillOntology()
