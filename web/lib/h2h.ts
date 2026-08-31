import type { SupabaseClient } from "@supabase/supabase-js";

// Direct port of src/wild_tracker/queries.py::h2h_matrix — head-to-head
// kill/death grid for the Performance tab: one row per WILD player, one
// column per opponent player, with three toggleable variants computed from
// the same kill_events pull (all kills / first-kill-of-round / Operator
// kills). API-sourced matches only — spreadsheet imports have no
// kill_events, so this returns null for those.

export type H2hCell = { k: number; d: number; diff: number };
export type H2hRow = { player_id: string; display_name: string; headshot_filename: string | null; cells: H2hCell[] };
export type H2hEnemyPlayer = { player_id: string; display_name: string; headshot_filename: string | null };

export type H2hMatrix = {
  enemy_players: H2hEnemyPlayer[];
  variants: { all: H2hRow[]; first: H2hRow[]; op: H2hRow[] };
};

type KillEvent = { round_number: number; event_index: number; killer_id: string | null; victim_id: string | null; weapon: string | null };

export async function fetchH2hMatrix(
  supabase: SupabaseClient,
  matchId: string,
  wildTeamId: string,
  enemyTeamId: string | null
): Promise<H2hMatrix | null> {
  if (!enemyTeamId) return null;

  const [{ data: matchPlayers }, { data: players }, { data: killsData }] = await Promise.all([
    supabase.from("match_players").select("player_id, team_id").eq("match_id", matchId),
    supabase.from("players").select("player_id, riot_name, nickname, headshot_filename"),
    supabase
      .from("kill_events")
      .select("round_number, event_index, killer_id, victim_id, weapon")
      .eq("match_id", matchId)
      .order("round_number", { ascending: true })
      .order("event_index", { ascending: true }),
  ]);

  const playerInfo = new Map<string, { display_name: string; headshot_filename: string | null }>();
  for (const p of players ?? []) {
    playerInfo.set(p.player_id, { display_name: p.nickname ?? p.riot_name, headshot_filename: p.headshot_filename });
  }

  const wildIds = new Set((matchPlayers ?? []).filter((mp) => mp.team_id === wildTeamId).map((mp) => mp.player_id));
  const enemyIds = new Set((matchPlayers ?? []).filter((mp) => mp.team_id === enemyTeamId).map((mp) => mp.player_id));
  if (wildIds.size === 0 || enemyIds.size === 0) return null;

  const kills = (killsData ?? []) as KillEvent[];
  if (kills.length === 0) return null;

  const firstKillKeys = new Set<string>();
  const seenRounds = new Set<number>();
  for (const k of kills) {
    if (!seenRounds.has(k.round_number)) {
      seenRounds.add(k.round_number);
      firstKillKeys.add(`${k.round_number}:${k.event_index}`);
    }
  }

  type Cells = Map<string, Map<string, { k: number; d: number }>>;
  function build(filterFn: (k: KillEvent) => boolean): { cells: Cells; totals: Map<string, number> } {
    const cells: Cells = new Map();
    for (const w of wildIds) {
      const row = new Map<string, { k: number; d: number }>();
      for (const e of enemyIds) row.set(e, { k: 0, d: 0 });
      cells.set(w, row);
    }
    const totals = new Map<string, number>();
    for (const k of kills) {
      if (!filterFn(k)) continue;
      const { killer_id: killer, victim_id: victim } = k;
      if (!killer || !victim) continue;
      if (wildIds.has(killer) && enemyIds.has(victim)) {
        cells.get(killer)!.get(victim)!.k += 1;
        totals.set(killer, (totals.get(killer) ?? 0) + 1);
      } else if (enemyIds.has(killer) && wildIds.has(victim)) {
        cells.get(victim)!.get(killer)!.d += 1;
      }
    }
    return { cells, totals };
  }

  const { cells: allCells, totals: allTotals } = build(() => true);
  const { cells: firstCells } = build((k) => firstKillKeys.has(`${k.round_number}:${k.event_index}`));
  const { cells: opCells } = build((k) => k.weapon === "Operator");

  const wildOrder = [...wildIds].sort((a, b) => (allTotals.get(b) ?? 0) - (allTotals.get(a) ?? 0));
  const enemyTotals = new Map<string, number>();
  for (const row of allCells.values()) {
    for (const [eid, c] of row) enemyTotals.set(eid, (enemyTotals.get(eid) ?? 0) + c.k);
  }
  const enemyOrder = [...enemyIds].sort((a, b) => (enemyTotals.get(b) ?? 0) - (enemyTotals.get(a) ?? 0));

  function rowsFor(cells: Cells): H2hRow[] {
    return wildOrder.map((wid) => {
      const info = playerInfo.get(wid);
      const rowCells: H2hCell[] = enemyOrder.map((eid) => {
        const c = cells.get(wid)!.get(eid)!;
        return { k: c.k, d: c.d, diff: c.k - c.d };
      });
      return {
        player_id: wid,
        display_name: info?.display_name ?? "?",
        headshot_filename: info?.headshot_filename ?? null,
        cells: rowCells,
      };
    });
  }

  const enemyPlayers: H2hEnemyPlayer[] = enemyOrder.map((eid) => {
    const info = playerInfo.get(eid);
    return { player_id: eid, display_name: info?.display_name ?? "?", headshot_filename: info?.headshot_filename ?? null };
  });

  return {
    enemy_players: enemyPlayers,
    variants: { all: rowsFor(allCells), first: rowsFor(firstCells), op: rowsFor(opCells) },
  };
}
