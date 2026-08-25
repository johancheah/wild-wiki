import type { SupabaseClient } from "@supabase/supabase-js";

// Direct port of src/wild_tracker/queries.py::team_comps — one row per map
// played, with the 5-agent composition WILD ran that map, grouped by role
// (Controller/Initiator/Sentinel/Duelist) with a hover preview of the
// player who played each agent that map.

const ROLE_ORDER: Record<string, number> = { Controller: 0, Initiator: 1, Sentinel: 2, Duelist: 3 };

export type CompAgent = {
  agent: string;
  role: string | null;
  player_id: string;
  headshot_filename: string | null;
  display_name: string;
  gap_before: boolean;
};

export type TeamComp = {
  match_id: string;
  date: string;
  season_id: string | null;
  match_type: string | null;
  map: string;
  result: string | null;
  margin: number | null;
  source: string;
  opponent: string | null;
  agents: CompAgent[];
};

type BoxScoreAgentRow = {
  match_id: string;
  team_id: string;
  agent: string;
  role: string | null;
  player_id: string;
  headshot_filename: string | null;
  display_name: string;
};

export async function fetchTeamComps(supabase: SupabaseClient): Promise<TeamComp[]> {
  const [{ data: matches }, { data: teams }, { data: players }] = await Promise.all([
    supabase.from("matches").select("match_id, date, season_id, match_type, map, result, margin, source, team_id, enemy_team_id"),
    supabase.from("teams").select("team_id, name"),
    supabase
      .from("v_match_box_score")
      .select("match_id, team_id, agent, role, player_id, headshot_filename, display_name")
      .not("agent", "is", null)
      .returns<BoxScoreAgentRow[]>(),
  ]);

  const teamName = new Map<string, string>();
  for (const t of teams ?? []) teamName.set(t.team_id, t.name);

  const rowsByMatch = new Map<string, BoxScoreAgentRow[]>();
  for (const p of players ?? []) {
    if (!rowsByMatch.has(p.match_id)) rowsByMatch.set(p.match_id, []);
    rowsByMatch.get(p.match_id)!.push(p);
  }

  const comps: TeamComp[] = [];
  for (const m of matches ?? []) {
    const rows = rowsByMatch.get(m.match_id) ?? [];
    const wildRows = rows.filter((r) => r.team_id === m.team_id);
    if (wildRows.length !== 5) continue;

    wildRows.sort((a, b) => {
      const roleDiff = (ROLE_ORDER[a.role ?? ""] ?? 99) - (ROLE_ORDER[b.role ?? ""] ?? 99);
      return roleDiff !== 0 ? roleDiff : (a.agent ?? "").localeCompare(b.agent ?? "");
    });

    const agents: CompAgent[] = wildRows.map((r, i) => ({
      agent: r.agent,
      role: r.role,
      player_id: r.player_id,
      headshot_filename: r.headshot_filename,
      display_name: r.display_name,
      gap_before: i > 0 && r.role !== wildRows[i - 1].role,
    }));

    comps.push({
      match_id: m.match_id,
      date: m.date,
      season_id: m.season_id,
      match_type: m.match_type,
      map: m.map,
      result: m.result,
      margin: m.margin,
      source: m.source,
      opponent: m.enemy_team_id ? teamName.get(m.enemy_team_id) ?? null : null,
      agents,
    });
  }

  comps.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return comps;
}

export type MapCompSummary = {
  wins: number;
  losses: number;
  total: number;
  winPct: number;
  agents: { agent: string; n: number; wins: number; winPct: number }[];
};

// Direct port of src/wild_tracker/queries.py::map_comp_summary.
export function mapCompSummary(comps: TeamComp[]): MapCompSummary {
  const wins = comps.filter((c) => c.result === "WIN").length;
  const losses = comps.filter((c) => c.result === "LOSS").length;
  const total = comps.length;
  const winPct = total ? Math.round((100 * wins) / total * 10) / 10 : 0;

  const agentStats = new Map<string, { n: number; wins: number }>();
  for (const c of comps) {
    for (const a of c.agents) {
      const stats = agentStats.get(a.agent) ?? { n: 0, wins: 0 };
      stats.n += 1;
      if (c.result === "WIN") stats.wins += 1;
      agentStats.set(a.agent, stats);
    }
  }

  const agents = [...agentStats.entries()]
    .map(([agent, s]) => ({ agent, n: s.n, wins: s.wins, winPct: s.n ? Math.round((100 * s.wins) / s.n) : 0 }))
    .sort((a, b) => b.n - a.n);

  return { wins, losses, total, winPct, agents };
}
