from __future__ import annotations

import sqlite3


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

    match_log = [dict(r) for r in conn.execute("""
        SELECT match_id, date, map, season_id, match_type, match_result, margin,
          agent, kills, deaths, assists, adr, hs_pct,
          two_k, three_k, four_k, five_k,
          (clutch_1v1 + clutch_1v2 + clutch_1v3 + clutch_1v4 + clutch_1v5) AS clutches,
          econ, match_source
        FROM v_wild_player_match_stats WHERE player_id = ?
        ORDER BY date DESC
    """, (player_id,)).fetchall()]

    return {"player": player, "totals": totals, "agents": agents, "match_log": match_log}


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

    return {"match": match, "box_score": box_score, "weapon_kills": weapon_kills}
