import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchTeamComps } from "@/lib/comps";
import { MapCell } from "@/components/MapCell";
import { AgentCellIconOnly } from "@/components/AgentCellIconOnly";

export const revalidate = 0;

export default async function TeamCompsPage() {
  const comps = await fetchTeamComps(supabase);

  return (
    <>
      <h1>Team Comps</h1>
      <div className="subtitle">{comps.length} maps — the 5-agent composition WILD ran, one row per map.</div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Season</th>
              <th>Type</th>
              <th>Map</th>
              <th>Opponent</th>
              <th>Result</th>
              <th className="num-col">Margin</th>
              <th>Composition</th>
            </tr>
          </thead>
          <tbody>
            {comps.map((c) => (
              <tr key={c.match_id} className="linkable">
                <td>
                  <Link href={`/matches/${c.match_id}`}>{c.date.slice(0, 10)}</Link>
                </td>
                <td className="num">{c.season_id ?? "—"}</td>
                <td className="type-tag">{c.match_type ?? "—"}</td>
                <td>
                  <MapCell map={c.map} />
                </td>
                <td>{c.opponent ?? "—"}</td>
                <td>
                  <span className={`pill ${c.result === "WIN" ? "win" : "loss"}`}>{c.result}</span>
                </td>
                <td className={`num-col num ${c.margin && c.margin > 0 ? "margin-pos" : "margin-neg"}`}>
                  {c.margin && c.margin > 0 ? `+${c.margin}` : c.margin}
                </td>
                <td>
                  <span className="agent-cell-icon-only agent-cell-multi">
                    {c.agents.map((a, i) => (
                      <AgentCellIconOnly key={i} agent={a} />
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
