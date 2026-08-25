import type { SupabaseClient } from "@supabase/supabase-js";

// Direct port of src/wild_tracker/queries.py::team_comps — one row per map
// played, with the 5-agent composition WILD ran that map.

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
  agents: string[];
};

export async function fetchTeamComps(supabase: SupabaseClient): Promise<TeamComp[]> {
  const [{ data: matches }, { data: teams }, { data: players }] = await Promise.all([
    supabase.from("matches").select("match_id, date, season_id, match_type, map, result, margin, source, team_id, enemy_team_id"),
    supabase.from("teams").select("team_id, name"),
    supabase.from("match_players").select("match_id, team_id, agent").not("agent", "is", null),
  ]);

  const teamName = new Map<string, string>();
  for (const t of teams ?? []) teamName.set(t.team_id, t.name);

  const agentsByMatch = new Map<string, { team_id: string; agent: string }[]>();
  for (const p of players ?? []) {
    if (!agentsByMatch.has(p.match_id)) agentsByMatch.set(p.match_id, []);
    agentsByMatch.get(p.match_id)!.push({ team_id: p.team_id, agent: p.agent });
  }

  const comps: TeamComp[] = [];
  for (const m of matches ?? []) {
    const rows = agentsByMatch.get(m.match_id) ?? [];
    const agents = rows.filter((r) => r.team_id === m.team_id).map((r) => r.agent);
    if (agents.length !== 5) continue;
    agents.sort();
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
