import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchTeamComps, mapCompSummary } from "@/lib/comps";
import { mapSplash } from "@/lib/assets";
import { CompAgentIcon } from "@/components/CompAgentIcon";
import { CompTooltip } from "@/components/CompTooltip";
import { AgentCell } from "@/components/AgentCell";
import { MapSelect } from "@/components/MapSelect";

export const revalidate = 0;

export default async function TeamCompsPage({
  searchParams,
}: {
  searchParams: Promise<{ map?: string }>;
}) {
  const { map } = await searchParams;
  const allComps = await fetchTeamComps(supabase);

  const maps = [...new Set(allComps.map((c) => c.map))].sort();
  const selectedMap = map && maps.includes(map) ? map : maps[0];
  const comps = allComps.filter((c) => c.map === selectedMap);
  const splash = mapSplash(selectedMap);
  const summary = mapCompSummary(comps);

  return (
    <>
      <h1>Team Comps</h1>

      <MapSelect maps={maps} selected={selectedMap} />

      {splash && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="map-splash-banner" src={splash} alt={selectedMap} />
      )}

      <div className="stat-row">
        <div className="stat">
          <div className="label">Record</div>
          <div className="value">
            <span className="win">{summary.wins}</span>
            <span className="of">&ndash;</span>
            <span className="loss">{summary.losses}</span>
          </div>
        </div>
        <div className="stat">
          <div className="label">Win Rate</div>
          <div className="value num">
            {summary.winPct}
            <span className="of">%</span>
          </div>
        </div>
        <div className="stat">
          <div className="label">Maps Played</div>
          <div className="value num">{summary.total}</div>
        </div>
      </div>

      <section>
        <h2>Most Used Agents — {selectedMap}</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th className="num-col">Played</th>
                <th className="num-col">W</th>
                <th className="num-col">Win %</th>
              </tr>
            </thead>
            <tbody>
              {summary.agents.map((a) => (
                <tr key={a.agent}>
                  <td className="name">
                    <AgentCell agent={a.agent} />
                  </td>
                  <td className="num-col num">{a.n}</td>
                  <td className="num-col num win">{a.wins}</td>
                  <td className="num-col num">{a.winPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="subtitle">
        {comps.length} map{comps.length === 1 ? "" : "s"} played on {selectedMap} — the 5-agent composition WILD ran
        each time.
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
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
                <td>
                  <span className={`pill ${c.result === "WIN" ? "win" : "loss"}`}>{c.result}</span>
                </td>
                <td className={`num-col num ${c.margin && c.margin > 0 ? "margin-pos" : "margin-neg"}`}>
                  {c.margin && c.margin > 0 ? `+${c.margin}` : c.margin}
                </td>
                <td>
                  <span className="agent-cell-icon-only agent-cell-multi">
                    {c.agents.map((a, i) => (
                      <CompAgentIcon key={i} a={a} />
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CompTooltip />
    </>
  );
}
