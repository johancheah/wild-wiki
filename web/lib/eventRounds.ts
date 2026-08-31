import type { SupabaseClient } from "@supabase/supabase-js";

// Direct port of src/wild_tracker/queries.py::multi_kill_clutch_rounds —
// per-WILD-player round numbers (1-indexed, matching the round timeline's
// labels) where each multi-kill / clutch stat actually happened, powering
// the hover tooltip on those Performance-tab cells. Same derivation as
// derive.py::compute_multi_kills/compute_clutches, just keeping the round
// list instead of only the count. API-sourced matches only (needs
// kill_events); returns {} for spreadsheet-sourced matches.

export type EventRoundKey =
  | "two_k" | "three_k" | "four_k" | "five_k"
  | "clutch_1v1" | "clutch_1v2" | "clutch_1v3" | "clutch_1v4" | "clutch_1v5";

export type EventRounds = Record<string, Record<EventRoundKey, number[]>>;

function blankRounds(): Record<EventRoundKey, number[]> {
  return {
    two_k: [], three_k: [], four_k: [], five_k: [],
    clutch_1v1: [], clutch_1v2: [], clutch_1v3: [], clutch_1v4: [], clutch_1v5: [],
  };
}

export async function fetchEventRounds(
  supabase: SupabaseClient,
  matchId: string,
  wildTeamId: string | null
): Promise<EventRounds> {
  if (!wildTeamId) return {};

  const { data: killsData } = await supabase
    .from("kill_events")
    .select("round_number, killer_id, victim_id, time_in_round_ms")
    .eq("match_id", matchId);
  const kills = killsData ?? [];
  if (kills.length === 0) return {};

  const result: EventRounds = {};
  const getRow = (pid: string) => (result[pid] ??= blankRounds());

  const killsPerRound = new Map<string, number>();
  for (const k of kills) {
    if (!k.killer_id) continue;
    const key = `${k.round_number}:${k.killer_id}`;
    killsPerRound.set(key, (killsPerRound.get(key) ?? 0) + 1);
  }
  for (const [key, n] of killsPerRound) {
    const [roundStr, killer] = key.split(":");
    const label = Number(roundStr) + 1;
    const row = getRow(killer);
    if (n === 2) row.two_k.push(label);
    else if (n === 3) row.three_k.push(label);
    else if (n === 4) row.four_k.push(label);
    else if (n >= 5) row.five_k.push(label);
  }

  const [{ data: matchPlayers }, { data: roundsData }] = await Promise.all([
    supabase.from("match_players").select("player_id, team_id").eq("match_id", matchId),
    supabase.from("rounds").select("round_number, winning_team_id").eq("match_id", matchId),
  ]);

  const teamByPlayer = new Map<string, string>();
  for (const mp of matchPlayers ?? []) teamByPlayer.set(mp.player_id, mp.team_id);
  const wildPlayers = new Set([...teamByPlayer].filter(([, tid]) => tid === wildTeamId).map(([pid]) => pid));
  const enemyPlayers = new Set([...teamByPlayer].filter(([, tid]) => tid !== wildTeamId).map(([pid]) => pid));

  const killsByRound = new Map<number, typeof kills>();
  for (const k of kills) {
    if (!killsByRound.has(k.round_number)) killsByRound.set(k.round_number, []);
    killsByRound.get(k.round_number)!.push(k);
  }
  for (const [rn, rk] of killsByRound) {
    rk.sort((a, b) => (a.time_in_round_ms ?? 0) - (b.time_in_round_ms ?? 0));
    killsByRound.set(rn, rk);
  }

  for (const rd of roundsData ?? []) {
    const roundKills = killsByRound.get(rd.round_number) ?? [];
    const wildAlive = new Set(wildPlayers);
    const enemyAlive = new Set(enemyPlayers);
    let clutchSurvivor: string | null = null;
    let clutchN = 0;

    for (const k of roundKills) {
      const victim = k.victim_id;
      if (victim && wildAlive.has(victim)) wildAlive.delete(victim);
      else if (victim && enemyAlive.has(victim)) enemyAlive.delete(victim);

      if (clutchSurvivor === null && wildAlive.size === 1 && enemyAlive.size >= 1) {
        clutchSurvivor = [...wildAlive][0];
        clutchN = enemyAlive.size;
      }
    }

    if (clutchSurvivor !== null && rd.winning_team_id === wildTeamId) {
      const key = `clutch_1v${Math.min(clutchN, 5)}` as EventRoundKey;
      getRow(clutchSurvivor)[key].push(rd.round_number + 1);
    }
  }

  return result;
}
