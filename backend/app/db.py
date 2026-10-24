from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def ensure_db_schema():
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        try:
            res = conn.execute(text("PRAGMA table_info(assignments)"))
            cols = [r[1] for r in res.fetchall()]
            new_cols = [
                ("recommended_team", "TEXT"),
                ("recommended_score", "REAL"),
                ("chosen_team", "TEXT"),
                ("chosen_score", "REAL"),
                ("override_reason", "TEXT"),
                ("approved_at", "TEXT"),
                ("extra_data_json", "TEXT DEFAULT '{}'")
            ]
            for c_name, c_type in new_cols:
                if c_name not in cols:
                    conn.execute(text(f"ALTER TABLE assignments ADD COLUMN {c_name} {c_type}"))
            conn.commit()
        except Exception:
            pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
