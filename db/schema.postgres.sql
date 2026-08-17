-- WILD Gaming Valorant Tracker — Postgres (Supabase) schema.
-- Ported from db/schema.sql (SQLite). Differences from the SQLite version:
--   * REAL -> DOUBLE PRECISION
--   * raw_payload TEXT -> JSONB (native JSON, was a stringly-typed workaround in SQLite)
--   * was_afk INTEGER (0/1) -> BOOLEAN (native support)
--   * ingested_at default datetime('now') -> now()
--   * no PRAGMA statement (Postgres always enforces FKs)
-- date/season_id/etc. remain TEXT (ISO 8601 strings) rather than TIMESTAMPTZ —
-- deliberately minimal-diff for this migration; sorts correctly as-is since
-- the format is always consistent. Revisit later if it becomes a real need.

CREATE TABLE IF NOT EXISTS teams (
    team_id     TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    tag         TEXT NOT NULL
);

-- headshot_filename is a file under web/public/headshots/, set manually per
-- teammate (real photos the user provides) — not something any API gives us.
-- nickname, when set, is shown instead of riot_name throughout the UI (e.g.
-- "Calum" instead of "YourMother") — also user-provided, not from any API.
CREATE TABLE IF NOT EXISTS players (
    player_id           TEXT PRIMARY KEY,  -- puuid
    riot_name           TEXT NOT NULL,
    riot_tag            TEXT NOT NULL,
    headshot_filename   TEXT,
    nickname             TEXT
);

CREATE TABLE IF NOT EXISTS season_schedule (
    season_id   TEXT PRIMARY KEY,  -- matches Data.Phase values, e.g. "E8A2", "V25:A5"
    week_label  TEXT,
    start_date  TEXT,
    end_date    TEXT
);

-- season_id is NOT a foreign key into season_schedule: it's populated
-- straight from the API's metadata.season on ingest, while season_schedule
-- (week labels/date ranges) is separately curated by you. Enforcing the FK
-- would make ingestion fail for any season you haven't manually scheduled yet.
CREATE TABLE IF NOT EXISTS matches (
    match_id        TEXT PRIMARY KEY,  -- real API match UUID, or "xlsx-{match_num}" for spreadsheet-imported rows
    source          TEXT NOT NULL DEFAULT 'api',  -- 'api' | 'spreadsheet' — see xlsx_import.py
    season_id       TEXT,
    date            TEXT NOT NULL,      -- ISO 8601
    map             TEXT NOT NULL,
    match_type      TEXT,               -- 'Regular' | 'Playoffs' (not always inferable from API alone — see ingest.py)
    team_id         TEXT REFERENCES teams(team_id),
    enemy_team_id   TEXT REFERENCES teams(team_id),  -- NULL for spreadsheet-imported rows: the spreadsheet never recorded opponent identity, only rounds won/lost (confirmed against the real file)
    result          TEXT,               -- 'WIN' | 'LOSS' | 'DRAW'
    margin          INTEGER,
    raw_payload     JSONB,              -- full match-details-v4 JSON for API rows; NULL for spreadsheet rows
    ingested_at     TEXT NOT NULL DEFAULT (now()::text)
);

-- NOTE: match-details-v4 does not return ADR/HS%/KAST/ACS/FK/FD as direct
-- fields (confirmed against the real OpenAPI schema) — only raw counters.
-- We store the raw counters here; ACS/ADR/HS% are cheap to compute in the
-- views layer from these. KAST specifically needs round-by-round survived/
-- traded state that this endpoint does not expose at all — flagged as an
-- open question in PLAN.md §5, not silently approximated here.
-- adr/hs_pct/role/fk/fd/acs/kast_pct are nullable and populated ONLY for
-- spreadsheet-sourced rows, where we get the pre-computed value directly but
-- not its raw components (no per-shot or per-round data survives in the
-- sheet). API-sourced rows leave these null and compute ACS/ADR/HS% from the
-- raw counters (headshots/bodyshots/legshots/damage_dealt/rounds_played) in
-- the views layer instead; FK/FD for API rows is a Phase 2 kill_events
-- derivation.
CREATE TABLE IF NOT EXISTS match_players (
    match_id            TEXT NOT NULL REFERENCES matches(match_id),
    player_id           TEXT NOT NULL REFERENCES players(player_id),
    team_id             TEXT REFERENCES teams(team_id),
    agent               TEXT,
    role                TEXT,
    score               INTEGER,
    kills               INTEGER,
    deaths               INTEGER,
    assists             INTEGER,
    headshots           INTEGER,
    bodyshots           INTEGER,
    legshots            INTEGER,
    damage_dealt        INTEGER,
    damage_received      INTEGER,
    economy_spent_overall        INTEGER,
    economy_loadout_value_overall INTEGER,
    rounds_played       INTEGER,
    adr                  DOUBLE PRECISION,
    hs_pct                DOUBLE PRECISION,
    fk                    INTEGER,
    fd                    INTEGER,
    acs                   DOUBLE PRECISION,
    kast_pct              DOUBLE PRECISION,
    PRIMARY KEY (match_id, player_id)
);

-- Multi-kills/clutches/plants/defuses/ECON. For source='spreadsheet_manual'
-- rows these are values you hand-tallied, ported as-is. For
-- source='computed' rows (Phase 2) these are derived from kill_events/rounds.
-- Never mix provenance within a row — the `source` column keeps that honest.
CREATE TABLE IF NOT EXISTS derived_player_match_stats (
    match_id        TEXT NOT NULL REFERENCES matches(match_id),
    player_id       TEXT NOT NULL REFERENCES players(player_id),
    source          TEXT NOT NULL,  -- 'spreadsheet_manual' | 'computed'
    two_k           INTEGER,
    three_k         INTEGER,
    four_k          INTEGER,
    five_k          INTEGER,
    clutch_1v1      INTEGER,
    clutch_1v2      INTEGER,
    clutch_1v3      INTEGER,
    clutch_1v4      INTEGER,
    clutch_1v5      INTEGER,
    plants          INTEGER,
    defuses         INTEGER,
    econ            DOUBLE PRECISION,
    PRIMARY KEY (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS match_player_weapon_kills (
    match_id        TEXT NOT NULL REFERENCES matches(match_id),
    player_id       TEXT NOT NULL REFERENCES players(player_id),
    weapon          TEXT NOT NULL,
    kill_count      INTEGER NOT NULL,
    PRIMARY KEY (match_id, player_id, weapon)
);

-- side (ATK/DEF) is not directly present per round in match-details-v4 and
-- is left null in Phase 1 — determinable later from map side-swap
-- conventions if needed, not worth guessing at now.
CREATE TABLE IF NOT EXISTS rounds (
    match_id            TEXT NOT NULL REFERENCES matches(match_id),
    round_number        INTEGER NOT NULL,
    winning_team_id     TEXT REFERENCES teams(team_id),
    side                TEXT,
    ceremony            TEXT,
    plant_player_id     TEXT REFERENCES players(player_id),
    plant_site          TEXT,
    defuse_player_id    TEXT REFERENCES players(player_id),
    PRIMARY KEY (match_id, round_number)
);

-- One row per (round_number, killer/victim pair). location.x/y is the single
-- location the API attaches to a kill event (not separately tagged as
-- killer's vs. victim's position — verify against a real payload).
CREATE TABLE IF NOT EXISTS kill_events (
    match_id            TEXT NOT NULL REFERENCES matches(match_id),
    round_number        INTEGER NOT NULL,
    event_index         INTEGER NOT NULL,  -- order within the round, since there's no natural PK
    time_in_round_ms    INTEGER,
    time_in_match_ms    INTEGER,
    killer_id            TEXT REFERENCES players(player_id),
    victim_id            TEXT REFERENCES players(player_id),
    assistant_ids        JSONB,   -- JSON array of player_ids
    weapon                TEXT,
    location_x           DOUBLE PRECISION,
    location_y           DOUBLE PRECISION,
    PRIMARY KEY (match_id, round_number, event_index)
);

-- Per-player-per-round snapshot (data.rounds[].stats[]) — this is what lets
-- the "Rounds" view reconstruct per-team loadout value per round, and gives
-- a partial basis for KAST later (kills/damage per round are here; survived/
-- traded state still is not — see the note on match_players above).
CREATE TABLE IF NOT EXISTS round_player_stats (
    match_id            TEXT NOT NULL REFERENCES matches(match_id),
    round_number        INTEGER NOT NULL,
    player_id           TEXT NOT NULL REFERENCES players(player_id),
    kills               INTEGER,
    headshots           INTEGER,
    bodyshots           INTEGER,
    legshots             INTEGER,
    damage               INTEGER,
    loadout_value        INTEGER,
    remaining_credits    INTEGER,
    weapon                TEXT,
    armor                 TEXT,
    was_afk               BOOLEAN,
    PRIMARY KEY (match_id, round_number, player_id)
);

CREATE INDEX IF NOT EXISTS idx_match_players_match ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_round_player_stats_match ON round_player_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_kill_events_match_round ON kill_events(match_id, round_number);
CREATE INDEX IF NOT EXISTS idx_matches_team ON matches(team_id);
