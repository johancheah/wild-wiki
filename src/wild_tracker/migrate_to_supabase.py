from __future__ import annotations

import argparse
import logging

from .config import load_config
from .db import connect as connect_pg
from .db import init_schema, upsert
from .db_sqlite import connect as connect_sqlite

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("wild_tracker.migrate")

# Dependency order (FK-referenced tables first) — matches db/schema.postgres.sql.
TABLES_IN_ORDER = [
    "teams",
    "players",
    "season_schedule",
    "matches",
    "match_players",
    "derived_player_match_stats",
    "match_player_weapon_kills",
    "rounds",
    "kill_events",
    "round_player_stats",
]

# Columns that need a type conversion going from SQLite -> Postgres.
BOOLEAN_COLUMNS = {"round_player_stats": {"was_afk"}}


def migrate_table(sqlite_conn, pg_conn, table: str) -> tuple[int, int]:
    rows = sqlite_conn.execute(f"SELECT * FROM {table}").fetchall()
    bool_cols = BOOLEAN_COLUMNS.get(table, set())
    for row in rows:
        row_dict = dict(row)
        for col in bool_cols:
            if col in row_dict and row_dict[col] is not None:
                row_dict[col] = bool(row_dict[col])
        upsert(pg_conn, table, row_dict)
    pg_conn.commit()

    pg_count = pg_conn.execute(f"SELECT COUNT(*) as n FROM {table}").fetchone()["n"]
    return len(rows), pg_count


def run_migration() -> None:
    cfg = load_config()
    sqlite_conn = connect_sqlite(cfg.db_path)
    pg_conn = connect_pg(cfg.database_url)
    init_schema(pg_conn)

    logger.info("Migrating %s -> Supabase Postgres", cfg.db_path)
    mismatches = []
    for table in TABLES_IN_ORDER:
        sqlite_n, pg_n = migrate_table(sqlite_conn, pg_conn, table)
        status = "OK" if sqlite_n == pg_n else "MISMATCH"
        if status == "MISMATCH":
            mismatches.append(table)
        logger.info("%-30s sqlite=%-6d postgres=%-6d %s", table, sqlite_n, pg_n, status)

    sqlite_conn.close()
    pg_conn.close()

    if mismatches:
        logger.error("Row count mismatch in: %s — investigate before trusting the migrated data", mismatches)
    else:
        logger.info("Migration complete — every table's row count matches exactly.")


def main() -> None:
    argparse.ArgumentParser(description="One-time migration of data/wild.sqlite3 into Supabase Postgres.").parse_args()
    run_migration()


if __name__ == "__main__":
    main()
