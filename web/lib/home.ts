import type { SupabaseClient } from "@supabase/supabase-js";
import type { BoxScoreRow, MatchRow } from "./types";

// Direct port of src/wild_tracker/queries.py::home_page_data.

export type UpcomingMatch = { map: string; note: string | null; updated_at: string | null };

export async function fetchUpcomingMatch(supabase: SupabaseClient): Promise<UpcomingMatch | null> {
  const { data } = await supabase.from("upcoming_match").select("map, note, updated_at").eq("id", 1).maybeSingle();
  return data && data.map ? data : null;
}

export type LatestMatch = { match: MatchRow; wildRows: BoxScoreRow[] };

export async function fetchLatestMatch(supabase: SupabaseClient): Promise<LatestMatch | null> {
  const { data: latestRow } = await supabase.from("matches").select("match_id").order("date", { ascending: false }).limit(1).maybeSingle();
  if (!latestRow) return null;

  const [{ data: matchRows }, { data: boxScoreRows }] = await Promise.all([
    supabase.from("v_match_row").select("*").eq("match_id", latestRow.match_id),
    supabase.from("v_match_box_score").select("*").eq("match_id", latestRow.match_id).eq("is_wild_player", true).order("acs", { ascending: false }),
  ]);

  const match = (matchRows as MatchRow[] | null)?.[0];
  if (!match) return null;

  return { match, wildRows: (boxScoreRows ?? []) as BoxScoreRow[] };
}
