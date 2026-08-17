from __future__ import annotations

import argparse
import logging
import sys

from .config import load_config
from .db import PGConnection, connect, init_schema, upsert
from .henrik_client import HenrikDevClient, HenrikDevError
from .normalize import normalize_match

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("wild_tracker.ingest")


def collect_match_ids(history: dict) -> list[tuple[str, str]]:
    """Returns [(match_id, match_type), ...] from a premier team-history response."""
    data = history.get("data", history)
    out: list[tuple[str, str]] = []
    for m in data.get("league_matches", []) or []:
        if m.get("id"):
            out.append((m["id"], "Regular"))
    for tourney in data.get("tournament_matches", []) or []:
        for match_id in tourney.get("matches", []) or []:
            out.append((match_id, "Playoffs"))
    return out


def already_ingested(conn: PGConnection, match_id: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM matches WHERE match_id = ?", (match_id,)
    ).fetchone()
    return row is not None


def store_match(conn: PGConnection, normalized: dict) -> None:
    for team in normalized["teams"]:
        upsert(conn, "teams", team)
    for player in normalized["players"]:
        upsert(conn, "players", player)
    upsert(conn, "matches", normalized["match"])
    for row in normalized["match_players"]:
        upsert(conn, "match_players", row)
    for row in normalized["match_player_weapon_kills"]:
        upsert(conn, "match_player_weapon_kills", row)
    for row in normalized["rounds"]:
        upsert(conn, "rounds", row)
    for row in normalized["round_player_stats"]:
        upsert(conn, "round_player_stats", row)
    for row in normalized["kill_events"]:
        upsert(conn, "kill_events", row)
    conn.commit()


def run_backfill(season: str | None, limit: int | None) -> None:
    cfg = load_config()
    conn = connect(cfg.database_url)
    init_schema(conn)

    with HenrikDevClient(cfg.api_key) as client:
        logger.info("Resolving team %s#%s (affinity=%s)", cfg.team_name, cfg.team_tag, cfg.affinity)
        team_resp = client.get_premier_team_by_name(cfg.team_name, cfg.team_tag, cfg.affinity)
        team_data = team_resp.get("data", team_resp)
        wild_team_id = team_data.get("id")
        if not wild_team_id:
            logger.error("Could not resolve team id from response: %s", team_resp)
            sys.exit(1)
        logger.info("Resolved WILD premier team id=%s", wild_team_id)

        logger.info("Fetching match history (season=%s)", season or "current")
        history = client.get_premier_team_history_by_name(cfg.team_name, cfg.team_tag, season)
        match_ids = collect_match_ids(history)
        logger.info("Found %d match ids in history", len(match_ids))

        if limit:
            match_ids = match_ids[:limit]

        ingested, skipped, failed = 0, 0, 0
        for match_id, match_type in match_ids:
            if already_ingested(conn, match_id):
                skipped += 1
                continue
            try:
                raw = client.get_match_details_v4(cfg.affinity, match_id)
                normalized = normalize_match(raw, wild_team_id, match_type)
                store_match(conn, normalized)
                ingested += 1
                logger.info("Ingested match %s (%s)", match_id, match_type)
            except HenrikDevError as e:
                failed += 1
                logger.error("Failed to ingest match %s: %s", match_id, e)

        logger.info(
            "Backfill complete: %d ingested, %d already present, %d failed",
            ingested,
            skipped,
            failed,
        )

    conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill WILD Premier match history into SQLite.")
    parser.add_argument("--season", default=None, help="Premier season id (defaults to current)")
    parser.add_argument("--limit", type=int, default=None, help="Only ingest the first N matches (for testing)")
    args = parser.parse_args()
    run_backfill(args.season, args.limit)


if __name__ == "__main__":
    main()
