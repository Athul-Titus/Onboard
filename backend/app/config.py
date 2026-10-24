from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

BASE_DIR = Path(__file__).resolve().parent.parent.parent  # repo root

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_NAME: str = "OnboardOS"
    APP_ENV: str = "development"
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    DEBUG: bool = True

    # LLM
    LLM_PROVIDER: str = "openai"  # openai, gemini, anthropic, mock
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-3-5-haiku-20241022"
    MOCK_LLM_MODE: bool = True

    # Storage
    DATABASE_URL: str = "sqlite:///./onboardos.db"
    CHROMA_PERSIST_DIR: str = str(BASE_DIR / "chroma_db")

    # GitHub
    GITHUB_TOKEN: str = ""

    # Orchestrator & Scoring Weights (positive weights sum to 1.0, learning gap penalty 0.15)
    SCORE_WEIGHT_SKILL_MATCH: float = 0.45
    SCORE_WEIGHT_GAP_COVERAGE: float = 0.30
    SCORE_WEIGHT_CAPACITY: float = 0.25
    SCORE_WEIGHT_LEARNING_GAP: float = 0.15

    # Skill Status Weights
    SKILL_WEIGHT_VERIFIED: float = 1.0
    SKILL_WEIGHT_CLAIMED: float = 0.7
    SKILL_WEIGHT_UNCLEAR: float = 0.3

    # Quality and Margin Thresholds
    SCORE_WEAK_FIT_THRESHOLD: float = 0.35
    SCORE_CLOSE_CALL_MARGIN: float = 0.05

    LLM_TIMEOUT_SECONDS: int = 30
    LLM_MAX_RETRIES: int = 1

    # Seed Directories
    DATA_DIR: Path = Path(__file__).resolve().parent / "data"
    SEED_DIR: Path = Path(__file__).resolve().parent / "data" / "seed"
    DOCS_DIR: Path = Path(__file__).resolve().parent / "data" / "docs"

settings = Settings()
