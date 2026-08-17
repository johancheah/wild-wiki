from __future__ import annotations

import psycopg2
import psycopg2.extras

from .config import SCHEMA_PATH_PG, VIEWS_PATH_PG

# Postgres (Supabase) connection layer for the ingestion pipeline
# (ingest.py/xlsx_import.py/derive.py/set_profiles.py). The local FastAPI dev
# tool (webapp.py/queries.py) still uses SQLite directly via db_sqlite.py —
# deliberately not ported, since the deployed public site is the Next.js app
# reading Supabase directly (see PLAN.md's deploy section).
#
# PGConnection wraps a psycopg2 connection with a sqlite3.Connection-style
# `.execute()` so the many `conn.execute(sql, params).fetchall()` call sites
# written against SQLite keep working unchanged. Rows come back as
# psycopg2.extras.RealDictRow (dict-like) rather than sqlite3.Row, which
# supports both dict(row) and row["col"] but NOT positional tuple-unpacking
# (`a, b, c = row` iterates dict keys, not values) — every call site that
# relied on tuple-unpacking was updated to explicit key access accordingly.


class PGConnection:
    def __init__(self, dsn: str):
        self._conn = psycopg2.connect(dsn, cursor_factory=psycopg2.extras.RealDictCursor)

    def execute(self, sql: str, params=None):
        cur = self._conn.cursor()
        # sqlite3-style positional `?` placeholders -> psycopg2 `%s`. Named
        # `%(col)s` placeholders (used by upsert() below) pass through as-is.
        cur.execute(sql.replace("?", "%s"), params or ())
        return cur

    def executescript(self, sql: str) -> None:
        cur = self._conn.cursor()
        cur.execute(sql)
        self._conn.commit()

    def commit(self) -> None:
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()


def connect(database_url: str) -> PGConnection:
    return PGConnection(database_url)


def init_schema(conn: PGConnection) -> None:
    conn.executescript(SCHEMA_PATH_PG.read_text())
    conn.executescript(VIEWS_PATH_PG.read_text())


def upsert(conn: PGConnection, table: str, row: dict) -> None:
    columns = list(row.keys())
    placeholders = ", ".join(f"%({c})s" for c in columns)
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
