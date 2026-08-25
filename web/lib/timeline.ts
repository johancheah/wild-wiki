import type { SupabaseClient } from "@supabase/supabase-js";

// Direct port of src/wild_tracker/round_side.py::compute_match_timeline.
// match-details-v4 doesn't expose ATK/DEF side per round directly, so this
// infers it: rounds group into standard 12-round halves (+ 2-round OT
// blocks after round 24); side is constant within a block and strictly
// alternates block-to-block, so only one block per match needs resolving
// from evidence — whichever team's plant_player appears in a block is that
// block's attacker (defenders can never plant). Blocks with no plant
// evidence inherit their side from any resolved neighbor via alternation.

export type TimelineEntry = {
  round_number: number;
  label: number;
  winner: "wild" | "enemy" | null;
  win_side: "ATK" | "DEF" | null;
  result: string | null;
};

function blockIndex(roundNumber: number): number {
  if (roundNumber < 24) return Math.floor(roundNumber / 12);
  return 2 + Math.floor((roundNumber - 24) / 2);
}

export async function computeMatchTimeline(
  supabase: SupabaseClient,
  matchId: string,
  wildTeamId: string,
  enemyTeamId: string
): Promise<TimelineEntry[]> {
  const [{ data: roundsData }, { data: playersData }] = await Promise.all([
    supabase
      .from("rounds")
      .select("round_number, winning_team_id, result, plant_player_id")
      .eq("match_id", matchId)
      .order("round_number"),
    supabase.from("match_players").select("player_id, team_id").eq("match_id", matchId),
  ]);

  const rounds = roundsData ?? [];
  if (rounds.length === 0) return [];

  const planterTeam = new Map<string, string>();
  for (const p of playersData ?? []) planterTeam.set(p.player_id, p.team_id);

  // Pass 1: determine each block's WILD side from plant evidence.
  const blockSide = new Map<number, "ATK" | "DEF" | null>();
  for (const r of rounds) {
    const block = blockIndex(r.round_number);
    if (!blockSide.has(block)) blockSide.set(block, null);
    if (blockSide.get(block) !== null) continue;
    const planter = r.plant_player_id;
    if (!planter) continue;
    const planterTeamId = planterTeam.get(planter);
    if (planterTeamId === wildTeamId) blockSide.set(block, "ATK");
    else if (planterTeamId === enemyTeamId) blockSide.set(block, "DEF");
  }

  // Pass 2: fill blocks with no plant evidence via alternation from any
  // resolved neighbor (side strictly alternates block-to-block, always).
  const blocksSorted = [...blockSide.keys()].sort((a, b) => a - b);
  for (let pass = 0; pass < blocksSorted.length; pass++) {
    let changed = false;
    for (let i = 0; i < blocksSorted.length; i++) {
      const b = blocksSorted[i];
      if (blockSide.get(b) !== null) continue;
      if (i > 0 && blockSide.get(blocksSorted[i - 1]) !== null) {
        blockSide.set(b, blockSide.get(blocksSorted[i - 1]) === "ATK" ? "DEF" : "ATK");
        changed = true;
      } else if (i < blocksSorted.length - 1 && blockSide.get(blocksSorted[i + 1]) !== null) {
        blockSide.set(b, blockSide.get(blocksSorted[i + 1]) === "ATK" ? "DEF" : "ATK");
        changed = true;
      }
    }
    if (!changed) break;
  }

  const timeline: TimelineEntry[] = [];
  for (const r of rounds) {
    const wildSide = blockSide.get(blockIndex(r.round_number)) ?? null;
    const winner: "wild" | "enemy" | null =
      r.winning_team_id === wildTeamId ? "wild" : r.winning_team_id === enemyTeamId ? "enemy" : null;
    let winSide: "ATK" | "DEF" | null = null;
    if (wildSide !== null && winner !== null) {
      winSide = winner === "wild" ? wildSide : wildSide === "ATK" ? "DEF" : "ATK";
    }
    timeline.push({
      round_number: r.round_number,
      label: r.round_number + 1,
      winner,
      win_side: winSide,
      result: r.result || "Time",
    });
  }

  // Pad to 24 rounds minimum (a full regulation match) with empty
  // placeholder cells, even if this match ended early — keeps every match's
  // timeline the same width. Matches that went to OT already have more than
  // 24 real rounds and are left as-is (never truncated).
  const lastRoundNumber = timeline[timeline.length - 1].round_number;
  for (let rn = lastRoundNumber + 1; rn < 24; rn++) {
    timeline.push({ round_number: rn, label: rn + 1, winner: null, win_side: null, result: null });
  }

  return timeline;
}
