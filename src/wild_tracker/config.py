from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "wild.sqlite3"
SCHEMA_PATH = PROJECT_ROOT / "db" / "schema.sql"
VIEWS_PATH = PROJECT_ROOT / "db" / "views.sql"
SCHEMA_PATH_PG = PROJECT_ROOT / "db" / "schema.postgres.sql"
VIEWS_PATH_PG = PROJECT_ROOT / "db" / "views.postgres.sql"


def get_db_path() -> Path:
    """DB path only — for the webapp, which reads data and needs no API credentials."""
    return Path(os.environ.get("WILD_DB_PATH", str(DEFAULT_DB_PATH)))


@dataclass(frozen=True)
class Config:
    api_key: str
    team_name: str
    team_tag: str
    affinity: str  # region: na | eu | ap | kr
    db_path: Path
    database_url: str  # Postgres/Supabase connection string — used by the ingestion pipeline


def load_config() -> Config:
    missing = [
        var
        for var in ("HENRIKDEV_API_KEY", "WILD_TEAM_NAME", "WILD_TEAM_TAG", "WILD_AFFINITY", "DATABASE_URL")
        if not os.environ.get(var)
    ]
    if missing:
        raise RuntimeError(
            f"Missing required environment variable(s): {', '.join(missing)}. "
            "Copy .env.example to .env and fill them in."
        )

    return Config(
        api_key=os.environ["HENRIKDEV_API_KEY"],
        team_name=os.environ["WILD_TEAM_NAME"],
        team_tag=os.environ["WILD_TEAM_TAG"],
        affinity=os.environ["WILD_AFFINITY"],
        db_path=Path(os.environ.get("WILD_DB_PATH", str(DEFAULT_DB_PATH))),
        database_url=os.environ["DATABASE_URL"],
    )
