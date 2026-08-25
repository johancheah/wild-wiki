from __future__ import annotations

import argparse
import logging

from .compute_kast import compute_kast_for_match
from .config import get_db_path, load_config
from .db_sqlite import connect, init_schema, upsert
from .derive import compute_clutches, compute_econ, compute_fk_fd, compute_multi_kills, compute_plants_defuses
from .henrik_client import HenrikDevClient, HenrikDevError
from .ingest import already_ingested, collect_match_ids
from .normalize import normalize_match

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("wild_tracker.sync_local")

# ingest.py/derive.py/compute_kast.py all talk to `conn` only through
# duck-typed .execute()/.commit() calls, so their pure logic works unchanged
# against a sqlite3.Connection here — this just points the same pipeline at
# the local DB (data/wild.sqlite3) instead of Supabase, since that's what the
# local FastAPI app actually reads. The Postgres-targeted ingest.py/derive.py
# stay as-is for when the deploy is live; this is the local-dev equivalent.


def _store_match(conn, normalized: dict) -> None:
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


def _derive_match(conn, match_id: str) -> None:
    """Local-DB equivalent of derive.derive_match — reuses its pure compute_*
    helpers (they only call conn.execute, no upsert) but writes through
    db_sqlite.upsert instead of derive.py's Postgres-flavored one."""
    multi_kills = compute_multi_kills(conn, match_id)
    fk_fd = compute_fk_fd(conn, match_id)
    plants_defuses = compute_plants_defuses(conn, match_id)
    clutches = compute_clutches(conn, match_id)
    econ = compute_econ(conn, match_id)

    player_ids = {
        r["player_id"]
        for r in conn.execute("SELECT player_id FROM match_players WHERE match_id = ?", (match_id,)).fetchall()
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


def run_sync(season: str | None, limit: int | None) -> None:
    cfg = load_config()
    conn = connect(get_db_path())
    init_schema(conn)

    new_match_ids: list[str] = []

    with HenrikDevClient(cfg.api_key) as client:
        logger.info("Resolving team %s#%s (affinity=%s)", cfg.team_name, cfg.team_tag, cfg.affinity)
        team_resp = client.get_premier_team_by_name(cfg.team_name, cfg.team_tag, cfg.affinity)
        wild_team_id = team_resp.get("data", team_resp).get("id")
        if not wild_team_id:
            logger.error("Could not resolve team id from response: %s", team_resp)
            conn.close()
            return

        logger.info("Fetching match history (season=%s)", season or "current")
        history = client.get_premier_team_history_by_name(cfg.team_name, cfg.team_tag, season)
        match_ids = collect_match_ids(history)
        if limit:
            match_ids = match_ids[:limit]
        logger.info("Found %d match ids in history", len(match_ids))

        ingested, skipped, failed = 0, 0, 0
        for match_id, match_type in match_ids:
            if already_ingested(conn, match_id):
                skipped += 1
                continue
            try:
                raw = client.get_match_details_v4(cfg.affinity, match_id)
                normalized = normalize_match(raw, wild_team_id, match_type)
                _store_match(conn, normalized)
                new_match_ids.append(match_id)
                ingested += 1
                logger.info("Ingested match %s (%s, map=%s)", match_id, match_type, normalized["match"].get("map"))
            except HenrikDevError as e:
                failed += 1
                logger.error("Failed to ingest match %s: %s", match_id, e)

        logger.info("Ingest complete: %d new, %d already present, %d failed", ingested, skipped, failed)

    for match_id in new_match_ids:
        _derive_match(conn, match_id)
        kast = compute_kast_for_match(conn, match_id)
        for player_id, pct in kast.items():
            conn.execute(
                "UPDATE match_players SET kast_pct = ? WHERE match_id = ? AND player_id = ?",
                (pct, match_id, player_id),
            )
    conn.commit()
    logger.info("Derived stats + KAST computed for %d new match(es)", len(new_match_ids))
    conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch new WILD Premier matches into the local SQLite DB and compute derived stats.")
    parser.add_argument("--season", default=None, help="Premier season id (defaults to current)")
    parser.add_argument("--limit", type=int, default=None, help="Only consider the first N matches from history (for testing)")
    args = parser.parse_args()
    run_sync(args.season, args.limit)


if __name__ == "__main__":
    main()
