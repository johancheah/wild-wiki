from __future__ import annotations

import argparse
import logging

from .agent_roles import agent_role
from .config import get_db_path
from .db_sqlite import connect, init_schema

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("wild_tracker.backfill_agent_role")


def run() -> None:
    conn = connect(get_db_path())
    init_schema(conn)

    rows = conn.execute(
        "SELECT match_id, player_id, agent FROM match_players WHERE role IS NULL AND agent IS NOT NULL"
    ).fetchall()

    updated = 0
    for match_id, player_id, agent in rows:
        role = agent_role(agent)
        if role:
            conn.execute(
                "UPDATE match_players SET role = ? WHERE match_id = ? AND player_id = ?",
                (role, match_id, player_id),
            )
            updated += 1

    conn.commit()
    conn.close()
    logger.info("Backfilled role for %d/%d player-match rows", updated, len(rows))


def main() -> None:
    argparse.ArgumentParser(description="Backfill match_players.role from agent name for API-sourced rows.").parse_args()
    run()


if __name__ == "__main__":
    main()
