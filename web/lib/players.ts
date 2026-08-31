import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerCareer } from "./types";

// Direct port of src/wild_tracker/queries.py::stage_list / player_career_list.

export async function fetchStages(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from("matches").select("season_id, date").not("season_id", "is", null);
  const firstDate = new Map<string, string>();
  for (const r of data ?? []) {
    const existing = firstDate.get(r.season_id);
    if (!existing || r.date < existing) firstDate.set(r.season_id, r.date);
  }
  return [...firstDate.entries()].sort((a, b) => (a[1] < b[1] ? 1 : -1)).map(([season]) => season);
}

type BoxScoreStatRow = {
  player_id: string;
  riot_name: string;
  riot_tag: string;
  headshot_filename: string | null;
  display_name: string;
  kills: number;
  deaths: number;
  assists: number;
  rounds_played: number | null;
  adr: number | null;
  hs_pct: number | null;
  two_k: number | null;
  three_k: number | null;
  four_k: number | null;
  five_k: number | null;
  clutch_1v1: number | null;
  clutch_1v2: number | null;
  clutch_1v3: number | null;
  clutch_1v4: number | null;
  clutch_1v5: number | null;
  plants: number | null;
  defuses: number | null;
  econ: number | null;
};

export async function fetchPlayerCareer(supabase: SupabaseClient, stage: string | null): Promise<PlayerCareer[]> {
  let query = supabase.from("v_match_box_score").select("*").eq("is_wild_player", true);
  if (stage) query = query.eq("season_id", stage);
  const { data } = await query.returns<BoxScoreStatRow[]>();

  type Acc = {
    player_id: string;
    riot_name: string;
    riot_tag: string;
    headshot_filename: string | null;
    display_name: string;
    matches_played: number;
    kills: number;
    deaths: number;
    assists: number;
    roundsPlayed: number;
    adrWeighted: number;
    hsWeighted: number;
    two_k: number;
    three_k: number;
    four_k: number;
    five_k: number;
    clutches: number;
    plants: number;
    defuses: number;
    econSum: number;
    econN: number;
  };
  const byPlayer = new Map<string, Acc>();

  for (const r of data ?? []) {
    if (!byPlayer.has(r.player_id)) {
      byPlayer.set(r.player_id, {
        player_id: r.player_id,
        riot_name: r.riot_name,
        riot_tag: r.riot_tag,
        headshot_filename: r.headshot_filename,
        display_name: r.display_name,
        matches_played: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        roundsPlayed: 0,
        adrWeighted: 0,
        hsWeighted: 0,
        two_k: 0,
        three_k: 0,
        four_k: 0,
        five_k: 0,
        clutches: 0,
        plants: 0,
        defuses: 0,
        econSum: 0,
        econN: 0,
      });
    }
    const acc = byPlayer.get(r.player_id)!;
    const rp = r.rounds_played ?? 0;
    acc.matches_played += 1;
    acc.kills += r.kills ?? 0;
    acc.deaths += r.deaths ?? 0;
    acc.assists += r.assists ?? 0;
    acc.roundsPlayed += rp;
    acc.adrWeighted += (r.adr ?? 0) * rp;
    acc.hsWeighted += (r.hs_pct ?? 0) * rp;
    acc.two_k += r.two_k ?? 0;
    acc.three_k += r.three_k ?? 0;
    acc.four_k += r.four_k ?? 0;
    acc.five_k += r.five_k ?? 0;
    acc.clutches += (r.clutch_1v1 ?? 0) + (r.clutch_1v2 ?? 0) + (r.clutch_1v3 ?? 0) + (r.clutch_1v4 ?? 0) + (r.clutch_1v5 ?? 0);
    acc.plants += r.plants ?? 0;
    acc.defuses += r.defuses ?? 0;
    if (r.econ !== null) {
      acc.econSum += r.econ;
      acc.econN += 1;
    }
  }

  const players: PlayerCareer[] = [...byPlayer.values()].map((acc) => ({
    player_id: acc.player_id,
    riot_name: acc.riot_name,
    riot_tag: acc.riot_tag,
    headshot_filename: acc.headshot_filename,
    display_name: acc.display_name,
    matches_played: acc.matches_played,
    kills: acc.kills,
    deaths: acc.deaths,
    assists: acc.assists,
    kd: acc.deaths ? Math.round((acc.kills / acc.deaths) * 100) / 100 : null,
    adr: acc.roundsPlayed ? Math.round((acc.adrWeighted / acc.roundsPlayed) * 10) / 10 : null,
    hs_pct: acc.roundsPlayed ? Math.round((acc.hsWeighted / acc.roundsPlayed) * 10) / 10 : null,
    two_k: acc.two_k,
    three_k: acc.three_k,
    four_k: acc.four_k,
    five_k: acc.five_k,
    clutches: acc.clutches,
    plants: acc.plants,
    defuses: acc.defuses,
    econ: acc.econN ? Math.round((acc.econSum / acc.econN) * 10) / 10 : null,
  }));

  players.sort((a, b) => b.kills - a.kills);
  return players;
}
