import type { SupabaseClient } from "@supabase/supabase-js";
import { computeWildSideByRound } from "./timeline";
import { computeMatchEconomy } from "./economy";

// Direct port of src/wild_tracker/queries.py::match_team_summary — team-vs-
// team round-stat overview for a match's Overview tab (score, ATK/DEF round
// wins, first bloods, post-plant conversion, clutches, thrifties). A
// different thing from h2h.ts (a WILD-players x opponent-players kill grid);
// this is whole-team totals, one row per stat. API-sourced matches only
// (needs rounds/kill_events) — returns null for spreadsheet-sourced
// matches, same degrade as timeline/economy.

export type TeamSummarySide = {
  score: number;
  atk_won: number;
  atk_total: number;
  def_won: number;
  def_total: number;
  first_bloods: number;
  first_bloods_won: number;
  plants: number;
  post_plant_won: number;
  clutches: number;
  thrifties: number | null;
};

export type MatchTeamSummary = { wild: TeamSummarySide; enemy: TeamSummarySide };

type Acc = {
  atk_won: number;
  atk_total: number;
  def_won: number;
  def_total: number;
  first_bloods: number;
  first_bloods_won: number;
  plants: number;
  post_plant_won: number;
  clutches: number;
  thrifties: number;
};

function blankAcc(): Acc {
  return {
    atk_won: 0,
    atk_total: 0,
    def_won: 0,
    def_total: 0,
    first_bloods: 0,
    first_bloods_won: 0,
    plants: 0,
    post_plant_won: 0,
    clutches: 0,
    thrifties: 0,
  };
}

export async function computeMatchTeamSummary(
  supabase: SupabaseClient,
  matchId: string,
  wildTeamId: string,
  enemyTeamId: string
): Promise<MatchTeamSummary | null> {
  const [{ data: roundsData }, { data: playersData }, { data: killsData }, wildSideByRound] = await Promise.all([
    supabase
      .from("rounds")
      .select("round_number, winning_team_id, plant_player_id")
      .eq("match_id", matchId)
      .order("round_number"),
    supabase.from("match_players").select("player_id, team_id").eq("match_id", matchId),
    supabase
      .from("kill_events")
      .select("round_number, event_index, killer_id, victim_id")
      .eq("match_id", matchId)
      .order("event_index", { ascending: true }),
    computeWildSideByRound(supabase, matchId, wildTeamId, enemyTeamId),
  ]);

  const rounds = roundsData ?? [];
  if (rounds.length === 0) return null;

  const playerTeam = new Map<string, string>();
  for (const p of playersData ?? []) playerTeam.set(p.player_id, p.team_id);
  const wildPlayers = new Set([...playerTeam].filter(([, tid]) => tid === wildTeamId).map(([pid]) => pid));
  const enemyPlayers = new Set([...playerTeam].filter(([, tid]) => tid === enemyTeamId).map(([pid]) => pid));

  const kills = killsData ?? [];
  const killsByRound = new Map<number, { killer_id: string | null; victim_id: string | null }[]>();
  for (const k of kills) {
    if (!killsByRound.has(k.round_number)) killsByRound.set(k.round_number, []);
    killsByRound.get(k.round_number)!.push(k);
  }

  // First blood per round: the first kill by event order, whichever team
  // got it, plus whether that team went on to win the round.
  const fbTeamByRound = new Map<number, string | undefined>();
  for (const [roundNumber, roundKills] of killsByRound) {
    const first = roundKills.find((k) => k.killer_id);
    if (first?.killer_id) fbTeamByRound.set(roundNumber, playerTeam.get(first.killer_id));
  }

  const stats = { [wildTeamId]: blankAcc(), [enemyTeamId]: blankAcc() } as Record<string, Acc>;

  for (const r of rounds) {
    const rn = r.round_number;
    const winner = r.winning_team_id;
    const side = wildSideByRound.get(rn);
    if (side) {
      // Totals (played, not just won) per side — needed for the week-level
      // "Team Stats" widget's ATK/DEF conversion rates (aggregateWeekTeamStats
      // below), not just the h2h card's win counts.
      stats[wildTeamId][side === "ATK" ? "atk_total" : "def_total"] += 1;
      stats[enemyTeamId][side === "ATK" ? "def_total" : "atk_total"] += 1;
      if (winner === wildTeamId) {
        stats[wildTeamId][side === "ATK" ? "atk_won" : "def_won"] += 1;
      } else if (winner === enemyTeamId) {
        stats[enemyTeamId][side === "ATK" ? "def_won" : "atk_won"] += 1;
      }
    }

    const fbTeam = fbTeamByRound.get(rn);
    if (fbTeam && stats[fbTeam]) {
      stats[fbTeam].first_bloods += 1;
      if (winner === fbTeam) stats[fbTeam].first_bloods_won += 1;
    }

    const planterTeamId = r.plant_player_id ? playerTeam.get(r.plant_player_id) : undefined;
    if (planterTeamId && stats[planterTeamId]) {
      stats[planterTeamId].plants += 1;
      if (winner === planterTeamId) stats[planterTeamId].post_plant_won += 1;
    }
  }

  // Clutches: same "first team to be down to exactly 1 alive while the
  // other still has >=1" definition as derive.py/multi_kill_clutch_rounds,
  // generalized from WILD-only to whichever team hits that state first each
  // round — only one clutch situation can meaningfully arise per round.
  for (const r of rounds) {
    const roundKills = killsByRound.get(r.round_number) ?? [];
    const wildAlive = new Set(wildPlayers);
    const enemyAlive = new Set(enemyPlayers);
    let clutchTeam: string | null = null;
    for (const k of roundKills) {
      if (k.victim_id) {
        wildAlive.delete(k.victim_id);
        enemyAlive.delete(k.victim_id);
      }
      if (clutchTeam === null) {
        if (wildAlive.size === 1 && enemyAlive.size >= 1) clutchTeam = wildTeamId;
        else if (enemyAlive.size === 1 && wildAlive.size >= 1) clutchTeam = enemyTeamId;
      }
    }
    if (clutchTeam !== null && r.winning_team_id === clutchTeam) stats[clutchTeam].clutches += 1;
  }

  // Thrifty: won the round on a low buy (Eco/Semi-Eco — pistol rounds don't
  // count, everyone starts equal) — reuses computeMatchEconomy's own
  // bucketing so "thrifty" means the exact same thing here as in the
  // Economy tab.
  const economy = await computeMatchEconomy(supabase, matchId, wildTeamId, enemyTeamId);
  if (economy) {
    for (const rd of economy.rounds) {
      for (const [tid, side] of [
        [wildTeamId, rd.wild],
        [enemyTeamId, rd.enemy],
      ] as const) {
        if (side && side.won && (side.bucket === "eco" || side.bucket === "semi_eco")) stats[tid].thrifties += 1;
      }
    }
  }

  const score = (tid: string) => rounds.filter((r) => r.winning_team_id === tid).length;

  const row = (tid: string): TeamSummarySide => {
    const s = stats[tid];
    return {
      score: score(tid),
      atk_won: s.atk_won,
      atk_total: s.atk_total,
      def_won: s.def_won,
      def_total: s.def_total,
      first_bloods: s.first_bloods,
      first_bloods_won: s.first_bloods_won,
      plants: s.plants,
      post_plant_won: s.post_plant_won,
      clutches: s.clutches,
      thrifties: economy ? s.thrifties : null,
    };
  };

  return { wild: row(wildTeamId), enemy: row(enemyTeamId) };
}

// Whole-week "Team Stats" widget (match-week page's Overall tab only) —
// WILD-only round-conversion rates aggregated across the week's API-sourced
// maps. Direct port of src/wild_tracker/queries.py::week_team_stats — see
// its docstring for the RETAKE/5v4/4v5/OPENING derivations; every field
// here comes from already-computed MatchTeamSummary rows, no new queries.
export type PctRow = { won: number; total: number; pct: number | null };

export type WeekTeamStats = {
  atk: PctRow;
  def: PctRow;
  post_plant: PctRow;
  retake: PctRow;
  opening: PctRow;
  five_v_four: PctRow;
  four_v_five: PctRow;
};

function pctRow(won: number, total: number): PctRow {
  return { won, total, pct: total ? Math.round((won / total) * 100) : null };
}

export function aggregateWeekTeamStats(summaries: MatchTeamSummary[]): WeekTeamStats | null {
  if (summaries.length === 0) return null;

  let atkWon = 0,
    atkTotal = 0,
    defWon = 0,
    defTotal = 0;
  let plants = 0,
    postPlantWon = 0;
  let enemyPlants = 0,
    enemyPostPlantWon = 0;
  let wildFb = 0,
    wildFbWon = 0;
  let enemyFb = 0,
    enemyFbWon = 0;

  for (const { wild: w, enemy: e } of summaries) {
    atkWon += w.atk_won;
    atkTotal += w.atk_total;
    defWon += w.def_won;
    defTotal += w.def_total;
    plants += w.plants;
    postPlantWon += w.post_plant_won;
    enemyPlants += e.plants;
    enemyPostPlantWon += e.post_plant_won;
    wildFb += w.first_bloods;
    wildFbWon += w.first_bloods_won;
    enemyFb += e.first_bloods;
    enemyFbWon += e.first_bloods_won;
  }

  const fiveVFourWon = wildFbWon,
    fiveVFourTotal = wildFb;
  const fourVFiveWon = enemyFb - enemyFbWon,
    fourVFiveTotal = enemyFb;

  return {
    atk: pctRow(atkWon, atkTotal),
    def: pctRow(defWon, defTotal),
    post_plant: pctRow(postPlantWon, plants),
    retake: pctRow(enemyPlants - enemyPostPlantWon, enemyPlants),
    opening: pctRow(fiveVFourWon + fourVFiveWon, fiveVFourTotal + fourVFiveTotal),
    five_v_four: pctRow(fiveVFourWon, fiveVFourTotal),
    four_v_five: pctRow(fourVFiveWon, fourVFiveTotal),
  };
}
