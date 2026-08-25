from __future__ import annotations

import argparse
import json
import logging

from .config import get_db_path
from .db_sqlite import connect, init_schema

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("wild_tracker.backfill_round_result")


def run() -> None:
    conn = connect(get_db_path())
    init_schema(conn)

    matches = conn.execute(
        "SELECT match_id, raw_payload FROM matches WHERE source = 'api' AND raw_payload IS NOT NULL"
    ).fetchall()

    updated = 0
    for match_id, raw_payload in matches:
        data = json.loads(raw_payload)
        rounds = data.get("data", data).get("rounds", [])
        for r in rounds:
            conn.execute(
                "UPDATE rounds SET result = ? WHERE match_id = ? AND round_number = ?",
                (r.get("result"), match_id, r.get("id")),
            )
            updated += 1

    conn.commit()
    conn.close()
    logger.info("Backfilled result for %d rounds across %d matches", updated, len(matches))


def main() -> None:
    argparse.ArgumentParser(
        description="Backfill rounds.result from already-stored raw_payload (no API calls)."
    ).parse_args()
    run()


if __name__ == "__main__":
    main()
