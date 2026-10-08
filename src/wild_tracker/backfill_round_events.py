from __future__ import annotations

import argparse
import json
import logging

from .config import get_db_path, load_config
from .normalize import extract_round_events

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("wild_tracker.backfill_round_events")


def _run(conn, upsert) -> None:
    """Rebuilds round_events (the 2D Replay tab's position snapshots) from
    each API match's stored raw_payload — for matches ingested before this
    table existed. New ingests populate it directly via normalize.py. Safe
    to rerun (upserts)."""
    rows = conn.execute("SELECT match_id, raw_payload FROM matches WHERE source = 'api' AND raw_payload IS NOT NULL").fetchall()
    total = 0
    for r in rows:
        payload = r["raw_payload"]
        if isinstance(payload, str):  # SQLite TEXT; Postgres JSONB arrives already parsed
            payload = json.loads(payload)
        data = payload.get("data", payload)
        events = extract_round_events(r["match_id"], data)
        for e in events:
            upsert(conn, "round_events", e)
        total += len(events)
        conn.commit()
    logger.info("Backfilled %d round events across %d matches", total, len(rows))


def run() -> None:
    from .db_sqlite import connect, init_schema, upsert

    conn = connect(get_db_path())
    init_schema(conn)
    _run(conn, upsert)
    conn.close()


def run_postgres() -> None:
    from .db import connect, init_schema, upsert

    conn = connect(load_config().database_url)
    init_schema(conn)
    _run(conn, upsert)
    conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill round_events from stored raw payloads.")
    parser.add_argument("--postgres", action="store_true", help="Target the production Postgres DB instead of local SQLite")
    args = parser.parse_args()
    run_postgres() if args.postgres else run()


if __name__ == "__main__":
    main()
