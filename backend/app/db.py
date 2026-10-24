from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def init_db_schema():
    Base.metadata.create_all(bind=engine)
    if "sqlite" in str(settings.DATABASE_URL):
        try:
            from sqlalchemy import text
            with engine.connect() as conn:
                res = conn.execute(text("PRAGMA table_info(audit_logs)")).fetchall()
                existing_cols = {r[1] for r in res}
                if existing_cols:
                    col_defs = [
                        ("entry_type", "VARCHAR DEFAULT 'agent_step'"),
                        ("actor", "VARCHAR DEFAULT 'System'"),
                        ("duration_ms", "FLOAT DEFAULT 0.0"),
                        ("previous_hash", "VARCHAR(64)"),
                        ("entry_hash", "VARCHAR(64)"),
                    ]
                    for col_name, col_type in col_defs:
                        if col_name not in existing_cols:
                            conn.execute(text(f"ALTER TABLE audit_logs ADD COLUMN {col_name} {col_type}"))
                    
                    emp_res = conn.execute(text("PRAGMA table_info(employees)")).fetchall()
                    existing_emp_cols = {r[1] for r in emp_res}
                    if existing_emp_cols and "redaction_summary_json" not in existing_emp_cols:
                        conn.execute(text("ALTER TABLE employees ADD COLUMN redaction_summary_json TEXT"))
                    conn.commit()
        except Exception:
            pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
