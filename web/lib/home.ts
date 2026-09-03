import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMatchWeeks, fetchCombinedBoxScore, type MatchWeek, type CombinedBoxScoreRow } from "./schedule";
import { fetchMatchFullDetail } from "./matchDetail";
import { aggregateWeekTeamStats, type MatchTeamSummary, type WeekTeamStats } from "./teamSummary";
import { aggregateWeekEconomy, type WeekEconomySummary } from "./economy";

// Direct port of src/wild_tracker/queries.py::home_page_data.

export type UpcomingMatch = { map: string; note: string | null; updated_at: string | null };

export async function fetchUpcomingMatch(supabase: SupabaseClient): Promise<UpcomingMatch | null> {
  const { data } = await supabase.from("upcoming_match").select("map, note, updated_at").eq("id", 1).maybeSingle();
  return data && data.map ? data : null;
}

// Homepage's "Latest Result" is the most recent match *week* (usually 2
// maps against 2 different opponents), not just the single latest map —
// showing only one map used to hide half the week's result. Mirrors the
// same reuse pattern the match-week page ([season]/[date]/page.tsx) uses:
// fetchCombinedBoxScore for the combined scoreboard, fetchMatchFullDetail
// per map for each map's own head-to-head team_summary, and
// aggregateWeekTeamStats/aggregateWeekEconomy for the week-wide widgets.
export type LatestWeek = {
  week: MatchWeek;
  mapTeamSummaries: (MatchTeamSummary | null)[]; // aligned with week.maps, by index
  combinedBoxScore: CombinedBoxScoreRow[];
  weekTeamStats: WeekTeamStats | null;
  combinedEconomy: WeekEconomySummary | null;
};

export async function fetchLatestWeek(supabase: SupabaseClient): Promise<LatestWeek | null> {
  const weeks = await fetchMatchWeeks(supabase); // already sorted most-recent-first
  const week = weeks[0];
  if (!week) return null;

  const matchIds = week.maps.map((m) => m.match_id);
  const [combinedBoxScore, mapDetails] = await Promise.all([
    fetchCombinedBoxScore(supabase, matchIds),
    Promise.all(week.maps.map((m) => fetchMatchFullDetail(supabase, m.match_id))),
  ]);

  const mapTeamSummaries = mapDetails.map((d) => d?.teamSummary ?? null);
  const weekTeamStats = aggregateWeekTeamStats(mapDetails.map((d) => d?.teamSummary).filter((t) => t != null));
  const combinedEconomy = aggregateWeekEconomy(mapDetails.map((d) => d?.economy).filter((e) => e != null));

  return { week, mapTeamSummaries, combinedBoxScore, weekTeamStats, combinedEconomy };
}
