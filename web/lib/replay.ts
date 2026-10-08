import type { SupabaseClient } from "@supabase/supabase-js";
import replayMaps from "./replayMaps.json";

// Direct port of src/wild_tracker/queries.py::match_replay — data for the
// match page's 2D Replay tab: every round's kill / plant / defuse events
// with the positions of all alive players at that instant (round_events —
// API-sourced matches only), plus the map's minimap calibration. The API has
// no continuous movement data, so the replay steps event to event.

export type ReplayCal = {
  file: string;
  xMultiplier: number;
  yMultiplier: number;
  xScalarToAdd: number;
  yScalarToAdd: number;
};

export type ReplayPlayer = {
  name: string;
  team: "wild" | "enemy";
  agent: string | null;
  headshot: string | null;
};

// [player_id, x, y, view_radians]
export type ReplayPosition = [string, number, number, number];

export type ReplayEvent = {
  kind: "kill" | "plant" | "defuse";
  t: number | null;
  actor: string | null;
  target: string | null;
  weapon: string | null;
  site: string | null;
  x: number | null;
  y: number | null;
  players: ReplayPosition[];
};

export type ReplayRound = { label: number; winner: "wild" | "enemy" | null; events: ReplayEvent[] };

export type MatchReplay = {
  map: string;
  cal: ReplayCal;
  players: Record<string, ReplayPlayer>;
  rounds: ReplayRound[];
};

export async function fetchMatchReplay(
  supabase: SupabaseClient,
  matchId: string,
  mapName: string,
  wildTeamId: string | null
): Promise<MatchReplay | null> {
  if (!wildTeamId) return null;
  const cal = (replayMaps as Record<string, ReplayCal>)[mapName];
  if (!cal) return null;

  const [{ data: eventRows }, { data: roundRows }, { data: mpRows }] = await Promise.all([
    supabase
      .from("round_events")
      .select("round_number, event_index, kind, time_in_round_ms, actor_id, target_id, weapon, site, location_x, location_y, snapshot")
      .eq("match_id", matchId)
      .order("round_number")
      .order("event_index")
      .limit(5000),
    supabase.from("rounds").select("round_number, winning_team_id").eq("match_id", matchId),
    supabase.from("match_players").select("player_id, team_id, agent").eq("match_id", matchId),
  ]);
  if (!eventRows || eventRows.length === 0) return null;

  const playerIds = (mpRows ?? []).map((r: { player_id: string }) => r.player_id);
  const { data: playerRows } = await supabase
    .from("players")
    .select("player_id, riot_name, nickname, headshot_filename")
    .in("player_id", playerIds);
  const profile = new Map(
    (playerRows ?? []).map((p: { player_id: string; riot_name: string; nickname: string | null; headshot_filename: string | null }) => [
      p.player_id,
      p,
    ])
  );

  const players: Record<string, ReplayPlayer> = {};
  for (const mp of (mpRows ?? []) as { player_id: string; team_id: string; agent: string | null }[]) {
    const p = profile.get(mp.player_id);
    players[mp.player_id] = {
      name: p ? p.nickname ?? p.riot_name : "?",
      team: mp.team_id === wildTeamId ? "wild" : "enemy",
      agent: mp.agent,
      headshot: p?.headshot_filename ?? null,
    };
  }

  const winners = new Map<number, string | null>(
    (roundRows ?? []).map((r: { round_number: number; winning_team_id: string | null }) => [r.round_number, r.winning_team_id])
  );

  const byRound = new Map<number, ReplayEvent[]>();
  for (const r of eventRows as {
    round_number: number;
    kind: ReplayEvent["kind"];
    time_in_round_ms: number | null;
    actor_id: string | null;
    target_id: string | null;
    weapon: string | null;
    site: string | null;
    location_x: number | null;
    location_y: number | null;
    snapshot: ReplayPosition[] | string | null;
  }[]) {
    const snap = typeof r.snapshot === "string" ? (JSON.parse(r.snapshot) as ReplayPosition[]) : r.snapshot ?? [];
    const arr = byRound.get(r.round_number) ?? [];
    arr.push({
      kind: r.kind,
      t: r.time_in_round_ms,
      actor: r.actor_id,
      target: r.target_id,
      weapon: r.weapon,
      site: r.site,
      x: r.location_x,
      y: r.location_y,
      players: snap,
    });
    byRound.set(r.round_number, arr);
  }

  const rounds: ReplayRound[] = [...byRound.keys()]
    .sort((a, b) => a - b)
    .map((rn) => {
      const w = winners.get(rn) ?? null;
      return { label: rn + 1, winner: w === null ? null : w === wildTeamId ? "wild" : "enemy", events: byRound.get(rn)! };
    });

  return { map: mapName, cal, players, rounds };
}
