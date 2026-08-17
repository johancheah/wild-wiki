-- Views layer (PLAN.md §1): every "sheet" the frontend needs is a query over
-- the raw + derived tables, never a separately-stored table of its own.
-- Ported from db/views.sql (SQLite) — CREATE OR REPLACE VIEW is the Postgres
-- equivalent of "drop and recreate on every startup" (Postgres has no
-- CREATE VIEW IF NOT EXISTS, and we want changes here to always take effect
-- rather than silently keep a stale definition, per the bug found in
-- PLAN.md §6.8).

-- One row per player per match, blending API-computed rate stats (adr/hs_pct
-- computed from raw counters) with spreadsheet-provided ones (stored
-- directly, since the raw components don't survive in the sheet), plus
-- whatever derived stats exist for that match (computed or spreadsheet_manual
-- — a match only ever has one or the other, never both, so a plain LEFT JOIN
-- is safe here, no source disambiguation needed at read time).
CREATE OR REPLACE VIEW v_match_player_stats AS
SELECT
    mp.match_id,
    mp.player_id,
    mp.team_id,
    m.team_id AS wild_team_id,
    (mp.team_id = m.team_id) AS is_wild_player,
    mp.agent,
    mp.role,
    mp.score,
    mp.kills,
    mp.deaths,
    mp.assists,
    mp.rounds_played,
    COALESCE(mp.adr, mp.damage_dealt * 1.0 / NULLIF(mp.rounds_played, 0)) AS adr,
    COALESCE(mp.hs_pct, mp.headshots * 100.0 / NULLIF(mp.headshots + mp.bodyshots + mp.legshots, 0)) AS hs_pct,
    COALESCE(mp.acs, mp.score * 1.0 / NULLIF(mp.rounds_played, 0)) AS acs,
    mp.kast_pct,  -- spreadsheet rows only; genuinely unavailable from match-details-v4 for API rows (PLAN.md §5)
    mp.fk,
    mp.fd,
    CASE WHEN mp.rounds_played > 0 THEN mp.kills * 1.0 / mp.rounds_played END AS kpr,
    CASE WHEN mp.rounds_played > 0 THEN mp.assists * 1.0 / mp.rounds_played END AS apr,
    CASE WHEN mp.rounds_played > 0 THEN mp.fk * 1.0 / mp.rounds_played END AS fkpr,
    CASE WHEN mp.rounds_played > 0 THEN mp.fd * 1.0 / mp.rounds_played END AS fdpr,
    d.two_k, d.three_k, d.four_k, d.five_k,
    d.clutch_1v1, d.clutch_1v2, d.clutch_1v3, d.clutch_1v4, d.clutch_1v5,
    d.plants, d.defuses, d.econ,
    m.date, m.map, m.season_id, m.match_type, m.result AS match_result, m.margin,
    m.source AS match_source, m.enemy_team_id
FROM match_players mp
JOIN matches m ON m.match_id = mp.match_id
LEFT JOIN derived_player_match_stats d ON d.match_id = mp.match_id AND d.player_id = mp.player_id;

-- Same, restricted to WILD's own roster (excludes the opposing 5 players
-- that match_players also stores for API-sourced matches).
CREATE OR REPLACE VIEW v_wild_player_match_stats AS
SELECT * FROM v_match_player_stats WHERE is_wild_player;

-- New for the Postgres deploy: pushes what queries.py computed in Python
-- further into SQL, so the Next.js app can do plain .select() calls against
-- these instead of reimplementing aggregation logic in TypeScript. Mirrors
-- queries.py::team_record, ::player_career_list exactly.

CREATE OR REPLACE VIEW v_team_record AS
SELECT
    SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) AS wins,
    SUM(CASE WHEN result = 'LOSS' THEN 1 ELSE 0 END) AS losses,
    SUM(CASE WHEN result = 'DRAW' THEN 1 ELSE 0 END) AS draws,
    COUNT(*) AS total
FROM matches;

CREATE OR REPLACE VIEW v_team_record_by_map AS
SELECT map, COUNT(*) AS n,
    SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) AS wins
FROM matches GROUP BY map ORDER BY n DESC;

CREATE OR REPLACE VIEW v_team_record_by_season AS
SELECT season_id, COUNT(*) AS n,
    SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) AS wins,
    MIN(date) AS first_date
FROM matches GROUP BY season_id ORDER BY first_date;

CREATE OR REPLACE VIEW v_team_record_by_type AS
SELECT match_type, COUNT(*) AS n,
    SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) AS wins
FROM matches WHERE match_type IS NOT NULL GROUP BY match_type;

CREATE OR REPLACE VIEW v_player_career AS
SELECT
    p.player_id, p.riot_name, p.riot_tag, p.headshot_filename,
    COALESCE(p.nickname, p.riot_name) AS display_name,
    COUNT(*) AS matches_played,
    SUM(v.kills) AS kills, SUM(v.deaths) AS deaths, SUM(v.assists) AS assists,
    ROUND((SUM(v.kills) * 1.0 / NULLIF(SUM(v.deaths), 0))::numeric, 2) AS kd,
    ROUND((SUM(v.adr * v.rounds_played) * 1.0 / NULLIF(SUM(v.rounds_played), 0))::numeric, 1) AS adr,
    ROUND((SUM(v.hs_pct * v.rounds_played) * 1.0 / NULLIF(SUM(v.rounds_played), 0))::numeric, 1) AS hs_pct,
    SUM(v.two_k) AS two_k, SUM(v.three_k) AS three_k, SUM(v.four_k) AS four_k, SUM(v.five_k) AS five_k,
    SUM(v.clutch_1v1 + v.clutch_1v2 + v.clutch_1v3 + v.clutch_1v4 + v.clutch_1v5) AS clutches,
    SUM(v.plants) AS plants, SUM(v.defuses) AS defuses,
    ROUND(AVG(v.econ)::numeric, 1) AS econ
FROM v_wild_player_match_stats v
JOIN players p ON p.player_id = v.player_id
GROUP BY p.player_id;

CREATE OR REPLACE VIEW v_player_agent_pool AS
SELECT
    player_id, agent, COUNT(*) AS n,
    SUM(CASE WHEN match_result = 'WIN' THEN 1 ELSE 0 END) AS wins
FROM v_wild_player_match_stats
WHERE agent IS NOT NULL
GROUP BY player_id, agent;

CREATE OR REPLACE VIEW v_match_list AS
SELECT m.match_id, m.date, m.season_id, m.match_type, m.map, m.result, m.margin, m.source,
    t.name AS opponent
FROM matches m LEFT JOIN teams t ON t.team_id = m.enemy_team_id;

CREATE OR REPLACE VIEW v_match_row AS
SELECT m.*, t.name AS opponent_name, t.tag AS opponent_tag
FROM matches m LEFT JOIN teams t ON t.team_id = m.enemy_team_id;

-- v_match_player_stats + player identity, for box scores (PostgREST can't
-- join a view to a table on the fly the way queries.py's raw SQL did, so
-- this bakes the join in, same pattern as the other v_* views above).
CREATE OR REPLACE VIEW v_match_box_score AS
SELECT v.*, p.riot_name, p.riot_tag, p.headshot_filename,
    COALESCE(p.nickname, p.riot_name) AS display_name
FROM v_match_player_stats v JOIN players p ON p.player_id = v.player_id;

CREATE OR REPLACE VIEW v_match_weapon_kills AS
SELECT w.match_id, w.player_id, p.riot_name,
    COALESCE(p.nickname, p.riot_name) AS display_name,
    w.weapon, w.kill_count
FROM match_player_weapon_kills w JOIN players p ON p.player_id = w.player_id;
