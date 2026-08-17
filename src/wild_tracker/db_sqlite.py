from __future__ import annotations

import sqlite3
from pathlib import Path

from .config import SCHEMA_PATH, VIEWS_PATH


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA_PATH.read_text())
    _migrate(conn)
    conn.executescript(VIEWS_PATH.read_text())
    conn.commit()


# Hobby-scale, no migrations framework: each entry is (table, column, DDL type),
# applied only if missing. Safe to run on every startup.
_COLUMN_MIGRATIONS = [
    ("players", "headshot_filename", "TEXT"),
    ("players", "nickname", "TEXT"),
    ("match_players", "acs", "REAL"),
    ("match_players", "kast_pct", "REAL"),
]


def _migrate(conn: sqlite3.Connection) -> None:
    for table, column, coltype in _COLUMN_MIGRATIONS:
        existing = {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
        if column not in existing:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}")


def upsert(conn: sqlite3.Connection, table: str, row: dict) -> None:
    columns = list(row.keys())
    placeholders = ", ".join(f":{c}" for c in columns)
    column_list = ", ".join(columns)
    update_clause = ", ".join(f"{c}=excluded.{c}" for c in columns)
    pk_cols = _PRIMARY_KEYS[table]
    sql = (
        f"INSERT INTO {table} ({column_list}) VALUES ({placeholders}) "
        f"ON CONFLICT({', '.join(pk_cols)}) DO UPDATE SET {update_clause}"
    )
    conn.execute(sql, row)


_PRIMARY_KEYS = {
    "teams": ["team_id"],
    "players": ["player_id"],
    "season_schedule": ["season_id"],
    "matches": ["match_id"],
    "match_players": ["match_id", "player_id"],
    "match_player_weapon_kills": ["match_id", "player_id", "weapon"],
    "rounds": ["match_id", "round_number"],
    "kill_events": ["match_id", "round_number", "event_index"],
    "round_player_stats": ["match_id", "round_number", "player_id"],
    "derived_player_match_stats": ["match_id", "player_id"],
}
