from __future__ import annotations

import re
import sqlite3
from collections import defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo

from .round_side import compute_match_timeline

TEAM_TZ = ZoneInfo("America/New_York")

_FRACTIONAL_SECONDS_RE = re.compile(r"\.(\d+)")


def _local_date(date_str: str) -> str:
    """Eastern-local calendar date, for grouping matches into match weeks.

    API rows store a full UTC ISO timestamp (evening matches roll to the next
    UTC day); spreadsheet rows already store a bare Eastern-local date. Same
    conversion used during Phase 1.5 reconciliation (xlsx_import.py) — kept
    consistent here so a match week's two maps always group together
    regardless of which source either one came from.
    """
    if len(date_str) == 10:  # bare "YYYY-MM-DD", already local
        return date_str
    normalized = date_str.replace("Z", "+00:00")
    # Python's fromisoformat (pre-3.11) only accepts 3- or 6-digit fractional
    # seconds — the API has been observed emitting other lengths (e.g. 1
    # digit). Pad/truncate to exactly 6 (microseconds) so any length parses.
    normalized = _FRACTIONAL_SECONDS_RE.sub(lambda m: "." + m.group(1).ljust(6, "0")[:6], normalized)
    utc_dt = datetime.fromisoformat(normalized)
    return utc_dt.astimezone(TEAM_TZ).date().isoformat()


def team_record(conn: sqlite3.Connection) -> dict:
    overall = dict(conn.execute(
        "SELECT "
        "  SUM(CASE WHEN result='WIN' THEN 1 ELSE 0 END) AS wins, "
        "  SUM(CASE WHEN result='LOSS' THEN 1 ELSE 0 END) AS losses, "
        "  SUM(CASE WHEN result='DRAW' THEN 1 ELSE 0 END) AS draws, "
        "  COUNT(*) AS total "
        "FROM matches"
    ).fetchone())
    overall["win_pct"] = round(100.0 * overall["wins"] / overall["total"], 1) if overall["total"] else 0.0

    by_map = [dict(r) for r in conn.execute(
        "SELECT map, COUNT(*) AS n, "
        "  SUM(CASE WHEN result='WIN' THEN 1 ELSE 0 END) AS wins "
        "FROM matches GROUP BY map ORDER BY n DESC"
    ).fetchall()]

    by_season = [dict(r) for r in conn.execute(
        "SELECT season_id, COUNT(*) AS n, "
        "  SUM(CASE WHEN result='WIN' THEN 1 ELSE 0 END) AS wins, "
        "  MIN(date) AS first_date "
        "FROM matches GROUP BY season_id ORDER BY first_date"
    ).fetchall()]

    by_type = [dict(r) for r in conn.execute(
        "SELECT match_type, COUNT(*) AS n, "
        "  SUM(CASE WHEN result='WIN' THEN 1 ELSE 0 END) AS wins "
        "FROM matches WHERE match_type IS NOT NULL GROUP BY match_type"
    ).fetchall()]

    return {"overall": overall, "by_map": by_map, "by_season": by_season, "by_type": by_type}


def player_career_list(conn: sqlite3.Connection) -> list[dict]:
    return [dict(r) for r in conn.execute("""
        SELECT
          p.player_id, p.riot_name, p.riot_tag, p.headshot_filename,
          COALESCE(p.nickname, p.riot_name) AS display_name,
          COUNT(*) AS matches_played,
          SUM(v.kills) AS kills, SUM(v.deaths) AS deaths, SUM(v.assists) AS assists,
          ROUND(SUM(v.kills) * 1.0 / NULLIF(SUM(v.deaths), 0), 2) AS kd,
          ROUND(SUM(v.adr * v.rounds_played) * 1.0 / NULLIF(SUM(v.rounds_played), 0), 1) AS adr,
          ROUND(SUM(v.hs_pct * v.rounds_played) * 1.0 / NULLIF(SUM(v.rounds_played), 0), 1) AS hs_pct,
          SUM(v.two_k) AS two_k, SUM(v.three_k) AS three_k, SUM(v.four_k) AS four_k, SUM(v.five_k) AS five_k,
          SUM(v.clutch_1v1 + v.clutch_1v2 + v.clutch_1v3 + v.clutch_1v4 + v.clutch_1v5) AS clutches,
          SUM(v.plants) AS plants, SUM(v.defuses) AS defuses,
          ROUND(AVG(v.econ), 1) AS econ
        FROM v_wild_player_match_stats v
        JOIN players p ON p.player_id = v.player_id
        GROUP BY p.player_id
        ORDER BY kills DESC
    """).fetchall()]


def player_detail(conn: sqlite3.Connection, player_id: str) -> dict | None:
    player_row = conn.execute(
        "SELECT *, COALESCE(nickname, riot_name) AS display_name FROM players WHERE player_id = ?",
        (player_id,),
    ).fetchone()
    if not player_row:
        return None
    player = dict(player_row)

    totals = dict(conn.execute("""
        SELECT
          COUNT(*) AS matches_played,
          SUM(kills) AS kills, SUM(deaths) AS deaths, SUM(assists) AS assists,
          ROUND(SUM(kills) * 1.0 / NULLIF(SUM(deaths), 0), 2) AS kd,
          ROUND(SUM(adr * rounds_played) * 1.0 / NULLIF(SUM(rounds_played), 0), 1) AS adr,
          ROUND(SUM(hs_pct * rounds_played) * 1.0 / NULLIF(SUM(rounds_played), 0), 1) AS hs_pct,
          SUM(two_k) AS two_k, SUM(three_k) AS three_k, SUM(four_k) AS four_k, SUM(five_k) AS five_k,
          SUM(clutch_1v1) AS clutch_1v1, SUM(clutch_1v2) AS clutch_1v2, SUM(clutch_1v3) AS clutch_1v3,
          SUM(clutch_1v4) AS clutch_1v4, SUM(clutch_1v5) AS clutch_1v5,
          SUM(plants) AS plants, SUM(defuses) AS defuses,
          ROUND(AVG(econ), 1) AS econ
        FROM v_wild_player_match_stats WHERE player_id = ?
    """, (player_id,)).fetchone())

    agents = [dict(r) for r in conn.execute("""
        SELECT agent, COUNT(*) AS n,
          SUM(CASE WHEN match_result='WIN' THEN 1 ELSE 0 END) AS wins
        FROM v_wild_player_match_stats WHERE player_id = ? AND agent IS NOT NULL
        GROUP BY agent ORDER BY n DESC
    """, (player_id,)).fetchall()]

    # Role breakdown (Duelist/Initiator/Controller/Sentinel) — % of maps
    # played per class + performance per class, not shown in box scores
    # (per the user), just here on the player page. `role` comes from
    # match_players.role: stored directly for spreadsheet rows, derived from
    # agent via agent_roles.py at ingest time for API rows (backfilled for
    # matches ingested before this existed — see backfill_agent_role.py).
    total_with_role = conn.execute(
        "SELECT COUNT(*) FROM v_wild_player_match_stats WHERE player_id = ? AND role IS NOT NULL",
        (player_id,),
    ).fetchone()[0]
    roles = [dict(r) for r in conn.execute("""
        SELECT role, COUNT(*) AS n,
          SUM(CASE WHEN match_result='WIN' THEN 1 ELSE 0 END) AS wins,
          ROUND(SUM(kills) * 1.0 / NULLIF(SUM(deaths), 0), 2) AS kd,
          ROUND(SUM(acs * rounds_played) * 1.0 / NULLIF(SUM(rounds_played), 0), 1) AS acs,
          ROUND(SUM(adr * rounds_played) * 1.0 / NULLIF(SUM(rounds_played), 0), 1) AS adr
        FROM v_wild_player_match_stats WHERE player_id = ? AND role IS NOT NULL
        GROUP BY role ORDER BY n DESC
    """, (player_id,)).fetchall()]
    for r in roles:
        r["pct"] = round(100.0 * r["n"] / total_with_role, 1) if total_with_role else 0.0

    match_log = [dict(r) for r in conn.execute("""
        SELECT match_id, date, map, season_id, match_type, match_result, margin,
          agent, kills, deaths, assists, adr, hs_pct,
          two_k, three_k, four_k, five_k,
          (clutch_1v1 + clutch_1v2 + clutch_1v3 + clutch_1v4 + clutch_1v5) AS clutches,
          econ, match_source
        FROM v_wild_player_match_stats WHERE player_id = ?
        ORDER BY date DESC
    """, (player_id,)).fetchall()]

    return {"player": player, "totals": totals, "agents": agents, "roles": roles, "match_log": match_log}


def match_weeks(conn: sqlite3.Connection) -> list[dict]:
    """Groups individual maps into Premier "match weeks" — usually 2 maps
    (2 different opponents) on the same night, per the real season format
    the user described, confirmed against the actual data. Older seasons
    (Beta/Ignition/E7A3/early E8) turn out to have had single-map weeks
    instead — the grouping doesn't assume a fixed size, it just groups by
    (season, same Eastern-local calendar night, same match_type) and reports
    however many maps actually landed in that group.
    """
    rows = [dict(r) for r in conn.execute("""
        SELECT m.match_id, m.date, m.season_id, m.match_type, m.map, m.result, m.margin, m.source,
          t.name AS opponent
        FROM matches m LEFT JOIN teams t ON t.team_id = m.enemy_team_id
        ORDER BY m.date
    """).fetchall()]

    groups: dict[tuple, list[dict]] = defaultdict(list)
    for r in rows:
        key = (r["season_id"], _local_date(r["date"]), r["match_type"])
        groups[key].append(r)

    # Chronological week numbering, separately per (season, match_type) —
    # "Week 1" resets for each new season, Playoffs numbered independently
    # from Regular within the same season.
    counters: dict[tuple, int] = defaultdict(int)
    weeks = []
    for key in sorted(groups, key=lambda k: min(m["date"] for m in groups[k])):
        season_id, local_date, match_type = key
        counters[(season_id, match_type)] += 1
        n = counters[(season_id, match_type)]
        label = f"Week {n}" if match_type == "Regular" else (
            "Playoffs" if n == 1 and sum(1 for k in groups if k[0] == season_id and k[2] == match_type) == 1
            else f"Playoffs — Round {n}"
        )
        maps = groups[key]
        wins = sum(1 for m in maps if m["result"] == "WIN")
        losses = sum(1 for m in maps if m["result"] == "LOSS")
        weeks.append({
            "season_id": season_id,
            "local_date": local_date,
            "match_type": match_type,
            "label": label,
            "maps": maps,
            "wins": wins,
            "losses": losses,
            "record": f"{wins}-{losses}",
        })
    weeks.sort(key=lambda w: w["local_date"], reverse=True)
    return weeks


def schedule_by_season(conn: sqlite3.Connection) -> list[dict]:
    """Groups match_weeks() output by season for the Schedule page — one
    collapsible row per season, most recent season first, weeks within a
    season kept in the same most-recent-first order match_weeks already
    returns them in."""
    weeks = match_weeks(conn)
    seasons: dict[str, list[dict]] = defaultdict(list)
    for w in weeks:
        seasons[w["season_id"]].append(w)

    result = []
    for season_id, season_weeks in seasons.items():
        wins = sum(w["wins"] for w in season_weeks)
        losses = sum(w["losses"] for w in season_weeks)
        result.append({
            "season_id": season_id,
            "weeks": season_weeks,
            "wins": wins,
            "losses": losses,
            "record": f"{wins}-{losses}",
            "latest_date": season_weeks[0]["local_date"],
        })
    result.sort(key=lambda s: s["latest_date"], reverse=True)
    return result


def match_week_detail(conn: sqlite3.Connection, season_id: str, local_date: str) -> dict | None:
    all_weeks = match_weeks(conn)
    week = next((w for w in all_weeks if w["season_id"] == season_id and w["local_date"] == local_date), None)
    if week is None:
        return None

    match_ids = [m["match_id"] for m in week["maps"]]
    placeholders = ", ".join("?" for _ in match_ids)

    combined_box_score = [dict(r) for r in conn.execute(f"""
        SELECT
          p.player_id, p.riot_name, p.riot_tag, p.headshot_filename,
          COALESCE(p.nickname, p.riot_name) AS display_name,
          NULL AS agent,
          COUNT(*) AS maps_played,
          SUM(v.kills) AS kills, SUM(v.deaths) AS deaths, SUM(v.assists) AS assists,
          SUM(v.rounds_played) AS rounds_played,
          ROUND(SUM(v.acs * v.rounds_played) * 1.0 / NULLIF(SUM(v.rounds_played), 0), 1) AS acs,
          ROUND(SUM(v.adr * v.rounds_played) * 1.0 / NULLIF(SUM(v.rounds_played), 0), 1) AS adr,
          ROUND(SUM(v.hs_pct * v.rounds_played) * 1.0 / NULLIF(SUM(v.rounds_played), 0), 1) AS hs_pct,
          ROUND(SUM(v.kast_pct * v.rounds_played) * 1.0 / NULLIF(SUM(v.rounds_played), 0), 1) AS kast_pct,
          SUM(v.fk) AS fk, SUM(v.fd) AS fd,
          SUM(v.two_k) AS two_k, SUM(v.three_k) AS three_k, SUM(v.four_k) AS four_k, SUM(v.five_k) AS five_k,
          SUM(v.clutch_1v1) AS clutch_1v1, SUM(v.clutch_1v2) AS clutch_1v2, SUM(v.clutch_1v3) AS clutch_1v3,
          SUM(v.clutch_1v4) AS clutch_1v4, SUM(v.clutch_1v5) AS clutch_1v5,
          SUM(v.plants) AS plants, SUM(v.defuses) AS defuses,
          ROUND(AVG(v.econ), 1) AS econ
        FROM v_wild_player_match_stats v
        JOIN players p ON p.player_id = v.player_id
        WHERE v.match_id IN ({placeholders})
        GROUP BY p.player_id
        ORDER BY acs DESC
    """, match_ids).fetchall()]

    # Agent(s) played per player across the week's maps, in map order (a
    # player can swap agents map-to-map, unlike a single-match box score).
    agent_rows = conn.execute(f"""
        SELECT match_id, player_id, agent FROM match_players WHERE match_id IN ({placeholders})
    """, match_ids).fetchall()
    agent_by_player_match = defaultdict(dict)
    for r in agent_rows:
        agent_by_player_match[r["player_id"]][r["match_id"]] = r["agent"]
    for row in combined_box_score:
        row["agents"] = [agent_by_player_match[row["player_id"]].get(mid) for mid in match_ids]

    weapon_kills = [dict(r) for r in conn.execute(f"""
        SELECT w.player_id, COALESCE(p.nickname, p.riot_name) AS display_name,
          w.weapon, SUM(w.kill_count) AS kill_count
        FROM match_player_weapon_kills w JOIN players p ON p.player_id = w.player_id
        WHERE w.match_id IN ({placeholders})
        GROUP BY w.player_id, w.weapon
        ORDER BY kill_count DESC
    """, match_ids).fetchall()]

    economies = []
    for m in week["maps"]:
        match_row = conn.execute(
            "SELECT team_id, enemy_team_id FROM matches WHERE match_id = ?", (m["match_id"],)
        ).fetchone()
        if not match_row or not match_row["team_id"]:
            continue
        econ = match_economy(conn, m["match_id"], match_row["team_id"], match_row["enemy_team_id"])
        if econ:
            economies.append({"map": m["map"], "opponent": m["opponent"], "match_id": m["match_id"], "economy": econ})

    return {
        "week": week, "combined_box_score": combined_box_score,
        "weapon_kills": weapon_kills, "economies": economies,
    }


def team_comps(conn: sqlite3.Connection) -> list[dict]:
    """One row per map played, with the 5-agent composition WILD ran that
    map — role/agent pool decisions, not per-player performance, so this
    only needs match_players.agent (present for both API and spreadsheet
    rows) grouped by match, not the derived-stats layer."""
    rows = conn.execute("""
        SELECT m.match_id, m.date, m.season_id, m.match_type, m.map, m.result, m.margin, m.source,
          t.name AS opponent, mp.agent
        FROM matches m
        JOIN match_players mp ON mp.match_id = m.match_id AND mp.team_id = m.team_id
        LEFT JOIN teams t ON t.team_id = m.enemy_team_id
        WHERE mp.agent IS NOT NULL
        ORDER BY m.date DESC
    """).fetchall()

    matches: dict[str, dict] = {}
    for r in rows:
        m = matches.setdefault(r["match_id"], {
            "match_id": r["match_id"], "date": r["date"], "season_id": r["season_id"],
            "match_type": r["match_type"], "map": r["map"], "result": r["result"],
            "margin": r["margin"], "source": r["source"], "opponent": r["opponent"],
            "agents": [],
        })
        m["agents"].append(r["agent"])

    comps = [m for m in matches.values() if len(m["agents"]) == 5]
    comps.sort(key=lambda m: m["date"], reverse=True)
    for m in comps:
        m["agents"].sort()
    return comps


def match_list(conn: sqlite3.Connection) -> list[dict]:
    return [dict(r) for r in conn.execute("""
        SELECT m.match_id, m.date, m.season_id, m.match_type, m.map, m.result, m.margin, m.source,
          t.name AS opponent
        FROM matches m LEFT JOIN teams t ON t.team_id = m.enemy_team_id
        ORDER BY m.date DESC
    """).fetchall()]


def match_detail(conn: sqlite3.Connection, match_id: str) -> dict | None:
    match_row = conn.execute("""
        SELECT m.*, t.name AS opponent_name, t.tag AS opponent_tag
        FROM matches m LEFT JOIN teams t ON t.team_id = m.enemy_team_id
        WHERE m.match_id = ?
    """, (match_id,)).fetchone()
    if not match_row:
        return None
    match = dict(match_row)

    box_score = [dict(r) for r in conn.execute("""
        SELECT v.*, p.riot_name, p.riot_tag, p.headshot_filename,
          COALESCE(p.nickname, p.riot_name) AS display_name
        FROM v_match_player_stats v JOIN players p ON p.player_id = v.player_id
        WHERE v.match_id = ?
        ORDER BY v.is_wild_player DESC, v.acs DESC
    """, (match_id,)).fetchall()]

    weapon_kills = [dict(r) for r in conn.execute("""
        SELECT w.player_id, p.riot_name, COALESCE(p.nickname, p.riot_name) AS display_name, w.weapon, w.kill_count
        FROM match_player_weapon_kills w JOIN players p ON p.player_id = w.player_id
        WHERE w.match_id = ? ORDER BY w.kill_count DESC
    """, (match_id,)).fetchall()]

    timeline = []
    if match["team_id"] and match["enemy_team_id"]:
        timeline = compute_match_timeline(conn, match_id, match["team_id"], match["enemy_team_id"])

    economy = match_economy(conn, match_id, match["team_id"], match["enemy_team_id"]) if match["team_id"] else None

    return {
        "match": match, "box_score": box_score, "weapon_kills": weapon_kills,
        "timeline": timeline, "economy": economy,
    }


# Team-level loadout value comes from round_player_stats (per-player, per-
# round — Phase 1 data, never used for this before). Bucketed the same way
# most trackers do: pistol rounds (1 & 13, 0-indexed 0/12) called out
# separately since "how much you spent" isn't meaningful there (everyone
# starts at the same baseline), then Eco/Semi-eco/Semi-buy/Full-buy by total
# 5-player loadout value, thresholds per the user's reference image.
PISTOL_ROUNDS = {0, 12}


def _buy_bucket(loadout: int) -> str:
    if loadout < 5000:
        return "eco"
    if loadout < 10000:
        return "semi_eco"
    if loadout < 20000:
        return "semi_buy"
    return "full_buy"


def match_economy(conn: sqlite3.Connection, match_id: str, wild_team_id: str, enemy_team_id: str) -> dict | None:
    round_team_econ = conn.execute("""
        SELECT rps.round_number, mp.team_id,
          SUM(rps.loadout_value) AS loadout, SUM(rps.remaining_credits) AS remaining
        FROM round_player_stats rps
        JOIN match_players mp ON mp.match_id = rps.match_id AND mp.player_id = rps.player_id
        WHERE rps.match_id = ?
        GROUP BY rps.round_number, mp.team_id
    """, (match_id,)).fetchall()
    if not round_team_econ:
        return None

    winners = {
        r["round_number"]: r["winning_team_id"]
        for r in conn.execute("SELECT round_number, winning_team_id FROM rounds WHERE match_id = ?", (match_id,)).fetchall()
    }

    by_round: dict[int, dict] = defaultdict(dict)
    for r in round_team_econ:
        rn, tid = r["round_number"], r["team_id"]
        bucket = "pistol" if rn in PISTOL_ROUNDS else _buy_bucket(r["loadout"] or 0)
        by_round[rn][tid] = {
            "loadout": r["loadout"],
            "remaining": r["remaining"],
            "bucket": bucket,
            "won": winners.get(rn) == tid,
        }

    def blank_summary():
        return {b: {"n": 0, "won": 0} for b in ("pistol", "eco", "semi_eco", "semi_buy", "full_buy")}

    summary = {wild_team_id: blank_summary(), enemy_team_id: blank_summary()}
    for teams in by_round.values():
        for tid, info in teams.items():
            if tid not in summary:
                continue
            summary[tid][info["bucket"]]["n"] += 1
            if info["won"]:
                summary[tid][info["bucket"]]["won"] += 1

    rounds_out = [
        {
            "round_number": rn,
            "label": rn + 1,
            "wild": by_round[rn].get(wild_team_id),
            "enemy": by_round[rn].get(enemy_team_id),
        }
        for rn in sorted(by_round)
    ]

    return {"wild_summary": summary[wild_team_id], "enemy_summary": summary[enemy_team_id], "rounds": rounds_out}
