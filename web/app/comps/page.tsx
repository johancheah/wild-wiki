import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchTeamComps } from "@/lib/comps";
import { mapSplash } from "@/lib/assets";
import { CompAgentIcon } from "@/components/CompAgentIcon";
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

  return (
    <>
      <h1>Team Comps</h1>

      <MapSelect maps={maps} selected={selectedMap} />

      {splash && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="map-splash-banner" src={splash} alt={selectedMap} />
      )}

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
    </>
  );
}
