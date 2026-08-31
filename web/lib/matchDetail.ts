import type { SupabaseClient } from "@supabase/supabase-js";
import { computeMatchTimeline, type TimelineEntry } from "./timeline";
import { computeMatchEconomy, type MatchEconomy } from "./economy";
import { fetchWeaponMatrix, type WeaponMatrix } from "./weapons";
import type { BoxScoreRow, MatchRow } from "./types";

// Direct port of src/wild_tracker/queries.py::match_detail — one full match's
// worth of box score / timeline / economy / weapons, reused both by the
// single-match page and by each map's tab on the match-week page, so a
// map's rendering there is driven by the exact same fetch as its own
// /matches/{id} page.
export type MatchFullDetail = {
  match: MatchRow;
  wildRows: BoxScoreRow[];
  enemyRows: BoxScoreRow[];
  timeline: TimelineEntry[];
  economy: MatchEconomy | null;
  weapons: WeaponMatrix | null;
};

export async function fetchMatchFullDetail(supabase: SupabaseClient, matchId: string): Promise<MatchFullDetail | null> {
  const [{ data: matchRows }, { data: boxScoreRows }] = await Promise.all([
    supabase.from("v_match_row").select("*").eq("match_id", matchId),
    supabase.from("v_match_box_score").select("*").eq("match_id", matchId),
  ]);

  const match = (matchRows as MatchRow[] | null)?.[0];
  if (!match) return null;

  const boxScore = (boxScoreRows ?? []) as BoxScoreRow[];
  const wildRows = boxScore.filter((r) => r.is_wild_player).sort((a, b) => (b.acs ?? 0) - (a.acs ?? 0));
  const enemyRows = boxScore.filter((r) => !r.is_wild_player).sort((a, b) => (b.acs ?? 0) - (a.acs ?? 0));

  const timeline =
    match.team_id && match.enemy_team_id
      ? await computeMatchTimeline(supabase, matchId, match.team_id, match.enemy_team_id)
      : [];
  const economy = match.team_id
    ? await computeMatchEconomy(supabase, matchId, match.team_id, match.enemy_team_id ?? "")
    : null;
  const weapons = match.team_id ? await fetchWeaponMatrix(supabase, matchId, match.team_id) : null;

  return { match, wildRows, enemyRows, timeline, economy, weapons };
}
