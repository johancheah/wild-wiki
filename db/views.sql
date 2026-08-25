-- Views layer (PLAN.md §1): every "sheet" the frontend needs is a query over
-- the raw + derived tables, never a separately-stored table of its own.
--
-- Dropped and recreated on every app startup (db.py::init_schema) — views
-- have no data of their own to lose, and "CREATE VIEW IF NOT EXISTS" would
-- silently keep a stale definition after any column/logic change here.
DROP VIEW IF EXISTS v_wild_player_match_stats;
DROP VIEW IF EXISTS v_match_player_stats;

-- One row per player per match, blending API-computed rate stats (adr/hs_pct
-- computed from raw counters) with spreadsheet-provided ones (stored
-- directly, since the raw components don't survive in the sheet), plus
-- whatever derived stats exist for that match (computed or spreadsheet_manual
-- — a match only ever has one or the other, never both, so a plain LEFT JOIN
-- is safe here, no source disambiguation needed at read time).
CREATE VIEW IF NOT EXISTS v_match_player_stats AS
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
    mp.kast_pct,  -- direct for spreadsheet rows; computed for API rows from kill_events (compute_kast.py) — not in match-details-v4 directly, but derivable (PLAN.md §5, resolved)
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
CREATE VIEW IF NOT EXISTS v_wild_player_match_stats AS
SELECT * FROM v_match_player_stats WHERE is_wild_player = 1;
