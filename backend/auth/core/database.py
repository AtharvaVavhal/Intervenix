import sqlalchemy
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from typing import Generator
from .config import get_settings

settings = get_settings()

_url = settings.database_url  # normalised: sqlite://... or postgresql+psycopg2://...

connect_args = {"check_same_thread": False} if _url.startswith("sqlite") else {}

engine = create_engine(
    _url,
    connect_args=connect_args,
    pool_pre_ping=True,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency — yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables() -> None:
    """Create all tables on first run. Does not modify existing tables."""
    Base.metadata.create_all(bind=engine)


def run_migrations() -> None:
    """
    Idempotent schema upgrades — safe to run on every startup.

    Each statement is attempted independently; errors mean the column/change
    already exists, which is fine.  PostgreSQL-only statements are skipped
    silently on SQLite.
    """
    is_pg = not _url.startswith("sqlite")

    additive: list[str] = [
        # leads — scoring columns (v2)
        "ALTER TABLE leads ADD COLUMN lead_score INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE leads ADD COLUMN priority VARCHAR(16) NOT NULL DEFAULT 'low'",
        # users — admin flag (v3)
        "ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE",
        # leads — CRM workflow columns (v4)
        "ALTER TABLE leads ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'new'",
        "ALTER TABLE leads ADD COLUMN assigned_to_id INTEGER",
    ]

    pg_only: list[str] = [
        # leads — volume type fix: String → Integer (v3, PostgreSQL only)
        "ALTER TABLE leads ALTER COLUMN volume TYPE INTEGER USING volume::INTEGER",
    ]

    with engine.connect() as conn:
        for sql in additive:
            _try_exec(conn, sql)

        if is_pg:
            for sql in pg_only:
                _try_exec(conn, sql)


def _try_exec(conn, sql: str) -> None:
    try:
        conn.execute(text(sql))
        conn.commit()
    except Exception:
        conn.rollback()
