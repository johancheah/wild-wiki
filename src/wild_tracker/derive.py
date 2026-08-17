from __future__ import annotations

import argparse
import logging
from collections import defaultdict

from .config import load_config
from .db import PGConnection, connect, upsert

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("wild_tracker.derive")


def api_match_ids(conn: PGConnection) -> list[str]:
    rows = conn.execute("SELECT match_id FROM matches WHERE source = 'api'").fetchall()
    return [r["match_id"] for r in rows]


def compute_multi_kills(conn: PGConnection, match_id: str) -> dict[str, dict[str, int]]:
    """Per player: count of rounds with exactly 2/3/4/5+ kills (standard scoreboard buckets)."""
    rows = conn.execute(
        "SELECT round_number, killer_id, COUNT(*) as n FROM kill_events "
        "WHERE match_id = ? AND killer_id IS NOT NULL GROUP BY round_number, killer_id",
        (match_id,),
    ).fetchall()
    stats: dict[str, dict[str, int]] = defaultdict(lambda: {"two_k": 0, "three_k": 0, "four_k": 0, "five_k": 0})
    for row in rows:
        killer_id, n = row["killer_id"], row["n"]
        if n == 2:
            stats[killer_id]["two_k"] += 1
        elif n == 3:
            stats[killer_id]["three_k"] += 1
        elif n == 4:
            stats[killer_id]["four_k"] += 1
        elif n >= 5:
            stats[killer_id]["five_k"] += 1
    return stats


def compute_fk_fd(conn: PGConnection, match_id: str) -> dict[str, dict[str, int]]:
    """Per player: first-kill and first-death counts (first kill_event per round, by time)."""
    rows = conn.execute(
        "SELECT round_number, killer_id, victim_id, time_in_round_ms FROM kill_events "
        "WHERE match_id = ? ORDER BY round_number, time_in_round_ms ASC",
        (match_id,),
    ).fetchall()
    seen_rounds: set[int] = set()
    stats: dict[str, dict[str, int]] = defaultdict(lambda: {"fk": 0, "fd": 0})
    for row in rows:
        round_number, killer_id, victim_id = row["round_number"], row["killer_id"], row["victim_id"]
        if round_number in seen_rounds:
            continue
        seen_rounds.add(round_number)
        if killer_id:
            stats[killer_id]["fk"] += 1
        if victim_id:
            stats[victim_id]["fd"] += 1
    return stats


def compute_plants_defuses(conn: PGConnection, match_id: str) -> dict[str, dict[str, int]]:
    stats: dict[str, dict[str, int]] = defaultdict(lambda: {"plants": 0, "defuses": 0})
    for row in conn.execute(
        "SELECT plant_player_id FROM rounds WHERE match_id = ? AND plant_player_id IS NOT NULL", (match_id,)
    ).fetchall():
        stats[row["plant_player_id"]]["plants"] += 1
    for row in conn.execute(
        "SELECT defuse_player_id FROM rounds WHERE match_id = ? AND defuse_player_id IS NOT NULL", (match_id,)
    ).fetchall():
        stats[row["defuse_player_id"]]["defuses"] += 1
    return stats


def compute_clutches(conn: PGConnection, match_id: str) -> dict[str, dict[str, int]]:
    """Standard clutch definition (PLAN.md §0): sole surviving teammate, 1+ enemies
    still alive at that moment, and their team goes on to win the round. The
    difficulty label (1v1..1v5) is fixed at the moment the player becomes the
    lone survivor, per standard convention — later kills don't change it.
    """
    match_row = conn.execute(
        "SELECT team_id FROM matches WHERE match_id = ?", (match_id,)
    ).fetchone()
    wild_team_id = match_row["team_id"]

    player_team = {
        row["player_id"]: row["team_id"]
        for row in conn.execute(
            "SELECT player_id, team_id FROM match_players WHERE match_id = ?", (match_id,)
        ).fetchall()
    }
    wild_players = {pid for pid, tid in player_team.items() if tid == wild_team_id}
    enemy_players = {pid for pid, tid in player_team.items() if tid != wild_team_id}

    rounds = conn.execute(
        "SELECT round_number, winning_team_id FROM rounds WHERE match_id = ?", (match_id,)
    ).fetchall()

    stats: dict[str, dict[str, int]] = defaultdict(
        lambda: {"clutch_1v1": 0, "clutch_1v2": 0, "clutch_1v3": 0, "clutch_1v4": 0, "clutch_1v5": 0}
    )

    for round_row in rounds:
        round_number, winning_team_id = round_row["round_number"], round_row["winning_team_id"]
        kills = conn.execute(
            "SELECT killer_id, victim_id FROM kill_events "
            "WHERE match_id = ? AND round_number = ? ORDER BY time_in_round_ms ASC",
            (match_id, round_number),
        ).fetchall()

        wild_alive = set(wild_players)
        enemy_alive = set(enemy_players)
        clutch_survivor, clutch_enemies_at_trigger = None, None

        for kill_row in kills:
            victim_id = kill_row["victim_id"]
            if victim_id in wild_alive:
                wild_alive.discard(victim_id)
            elif victim_id in enemy_alive:
                enemy_alive.discard(victim_id)

            if clutch_survivor is None and len(wild_alive) == 1 and len(enemy_alive) >= 1:
                clutch_survivor = next(iter(wild_alive))
                clutch_enemies_at_trigger = len(enemy_alive)

        if clutch_survivor is not None and winning_team_id == wild_team_id:
            n = min(clutch_enemies_at_trigger, 5)
            stats[clutch_survivor][f"clutch_1v{n}"] += 1

    return stats


def compute_econ(conn: PGConnection, match_id: str) -> dict[str, float]:
    """Riot's own formula, per the user: (Total Damage Dealt / Total Credits Spent) x 1000."""
    rows = conn.execute(
        "SELECT player_id, damage_dealt, economy_spent_overall FROM match_players WHERE match_id = ?",
        (match_id,),
    ).fetchall()
    econ = {}
    for row in rows:
        player_id, damage_dealt, spent = row["player_id"], row["damage_dealt"], row["economy_spent_overall"]
        if damage_dealt is not None and spent:
            econ[player_id] = (damage_dealt / spent) * 1000
    return econ


def derive_match(conn: PGConnection, match_id: str) -> None:
    multi_kills = compute_multi_kills(conn, match_id)
    fk_fd = compute_fk_fd(conn, match_id)
    plants_defuses = compute_plants_defuses(conn, match_id)
    clutches = compute_clutches(conn, match_id)
    econ = compute_econ(conn, match_id)

    player_ids = {
        r["player_id"]
        for r in conn.execute(
            "SELECT player_id FROM match_players WHERE match_id = ?", (match_id,)
        ).fetchall()
    }

    for player_id in player_ids:
        mk = multi_kills.get(player_id, {"two_k": 0, "three_k": 0, "four_k": 0, "five_k": 0})
        cl = clutches.get(player_id, {"clutch_1v1": 0, "clutch_1v2": 0, "clutch_1v3": 0, "clutch_1v4": 0, "clutch_1v5": 0})
        pd = plants_defuses.get(player_id, {"plants": 0, "defuses": 0})

        upsert(conn, "derived_player_match_stats", {
            "match_id": match_id,
            "player_id": player_id,
            "source": "computed",
            "two_k": mk["two_k"], "three_k": mk["three_k"], "four_k": mk["four_k"], "five_k": mk["five_k"],
            "clutch_1v1": cl["clutch_1v1"], "clutch_1v2": cl["clutch_1v2"], "clutch_1v3": cl["clutch_1v3"],
            "clutch_1v4": cl["clutch_1v4"], "clutch_1v5": cl["clutch_1v5"],
            "plants": pd["plants"], "defuses": pd["defuses"],
            "econ": econ.get(player_id),
        })

        fkfd = fk_fd.get(player_id, {"fk": 0, "fd": 0})
        conn.execute(
            "UPDATE match_players SET fk = ?, fd = ? WHERE match_id = ? AND player_id = ?",
            (fkfd["fk"], fkfd["fd"], match_id, player_id),
        )


def run_derive() -> None:
    cfg = load_config()
    conn = connect(cfg.database_url)
    match_ids = api_match_ids(conn)
    logger.info("Computing derived stats for %d API-sourced matches", len(match_ids))
    for match_id in match_ids:
        derive_match(conn, match_id)
    conn.commit()
    logger.info("Done.")
    conn.close()


def main() -> None:
    argparse.ArgumentParser(description="Compute derived stats (multi-kills, clutches, FK/FD, plants/defuses, ECON) for API-sourced matches.").parse_args()
    run_derive()


if __name__ == "__main__":
    main()
