-- Row Level Security setup for Supabase. Every base table gets RLS enabled
-- with a permissive SELECT-only policy for anyone using the anon (public)
-- key — no INSERT/UPDATE/DELETE policy exists for anon, so those remain
-- denied by default. Views (v_*) don't need their own RLS: PostgREST/Postgres
-- checks RLS on the underlying tables a view reads from, so the SELECT
-- grants below already cover every v_* view in db/views.postgres.sql.
-- Idempotent — safe to rerun (DROP POLICY IF EXISTS before CREATE).

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY[
            'teams', 'players', 'season_schedule', 'matches', 'match_players',
            'derived_player_match_stats', 'match_player_weapon_kills',
            'rounds', 'kill_events', 'round_player_stats'
        ])
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS public_read ON %I', t);
        EXECUTE format('CREATE POLICY public_read ON %I FOR SELECT USING (true)', t);
    END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
