import type { SupabaseClient } from "@supabase/supabase-js";

// Direct port of src/wild_tracker/queries.py::match_economy.

export type BuyBucket = "pistol" | "eco" | "semi_eco" | "semi_buy" | "full_buy";

export type EconomyRoundSide = { loadout: number; remaining: number; bucket: BuyBucket; won: boolean };

export type EconomyRound = {
  round_number: number;
  label: number;
  wild: EconomyRoundSide | null;
  enemy: EconomyRoundSide | null;
};

export type BucketSummary = Record<BuyBucket, { n: number; won: number }>;

export type MatchEconomy = {
  wild_summary: BucketSummary;
  enemy_summary: BucketSummary;
  rounds: EconomyRound[];
};

const PISTOL_ROUNDS = new Set([0, 12]);

function buyBucket(loadout: number): "eco" | "semi_eco" | "semi_buy" | "full_buy" {
  if (loadout < 5000) return "eco";
  if (loadout < 10000) return "semi_eco";
  if (loadout < 20000) return "semi_buy";
  return "full_buy";
}

function blankSummary(): BucketSummary {
  return {
    pistol: { n: 0, won: 0 },
    eco: { n: 0, won: 0 },
    semi_eco: { n: 0, won: 0 },
    semi_buy: { n: 0, won: 0 },
    full_buy: { n: 0, won: 0 },
  };
}

export async function computeMatchEconomy(
  supabase: SupabaseClient,
  matchId: string,
  wildTeamId: string,
  enemyTeamId: string
): Promise<MatchEconomy | null> {
  const [{ data: statsRows }, { data: matchPlayers }, { data: roundsRows }] = await Promise.all([
    supabase
      .from("round_player_stats")
      .select("round_number, player_id, loadout_value, remaining_credits")
      .eq("match_id", matchId),
    supabase.from("match_players").select("player_id, team_id").eq("match_id", matchId),
    supabase.from("rounds").select("round_number, winning_team_id").eq("match_id", matchId),
  ]);

  if (!statsRows || statsRows.length === 0) return null;

  const teamByPlayer = new Map<string, string>();
  for (const p of matchPlayers ?? []) teamByPlayer.set(p.player_id, p.team_id);

  const winners = new Map<number, string>();
  for (const r of roundsRows ?? []) winners.set(r.round_number, r.winning_team_id);

  // Sum loadout/remaining per (round_number, team_id).
  const byRoundTeam = new Map<number, Map<string, { loadout: number; remaining: number }>>();
  for (const s of statsRows) {
    const teamId = teamByPlayer.get(s.player_id);
    if (!teamId) continue;
    if (!byRoundTeam.has(s.round_number)) byRoundTeam.set(s.round_number, new Map());
    const teamMap = byRoundTeam.get(s.round_number)!;
    const existing = teamMap.get(teamId) ?? { loadout: 0, remaining: 0 };
    existing.loadout += s.loadout_value ?? 0;
    existing.remaining += s.remaining_credits ?? 0;
    teamMap.set(teamId, existing);
  }

  const wildSummary = blankSummary();
  const enemySummary = blankSummary();
  const rounds: EconomyRound[] = [];

  for (const roundNumber of [...byRoundTeam.keys()].sort((a, b) => a - b)) {
    const teamMap = byRoundTeam.get(roundNumber)!;
    const entry: EconomyRound = { round_number: roundNumber, label: roundNumber + 1, wild: null, enemy: null };

    for (const [teamId, agg] of teamMap) {
      const bucket: BuyBucket = PISTOL_ROUNDS.has(roundNumber) ? "pistol" : buyBucket(agg.loadout);
      const won = winners.get(roundNumber) === teamId;
      const side: EconomyRoundSide = { loadout: agg.loadout, remaining: agg.remaining, bucket, won };

      if (teamId === wildTeamId) {
        entry.wild = side;
        wildSummary[bucket].n += 1;
        if (won) wildSummary[bucket].won += 1;
      } else if (teamId === enemyTeamId) {
        entry.enemy = side;
        enemySummary[bucket].n += 1;
        if (won) enemySummary[bucket].won += 1;
      }
    }

    rounds.push(entry);
  }

  return { wild_summary: wildSummary, enemy_summary: enemySummary, rounds };
}
