import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventRounds } from "./eventRounds";
import type { MatchEconomy } from "./economy";

// Direct port of src/wild_tracker/queries.py::match_highlights — standout
// moments for the match page's Highlights carousel (4K+/ACE, clutches,
// thrifty round wins), built from data already fetched for the Performance
// tab (eventRounds) and Economy tab (economy) rather than new queries,
// except for resolving each event's player and (for thrifty rounds, which
// have no single credited player) that round's top WILD fragger.

export type HighlightType = "ace" | "multikill" | "clutch" | "thrifty";

export type HighlightEvent = {
  type: HighlightType;
  label: string;
  round: number;
  player: { player_id: string; display_name: string; headshot_filename: string | null };
};

export async function fetchMatchHighlights(
  supabase: SupabaseClient,
  matchId: string,
  wildTeamId: string | null,
  eventRounds: EventRounds,
  economy: MatchEconomy | null
): Promise<HighlightEvent[]> {
  if (!wildTeamId) return [];

  const { data: playerRows } = await supabase.from("players").select("player_id, riot_name, nickname, headshot_filename");
  const players = new Map(
    (playerRows ?? []).map((p: { player_id: string; riot_name: string; nickname: string | null; headshot_filename: string | null }) => [
      p.player_id,
      { player_id: p.player_id, display_name: p.nickname ?? p.riot_name, headshot_filename: p.headshot_filename },
    ])
  );

  const events: HighlightEvent[] = [];
  for (const [playerId, metrics] of Object.entries(eventRounds)) {
    const player = players.get(playerId);
    if (!player) continue;
    for (const rd of metrics.five_k) events.push({ type: "ace", label: "ACE", round: rd, player });
    for (const rd of metrics.four_k) events.push({ type: "multikill", label: "4K", round: rd, player });
    for (const n of [1, 2, 3, 4, 5] as const) {
      for (const rd of metrics[`clutch_1v${n}` as keyof typeof metrics] as number[]) {
        events.push({ type: "clutch", label: `1v${n}`, round: rd, player });
      }
    }
  }

  if (economy) {
    const thriftyRounds = economy.rounds
      .filter((r) => r.wild && r.wild.won && (r.wild.bucket === "eco" || r.wild.bucket === "semi_eco"))
      .map((r) => r.label);
    if (thriftyRounds.length > 0) {
      // Must restrict candidates to WILD players: an un-filtered query can
      // hand the credit to the round's top-fragging *opponent* instead
      // (caught 2026-10, schedule page's per-map tab).
      const { data: matchPlayerRows } = await supabase
        .from("match_players")
        .select("player_id")
        .eq("match_id", matchId)
        .eq("team_id", wildTeamId);
      const wildPlayerIds = new Set((matchPlayerRows ?? []).map((r: { player_id: string }) => r.player_id));

      const { data: killRows } = await supabase
        .from("kill_events")
        .select("round_number, killer_id")
        .eq("match_id", matchId)
        .not("killer_id", "is", null);
      const killCounts = new Map<number, Map<string, number>>();
      for (const k of killRows ?? []) {
        if (!wildPlayerIds.has(k.killer_id) || !players.has(k.killer_id)) continue;
        const roundLabel = k.round_number + 1;
        const byPlayer = killCounts.get(roundLabel) ?? new Map<string, number>();
        byPlayer.set(k.killer_id, (byPlayer.get(k.killer_id) ?? 0) + 1);
        killCounts.set(roundLabel, byPlayer);
      }
      for (const rd of thriftyRounds) {
        const byPlayer = killCounts.get(rd);
        if (!byPlayer || byPlayer.size === 0) continue;
        // Ties (equal kill count) broken by player_id, highest first —
        // matches Python's max(candidates, key=lambda c: (c[1], c[0])).
        const topPlayerId = [...byPlayer.entries()].sort((a, b) => b[1] - a[1] || (a[0] > b[0] ? -1 : 1))[0][0];
        const player = players.get(topPlayerId);
        if (player) events.push({ type: "thrifty", label: "THRIFTY", round: rd, player });
      }
    }
  }

  events.sort((a, b) => a.round - b.round);
  return events;
}
