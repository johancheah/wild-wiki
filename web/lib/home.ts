import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMatchWeeks, fetchCombinedBoxScore, type MatchWeek, type CombinedBoxScoreRow } from "./schedule";

// Direct port of src/wild_tracker/queries.py::home_page_data.

export type UpcomingMatch = { map: string; note: string | null; updated_at: string | null };

export async function fetchUpcomingMatch(supabase: SupabaseClient): Promise<UpcomingMatch | null> {
  const { data } = await supabase.from("upcoming_match").select("map, note, updated_at").eq("id", 1).maybeSingle();
  return data && data.map ? data : null;
}

// Homepage's "Latest Result" is the most recent match *week* (usually 2
// maps against 2 different opponents), not just the single latest map —
// showing only one map used to hide half the week's result. Reuses
// fetchCombinedBoxScore, the same combined (multi-agent) box score the
// match-week page's Overall tab renders.
export type LatestWeek = { week: MatchWeek; combinedBoxScore: CombinedBoxScoreRow[] };

export async function fetchLatestWeek(supabase: SupabaseClient): Promise<LatestWeek | null> {
  const weeks = await fetchMatchWeeks(supabase); // already sorted most-recent-first
  const week = weeks[0];
  if (!week) return null;

  const matchIds = week.maps.map((m) => m.match_id);
  const combinedBoxScore = await fetchCombinedBoxScore(supabase, matchIds);
  return { week, combinedBoxScore };
}
