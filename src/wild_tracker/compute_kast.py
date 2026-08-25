from __future__ import annotations

import argparse
import json
import logging
from collections import defaultdict

from .config import get_db_path
from .db_sqlite import connect, init_schema

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("wild_tracker.compute_kast")

# Riot doesn't publish the exact trade window it uses; 5000ms is the widely-
# used community-tracker approximation (VLR.gg-style tools land in the same
# 3-5s range). Flagging as an assumption, same as ECON originally was.
TRADE_WINDOW_MS = 5000


def compute_kast_for_match(conn, match_id: str) -> dict[str, float]:
    """KAST% per player for one match, computed from stored kill_events +
    rounds (no API call — this data has been sitting in raw_payload/derived
    tables since Phase 1). K/A/S/T per round:
      K: player is killer_id of a kill_event that round
      A: player appears in a kill_event's assistant_ids that round
      S: player is not any kill_event's victim_id that round (didn't die)
      T: player died, but their killer was killed by a teammate of the
         victim within TRADE_WINDOW_MS afterward, same round
    KAST% = rounds meeting at least one of K/A/S/T, divided by total rounds.
    """
    player_team = {
        row["player_id"]: row["team_id"]
        for row in conn.execute(
            "SELECT player_id, team_id FROM match_players WHERE match_id = ?", (match_id,)
        ).fetchall()
    }
    round_numbers = [
        r["round_number"]
        for r in conn.execute(
            "SELECT round_number FROM rounds WHERE match_id = ? ORDER BY round_number", (match_id,)
        ).fetchall()
    ]
    if not round_numbers:
        return {}

    kast_rounds: dict[str, set[int]] = defaultdict(set)

    for rnd in round_numbers:
        kills = [
            dict(k)
            for k in conn.execute(
                "SELECT killer_id, victim_id, assistant_ids, time_in_round_ms FROM kill_events "
                "WHERE match_id = ? AND round_number = ? ORDER BY time_in_round_ms ASC",
                (match_id, rnd),
            ).fetchall()
        ]
        for k in kills:
            k["assistant_ids"] = json.loads(k["assistant_ids"]) if k["assistant_ids"] else []

        died_this_round: set[str] = set()
        for k in kills:
            if k["killer_id"]:
                kast_rounds[k["killer_id"]].add(rnd)
            for a in k["assistant_ids"]:
                kast_rounds[a].add(rnd)
            if k["victim_id"]:
                died_this_round.add(k["victim_id"])

        # Trade: victim's killer dies to one of the victim's teammates within
        # the window, same round.
        for k in kills:
            victim, killer, t0 = k["victim_id"], k["killer_id"], k["time_in_round_ms"]
            if not victim or not killer or t0 is None:
                continue
            victim_team = player_team.get(victim)
            for k2 in kills:
                if k2["victim_id"] != killer or k2["time_in_round_ms"] is None:
                    continue
                dt = k2["time_in_round_ms"] - t0
                if 0 <= dt <= TRADE_WINDOW_MS and player_team.get(k2["killer_id"]) == victim_team:
                    kast_rounds[victim].add(rnd)
                    break

        for pid in player_team:
            if pid not in died_this_round:
                kast_rounds[pid].add(rnd)

    total = len(round_numbers)
    return {pid: round(100.0 * len(kast_rounds.get(pid, set())) / total, 1) for pid in player_team}


def run() -> None:
    conn = connect(get_db_path())
    init_schema(conn)

    match_ids = [r["match_id"] for r in conn.execute("SELECT match_id FROM matches WHERE source = 'api'").fetchall()]
    logger.info("Computing KAST for %d API-sourced matches", len(match_ids))

    updated = 0
    for match_id in match_ids:
        kast = compute_kast_for_match(conn, match_id)
        for player_id, pct in kast.items():
            conn.execute(
                "UPDATE match_players SET kast_pct = ? WHERE match_id = ? AND player_id = ?",
                (pct, match_id, player_id),
            )
            updated += 1

    conn.commit()
    conn.close()
    logger.info("Updated kast_pct for %d player-match rows", updated)


def main() -> None:
    argparse.ArgumentParser(description="Compute real KAST% from kill_events/rounds for API-sourced matches.").parse_args()
    run()


if __name__ == "__main__":
    main()
