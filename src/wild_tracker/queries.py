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


def home_page_data(conn: sqlite3.Connection) -> dict:
    """Homepage: manually-curated upcoming-match header (see
    set_upcoming_match.py — HenrikDev's premier/seasons endpoint doesn't
    reliably give a team-specific "next map") plus the most recent match's
    full result, reusing match_detail() so the same box score/timeline the
    match page shows can render here too."""
    upcoming = conn.execute("SELECT map, note, updated_at FROM upcoming_match WHERE id = 1").fetchone()
    upcoming = dict(upcoming) if upcoming and upcoming["map"] else None

    latest_row = conn.execute("SELECT match_id FROM matches ORDER BY date DESC LIMIT 1").fetchone()
    latest = match_detail(conn, latest_row["match_id"]) if latest_row else None

    return {"upcoming": upcoming, "latest": latest}


def stage_list(conn: sqlite3.Connection) -> list[str]:
    """Distinct season/stage ids (e.g. "V26A5"), most recent first — same
    ordering convention as schedule.html."""
    rows = conn.execute("""
        SELECT season_id, MIN(date) AS first_date FROM matches
        WHERE season_id IS NOT NULL GROUP BY season_id ORDER BY first_date DESC
    """).fetchall()
    return [r["season_id"] for r in rows]


def player_career_list(conn: sqlite3.Connection, stage: str | None = None) -> list[dict]:
    where = "WHERE v.season_id = ?" if stage else ""
    params = (stage,) if stage else ()
    return [dict(r) for r in conn.execute(f"""
        SELECT
          p.player_id, p.riot_name, p.riot_tag, p.headshot_filename,
          COALESCE(p.nickname, p.riot_name) AS display_name,
          COUNT(*) AS matches_played,
          SUM(v.kills) AS kills, SUM(v.deaths) AS deaths, SUM(v.assists) AS assists,
          ROUND(SUM(v.kills) * 1.0 / NULLIF(SUM(v.deaths), 0), 2) AS kd,
          ROUND(SUM(v.acs * v.rounds_played) * 1.0 / NULLIF(SUM(v.rounds_played), 0), 1) AS acs,
          ROUND(SUM(v.adr * v.rounds_played) * 1.0 / NULLIF(SUM(v.rounds_played), 0), 1) AS adr,
          ROUND(SUM(v.hs_pct * v.rounds_played) * 1.0 / NULLIF(SUM(v.rounds_played), 0), 1) AS hs_pct,
          SUM(v.two_k) AS two_k, SUM(v.three_k) AS three_k, SUM(v.four_k) AS four_k, SUM(v.five_k) AS five_k,
          SUM(COALESCE(v.clutch_1v1, 0) + COALESCE(v.clutch_1v2, 0) + COALESCE(v.clutch_1v3, 0) + COALESCE(v.clutch_1v4, 0) + COALESCE(v.clutch_1v5, 0)) AS clutches,
          SUM(v.plants) AS plants, SUM(v.defuses) AS defuses,
          ROUND(AVG(v.econ), 0) AS econ
        FROM v_wild_player_match_stats v
        JOIN players p ON p.player_id = v.player_id
        {where}
        GROUP BY p.player_id
        ORDER BY kills DESC
    """, params).fetchall()]


def player_roster(conn: sqlite3.Connection) -> list[dict]:
    """Minimal id/name/headshot list for every WILD roster member,
    alphabetical by display name — powers the nav bar's player-switcher
    dropdown on the player detail page (deliberately not the full
    career-stats query; the dropdown just needs enough to render a row and
    link). Scoped to v_wild_player_match_stats, same as player_career_list
    — the raw `players` table also has every opponent ever faced, which
    isn't what "switch to another player" should mean here."""
    return [dict(r) for r in conn.execute("""
        SELECT DISTINCT p.player_id, p.headshot_filename, COALESCE(p.nickname, p.riot_name) AS display_name
        FROM players p JOIN v_wild_player_match_stats v ON v.player_id = p.player_id
        ORDER BY display_name COLLATE NOCASE
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
          ROUND(SUM(acs * rounds_played) * 1.0 / NULLIF(SUM(rounds_played), 0), 1) AS acs,
          ROUND(SUM(adr * rounds_played) * 1.0 / NULLIF(SUM(rounds_played), 0), 1) AS adr,
          ROUND(SUM(hs_pct * rounds_played) * 1.0 / NULLIF(SUM(rounds_played), 0), 1) AS hs_pct,
          SUM(two_k) AS two_k, SUM(three_k) AS three_k, SUM(four_k) AS four_k, SUM(five_k) AS five_k,
          SUM(clutch_1v1) AS clutch_1v1, SUM(clutch_1v2) AS clutch_1v2, SUM(clutch_1v3) AS clutch_1v3,
          SUM(clutch_1v4) AS clutch_1v4, SUM(clutch_1v5) AS clutch_1v5,
          SUM(plants) AS plants, SUM(defuses) AS defuses,
          ROUND(AVG(econ), 1) AS econ
        FROM v_wild_player_match_stats WHERE player_id = ?
    """, (player_id,)).fetchone())

    # Per-agent performance (not just play-count/win-rate) — rounds-weighted
    # like the totals/role-breakdown queries above, same reasoning: a simple
    # AVG(acs) across matches would over-weight short maps.
    agents = [dict(r) for r in conn.execute("""
        SELECT agent, COUNT(*) AS n,
          SUM(CASE WHEN match_result='WIN' THEN 1 ELSE 0 END) AS wins,
          ROUND(SUM(kills) * 1.0 / NULLIF(SUM(deaths), 0), 2) AS kd,
          ROUND(SUM(acs * rounds_played) * 1.0 / NULLIF(SUM(rounds_played), 0), 1) AS acs,
          ROUND(SUM(adr * rounds_played) * 1.0 / NULLIF(SUM(rounds_played), 0), 1) AS adr,
          ROUND(SUM(kast_pct * rounds_played) * 1.0 / NULLIF(SUM(rounds_played), 0), 1) AS kast_pct,
          ROUND(SUM(fk) * 1.0 / NULLIF(SUM(fd), 0), 2) AS fkfd
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
          ROUND(SUM(adr * rounds_played) * 1.0 / NULLIF(SUM(rounds_played), 0), 1) AS adr,
          ROUND(SUM(kast_pct * rounds_played) * 1.0 / NULLIF(SUM(rounds_played), 0), 1) AS kast_pct,
          ROUND(SUM(fk) * 1.0 / NULLIF(SUM(fd), 0), 2) AS fkfd
        FROM v_wild_player_match_stats WHERE player_id = ? AND role IS NOT NULL
        GROUP BY role ORDER BY n DESC
    """, (player_id,)).fetchall()]
    for r in roles:
        r["pct"] = round(100.0 * r["n"] / total_with_role, 1) if total_with_role else 0.0

    match_log = [dict(r) for r in conn.execute("""
        SELECT match_id, date, map, season_id, match_type, match_result, margin,
          agent, role, acs, kills, deaths, assists, adr, hs_pct, kast_pct, fk, fd,
          two_k, three_k, four_k, five_k,
          clutch_1v1, clutch_1v2, clutch_1v3, clutch_1v4, clutch_1v5,
          (COALESCE(clutch_1v1, 0) + COALESCE(clutch_1v2, 0) + COALESCE(clutch_1v3, 0) + COALESCE(clutch_1v4, 0) + COALESCE(clutch_1v5, 0)) AS clutches,
          plants, defuses, econ, match_source
        FROM v_wild_player_match_stats WHERE player_id = ?
        ORDER BY date DESC
    """, (player_id,)).fetchall()]

    # Week-grouping stripe: rows sharing the same match week (same season,
    # Eastern-local calendar night, and match_type — see match_weeks())
    # alternate background so weeks are visually separated, most useful
    # since a week is usually 2 maps played back to back.
    prev_week_key = None
    week_alt = False
    for m in match_log:
        week_key = (m["season_id"], _local_date(m["date"]), m["match_type"])
        if week_key != prev_week_key:
            week_alt = not week_alt
            prev_week_key = week_key
        m["week_alt"] = week_alt

    # Distinct values actually present in this player's own match log, for
    # the Match Log filter dropdowns — not every agent/map/stage in the
    # game, just the ones they've actually played.
    match_log_filters = {
        "agents": sorted({m["agent"] for m in match_log if m["agent"]}),
        "roles": sorted({m["role"] for m in match_log if m["role"]}),
        "maps": sorted({m["map"] for m in match_log if m["map"]}),
        "stages": sorted({m["season_id"] for m in match_log if m["season_id"]}),
    }

    # Career weapon kills, laid out like the VALORANT buy menu (see
    # player_weapon_grid — defined further down since it needs
    # _BUY_MENU_CATEGORIES, declared near the other weapon-ordering helpers).
    weapon_grid = player_weapon_grid(conn, player_id)

    return {
        "player": player, "totals": totals, "agents": agents, "roles": roles,
        "match_log": match_log, "match_log_filters": match_log_filters, "weapon_grid": weapon_grid,
    }


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

    # Per-map full detail (box score, weapons matrix, economy, timeline) —
    # reused as-is to drive each map's own Overview/Performance/Weapons/
    # Economy tabs, so a map's box score on the week page is byte-for-byte
    # the same rendering as its own /matches/{id} page.
    maps_detail = []
    weapon_matrices = []
    economies = []
    for m in week["maps"]:
        detail = match_detail(conn, m["match_id"])
        if detail is None:
            continue
        maps_detail.append({"map": m["map"], "opponent": m["opponent"], "match_id": m["match_id"], "detail": detail})
        if detail["weapons"]:
            weapon_matrices.append(detail["weapons"])
        if detail["economy"]:
            economies.append({"map": m["map"], "opponent": m["opponent"], "match_id": m["match_id"], "economy": detail["economy"]})

    combined_weapons = _merge_weapon_matrices(weapon_matrices)

    return {
        "week": week, "combined_box_score": combined_box_score,
        "combined_weapons": combined_weapons, "economies": economies,
        "maps_detail": maps_detail,
    }


_ROLE_ORDER = {"Controller": 0, "Initiator": 1, "Sentinel": 2, "Duelist": 3}


def team_comps(conn: sqlite3.Connection) -> list[dict]:
    """One row per map played, with the 5-agent composition WILD ran that
    map — role/agent pool decisions, not per-player performance, so this
    only needs match_players.agent/role (present for both API and
    spreadsheet rows) grouped by match, not the derived-stats layer. Each
    agent entry also carries the player's headshot, for a hover preview of
    who played it, and a `gap_before` flag so the template can apply a
    fixed, consistent visual gap at each role boundary (Controller/
    Initiator/Sentinel/Duelist) — a real pixel value, not the leftover
    space in a fixed-width slot (which varied with how many agents shared
    a role), while the row itself still renders in a fixed-width box so
    every row's total composition width stays identical."""
    rows = conn.execute("""
        SELECT m.match_id, m.date, m.season_id, m.match_type, m.map, m.result, m.margin, m.source,
          t.name AS opponent, mp.agent, mp.role,
          p.player_id, p.headshot_filename, COALESCE(p.nickname, p.riot_name) AS display_name
        FROM matches m
        JOIN match_players mp ON mp.match_id = m.match_id AND mp.team_id = m.team_id
        JOIN players p ON p.player_id = mp.player_id
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
        m["agents"].append({
            "agent": r["agent"], "role": r["role"], "player_id": r["player_id"],
            "headshot_filename": r["headshot_filename"], "display_name": r["display_name"],
        })

    comps = [m for m in matches.values() if len(m["agents"]) == 5]
    comps.sort(key=lambda m: m["date"], reverse=True)
    for m in comps:
        m["agents"].sort(key=lambda a: (_ROLE_ORDER.get(a["role"], 99), a["agent"] or ""))
        for i, a in enumerate(m["agents"]):
            a["gap_before"] = i > 0 and a["role"] != m["agents"][i - 1]["role"]
    return comps


def map_comp_summary(comps: list[dict]) -> dict:
    """Win rate + most-used agents for one map's worth of team_comps() rows
    (already filtered to a single map by the caller)."""
    wins = sum(1 for c in comps if c["result"] == "WIN")
    losses = sum(1 for c in comps if c["result"] == "LOSS")
    total = len(comps)
    win_pct = round(100 * wins / total, 1) if total else 0.0

    agent_stats: dict[str, dict] = defaultdict(lambda: {"n": 0, "wins": 0})
    for c in comps:
        for a in c["agents"]:
            stats = agent_stats[a["agent"]]
            stats["n"] += 1
            if c["result"] == "WIN":
                stats["wins"] += 1

    agents = [{"agent": agent, "n": s["n"], "wins": s["wins"],
               "win_pct": round(100 * s["wins"] / s["n"], 0) if s["n"] else 0.0}
              for agent, s in agent_stats.items()]
    agents.sort(key=lambda a: a["n"], reverse=True)

    return {"wins": wins, "losses": losses, "total": total, "win_pct": win_pct, "agents": agents}


def match_list(conn: sqlite3.Connection) -> list[dict]:
    return [dict(r) for r in conn.execute("""
        SELECT m.match_id, m.date, m.season_id, m.match_type, m.map, m.result, m.margin, m.source,
          t.name AS opponent
        FROM matches m LEFT JOIN teams t ON t.team_id = m.enemy_team_id
        ORDER BY m.date DESC
    """).fetchall()]


# Weapons tab column order: category first (rifles -> snipers -> heavy ->
# shotguns -> SMGs -> pistols -> melee), kills descending within a category.
# Ability-kills (e.g. "Blade Storm") aren't real weapons so they're never in
# this map — anything not listed falls into the trailing abilities/ults
# group instead.
_WEAPON_CATEGORY_ORDER: dict[str, int] = {
    "Bulldog": 0, "Guardian": 0, "Phantom": 0, "Vandal": 0,
    "Marshal": 1, "Outlaw": 1, "Operator": 1,
    "Ares": 2, "Odin": 2,
    "Bucky": 3, "Judge": 3,
    "Stinger": 4, "Spectre": 4,
    "Classic": 5, "Shorty": 5, "Frenzy": 5, "Ghost": 5, "Sheriff": 5,
    "Melee": 6,
}
_WEAPON_ABILITY_RANK = 7


def _sort_weapons(weapon_totals: dict[str, int]) -> list[str]:
    return sorted(
        weapon_totals,
        key=lambda w: (_WEAPON_CATEGORY_ORDER.get(w, _WEAPON_ABILITY_RANK), -weapon_totals[w]),
    )


# Same weapons, grouped and ordered the way VALORANT's own buy menu lays
# them out — 4 columns (Sidearms | SMGs+Shotguns | Rifles+Machine Guns |
# Sniper Rifles), each category's weapons in ascending price order — for
# the player page's Weapon Stats grid, which mirrors that layout with kill
# count standing in for price. A fixed structure (every weapon always
# shown, 0 kills and all) rather than only the ones a player has actually
# used, same as the real menu always showing every weapon regardless of
# loadout.
_BUY_MENU_COLUMNS: list[list[tuple[str, list[str]]]] = [
    [("Sidearms", ["Classic", "Shorty", "Frenzy", "Ghost", "Sheriff"])],
    [("SMGs", ["Stinger", "Spectre"]), ("Shotguns", ["Bucky", "Judge"])],
    [("Rifles", ["Bulldog", "Guardian", "Phantom", "Vandal"]), ("Machine Guns", ["Ares", "Odin"])],
    [("Sniper Rifles", ["Marshal", "Outlaw", "Operator"])],
]


def player_weapon_grid(conn: sqlite3.Connection, player_id: str) -> dict:
    rows = conn.execute("""
        SELECT weapon, SUM(kill_count) AS kills
        FROM match_player_weapon_kills WHERE player_id = ?
        GROUP BY weapon
    """, (player_id,)).fetchall()
    totals = {r["weapon"]: r["kills"] for r in rows}

    columns = [
        [
            {"label": label, "weapons": [{"weapon": w, "kills": totals.get(w, 0)} for w in weapons]}
            for label, weapons in col
        ]
        for col in _BUY_MENU_COLUMNS
    ]

    # Melee + ability-kills (e.g. "Blade Storm") aren't in the fixed buy-menu
    # list above — shown separately, only the ones actually used, kills desc.
    known = {w for col in _BUY_MENU_COLUMNS for _, ws in col for w in ws}
    other = sorted(
        ({"weapon": w, "kills": k} for w, k in totals.items() if w not in known),
        key=lambda x: x["kills"], reverse=True,
    )

    return {"columns": columns, "other": other}


def weapon_matrix(conn: sqlite3.Connection, match_id: str, wild_team_id: str) -> dict | None:
    """WILD-only weapon-kills matrix for the match's Weapons tab: one row
    per player, one column per weapon actually used — columns ordered
    rifles -> snipers -> heavy -> shotguns -> SMGs -> pistols -> melee ->
    abilities/ults, kills descending within each category; rows sorted by
    total kills descending. Opponent weapon kills aren't tracked here — the
    Weapons tab is about WILD's own loadout usage, same scope as the
    Performance tab."""
    rows = conn.execute("""
        SELECT w.player_id, COALESCE(p.nickname, p.riot_name) AS display_name, p.headshot_filename,
          w.weapon, w.kill_count
        FROM match_player_weapon_kills w
        JOIN players p ON p.player_id = w.player_id
        JOIN match_players mp ON mp.match_id = w.match_id AND mp.player_id = w.player_id
        WHERE w.match_id = ? AND mp.team_id = ?
    """, (match_id, wild_team_id)).fetchall()
    if not rows:
        return None

    weapon_totals: dict[str, int] = defaultdict(int)
    players: dict[str, dict] = {}
    for r in rows:
        weapon_totals[r["weapon"]] += r["kill_count"]
        p = players.setdefault(r["player_id"], {
            "player_id": r["player_id"], "display_name": r["display_name"],
            "headshot_filename": r["headshot_filename"], "kills_by_weapon": {}, "total": 0,
        })
        p["kills_by_weapon"][r["weapon"]] = r["kill_count"]
        p["total"] += r["kill_count"]

    weapons = _sort_weapons(weapon_totals)
    player_rows = sorted(players.values(), key=lambda p: p["total"], reverse=True)
    return {"weapons": weapons, "players": player_rows}


def _merge_weapon_matrices(matrices: list[dict]) -> dict | None:
    """Sums a list of per-match weapon_matrix() results into one combined
    matrix, for the match-week Overall tab's Weapons view."""
    weapon_totals: dict[str, int] = defaultdict(int)
    players: dict[str, dict] = {}
    for wm in matrices:
        if not wm:
            continue
        for p in wm["players"]:
            dest = players.setdefault(p["player_id"], {
                "player_id": p["player_id"], "display_name": p["display_name"],
                "headshot_filename": p["headshot_filename"], "kills_by_weapon": {}, "total": 0,
            })
            for weapon, count in p["kills_by_weapon"].items():
                dest["kills_by_weapon"][weapon] = dest["kills_by_weapon"].get(weapon, 0) + count
                dest["total"] += count
                weapon_totals[weapon] += count
    if not players:
        return None
    weapons = _sort_weapons(weapon_totals)
    player_rows = sorted(players.values(), key=lambda p: p["total"], reverse=True)
    return {"weapons": weapons, "players": player_rows}


def h2h_matrix(conn: sqlite3.Connection, match_id: str, wild_team_id: str, enemy_team_id: str | None) -> dict | None:
    """Head-to-head kill/death grid for the match's Performance tab — one
    row per WILD player, one column per opponent player, kills scored on
    that opponent vs deaths taken from them. Three variants computed from
    the same kill_events pull: all kills, first-kill-of-round only, and
    Operator kills only. API-sourced matches only — spreadsheet imports
    have no kill_events, so this returns None for those."""
    if not enemy_team_id:
        return None

    wild_players = conn.execute("""
        SELECT mp.player_id, COALESCE(p.nickname, p.riot_name) AS display_name, p.headshot_filename, mp.agent
        FROM match_players mp JOIN players p ON p.player_id = mp.player_id
        WHERE mp.match_id = ? AND mp.team_id = ?
    """, (match_id, wild_team_id)).fetchall()
    enemy_players = conn.execute("""
        SELECT mp.player_id, COALESCE(p.nickname, p.riot_name) AS display_name, p.headshot_filename, mp.agent
        FROM match_players mp JOIN players p ON p.player_id = mp.player_id
        WHERE mp.match_id = ? AND mp.team_id = ?
    """, (match_id, enemy_team_id)).fetchall()
    if not wild_players or not enemy_players:
        return None

    kills = conn.execute("""
        SELECT round_number, event_index, killer_id, victim_id, weapon
        FROM kill_events WHERE match_id = ? ORDER BY round_number, event_index
    """, (match_id,)).fetchall()
    if not kills:
        return None

    wild_ids = {r["player_id"] for r in wild_players}
    enemy_ids = {r["player_id"] for r in enemy_players}

    first_kill_keys = set()
    seen_rounds = set()
    for k in kills:
        if k["round_number"] not in seen_rounds:
            seen_rounds.add(k["round_number"])
            first_kill_keys.add((k["round_number"], k["event_index"]))

    def build(filter_fn):
        totals: dict[str, int] = defaultdict(int)
        cells: dict[str, dict[str, dict]] = {
            w["player_id"]: {e["player_id"]: {"k": 0, "d": 0} for e in enemy_players} for w in wild_players
        }
        for k in kills:
            if not filter_fn(k):
                continue
            killer, victim = k["killer_id"], k["victim_id"]
            if killer in wild_ids and victim in enemy_ids:
                cells[killer][victim]["k"] += 1
                totals[killer] += 1
            elif killer in enemy_ids and victim in wild_ids:
                cells[victim][killer]["d"] += 1
        return cells, totals

    all_cells, all_totals = build(lambda k: True)
    first_cells, _ = build(lambda k: (k["round_number"], k["event_index"]) in first_kill_keys)
    op_cells, _ = build(lambda k: k["weapon"] == "Operator")

    wild_order = sorted(wild_players, key=lambda w: all_totals.get(w["player_id"], 0), reverse=True)
    enemy_totals: dict[str, int] = defaultdict(int)
    for w_cells in all_cells.values():
        for eid, c in w_cells.items():
            enemy_totals[eid] += c["k"]
    enemy_order = sorted(enemy_players, key=lambda e: enemy_totals.get(e["player_id"], 0), reverse=True)

    def rows_for(cells):
        rows = []
        for w in wild_order:
            row_cells = []
            for e in enemy_order:
                c = cells[w["player_id"]][e["player_id"]]
                row_cells.append({"k": c["k"], "d": c["d"], "diff": c["k"] - c["d"]})
            rows.append({
                "player_id": w["player_id"], "display_name": w["display_name"],
                "headshot_filename": w["headshot_filename"], "agent": w["agent"], "cells": row_cells,
            })
        return rows

    return {
        "enemy_players": [dict(e) for e in enemy_order],
        "variants": {"all": rows_for(all_cells), "first": rows_for(first_cells), "op": rows_for(op_cells)},
    }


def multi_kill_clutch_rounds(conn: sqlite3.Connection, match_id: str, wild_team_id: str | None) -> dict[str, dict[str, list[int]]]:
    """Per-WILD-player round numbers (1-indexed, matching the round
    timeline's labels) where each multi-kill / clutch stat in the
    Performance tab actually happened — powers the hover tooltip on those
    cells. Same derivation as derive.py::compute_multi_kills/
    compute_clutches, just keeping the round list instead of only the
    count. API-sourced matches only (needs kill_events); returns {} for
    spreadsheet-sourced matches, so those cells just show no tooltip."""
    if not wild_team_id:
        return {}

    kill_rows = conn.execute("""
        SELECT round_number, killer_id, COUNT(*) AS n
        FROM kill_events WHERE match_id = ? AND killer_id IS NOT NULL
        GROUP BY round_number, killer_id
    """, (match_id,)).fetchall()
    if not kill_rows:
        return {}

    result: dict[str, dict[str, list[int]]] = defaultdict(lambda: {
        "two_k": [], "three_k": [], "four_k": [], "five_k": [],
        "clutch_1v1": [], "clutch_1v2": [], "clutch_1v3": [], "clutch_1v4": [], "clutch_1v5": [],
    })
    for r in kill_rows:
        label, n = r["round_number"] + 1, r["n"]
        if n == 2:
            result[r["killer_id"]]["two_k"].append(label)
        elif n == 3:
            result[r["killer_id"]]["three_k"].append(label)
        elif n == 4:
            result[r["killer_id"]]["four_k"].append(label)
        elif n >= 5:
            result[r["killer_id"]]["five_k"].append(label)

    player_team = {
        row["player_id"]: row["team_id"]
        for row in conn.execute("SELECT player_id, team_id FROM match_players WHERE match_id = ?", (match_id,)).fetchall()
    }
    wild_players = {pid for pid, tid in player_team.items() if tid == wild_team_id}
    enemy_players = {pid for pid, tid in player_team.items() if tid != wild_team_id}

    for rd in conn.execute("SELECT round_number, winning_team_id FROM rounds WHERE match_id = ?", (match_id,)).fetchall():
        round_number, winning_team_id = rd["round_number"], rd["winning_team_id"]
        kills = conn.execute("""
            SELECT killer_id, victim_id FROM kill_events
            WHERE match_id = ? AND round_number = ? ORDER BY time_in_round_ms ASC
        """, (match_id, round_number)).fetchall()

        wild_alive, enemy_alive = set(wild_players), set(enemy_players)
        clutch_survivor, clutch_n = None, None
        for k in kills:
            victim = k["victim_id"]
            if victim in wild_alive:
                wild_alive.discard(victim)
            elif victim in enemy_alive:
                enemy_alive.discard(victim)
            if clutch_survivor is None and len(wild_alive) == 1 and len(enemy_alive) >= 1:
                clutch_survivor = next(iter(wild_alive))
                clutch_n = len(enemy_alive)

        if clutch_survivor is not None and winning_team_id == wild_team_id:
            result[clutch_survivor][f"clutch_1v{min(clutch_n, 5)}"].append(round_number + 1)

    return result


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
    weapons = weapon_matrix(conn, match_id, match["team_id"]) if match["team_id"] else None
    h2h = h2h_matrix(conn, match_id, match["team_id"], match["enemy_team_id"]) if match["team_id"] else None
    event_rounds = multi_kill_clutch_rounds(conn, match_id, match["team_id"])

    return {
        "match": match, "box_score": box_score, "weapon_kills": weapon_kills,
        "timeline": timeline, "economy": economy, "weapons": weapons, "h2h": h2h,
        "event_rounds": event_rounds,
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
