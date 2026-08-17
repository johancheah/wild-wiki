import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/components/Avatar";
import { AgentCell } from "@/components/AgentCell";
import { MapCell } from "@/components/MapCell";
import type { PlayerCareer, MatchPlayerStats } from "@/lib/types";

export const revalidate = 0;

type AgentPool = { agent: string; n: number; wins: number };

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [{ data: careerRows }, { data: agentRows }, { data: matchLog }] = await Promise.all([
    supabase.from("v_player_career").select("*").eq("player_id", id),
    supabase
      .from("v_player_agent_pool")
      .select("*")
      .eq("player_id", id)
      .order("n", { ascending: false }),
    supabase
      .from("v_wild_player_match_stats")
      .select("*")
      .eq("player_id", id)
      .order("date", { ascending: false }),
  ]);

  const player = (careerRows as PlayerCareer[] | null)?.[0];
  if (!player) notFound();

  const agents = (agentRows ?? []) as AgentPool[];
  const log = (matchLog ?? []) as MatchPlayerStats[];

  return (
    <>
      <Link className="back-link" href="/players">
        &larr; All Players
      </Link>
      <h1 className="player-header">
        <Avatar displayName={player.display_name} headshotFilename={player.headshot_filename} size="lg" />
        {player.display_name}
      </h1>

      <div className="stat-row">
        <div className="stat">
          <div className="label">Matches</div>
          <div className="value num">{player.matches_played}</div>
        </div>
        <div className="stat">
          <div className="label">K / D / A</div>
          <div className="value num" style={{ fontSize: 20 }}>
            {player.kills}/{player.deaths}/{player.assists}
          </div>
        </div>
        <div className="stat">
          <div className="label">K/D</div>
          <div className="value num">{player.kd ?? "—"}</div>
        </div>
        <div className="stat">
          <div className="label">ADR</div>
          <div className="value num">{player.adr ?? "—"}</div>
        </div>
        <div className="stat">
          <div className="label">HS%</div>
          <div className="value num">{player.hs_pct ?? "—"}%</div>
        </div>
        <div className="stat">
          <div className="label">ECON</div>
          <div className="value num">{player.econ ?? "—"}</div>
        </div>
      </div>

      <section>
        <h2>Multi-Kills &amp; Clutches (Career)</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="num-col">2K</th>
                <th className="num-col">3K</th>
                <th className="num-col">4K</th>
                <th className="num-col">5K</th>
                <th className="num-col">Clutches</th>
                <th className="num-col">Plants</th>
                <th className="num-col">Defuses</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="num-col num">{player.two_k ?? 0}</td>
                <td className="num-col num">{player.three_k ?? 0}</td>
                <td className="num-col num">{player.four_k ?? 0}</td>
                <td className="num-col num">{player.five_k ?? 0}</td>
                <td className="num-col num">{player.clutches ?? 0}</td>
                <td className="num-col num">{player.plants ?? 0}</td>
                <td className="num-col num">{player.defuses ?? 0}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Agent Pool</h2>
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
              {agents.map((a) => (
                <tr key={a.agent}>
                  <td className="name">
                    <AgentCell agent={a.agent} />
                  </td>
                  <td className="num-col num">{a.n}</td>
                  <td className="num-col num win">{a.wins}</td>
                  <td className="num-col num">{((100 * a.wins) / a.n).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Match Log</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Map</th>
                <th>Result</th>
                <th>Agent</th>
                <th className="num-col">K</th>
                <th className="num-col">D</th>
                <th className="num-col">A</th>
                <th className="num-col">ADR</th>
                <th className="num-col">HS%</th>
                <th className="num-col">Multi-K</th>
                <th className="num-col">Clutch</th>
                <th className="num-col">ECON</th>
              </tr>
            </thead>
            <tbody>
              {log.map((m) => (
                <tr key={m.match_id} className="linkable">
                  <td>
                    <Link href={`/matches/${m.match_id}`}>{m.date.slice(0, 10)}</Link>
                  </td>
                  <td>
                    <MapCell map={m.map} />
                  </td>
                  <td>
                    <span className={`pill ${m.match_result === "WIN" ? "win" : "loss"}`}>
                      {m.match_result}
                    </span>
                  </td>
                  <td>
                    <AgentCell agent={m.agent} />
                  </td>
                  <td className="num-col num">{m.kills}</td>
                  <td className="num-col num">{m.deaths}</td>
                  <td className="num-col num">{m.assists}</td>
                  <td className="num-col num">{m.adr !== null ? m.adr.toFixed(1) : "—"}</td>
                  <td className="num-col num">{m.hs_pct !== null ? m.hs_pct.toFixed(1) : "—"}%</td>
                  <td className="num-col num">
                    {(m.two_k ?? 0) + (m.three_k ?? 0) + (m.four_k ?? 0) + (m.five_k ?? 0)}
                  </td>
                  <td className="num-col num">
                    {(m.clutch_1v1 ?? 0) +
                      (m.clutch_1v2 ?? 0) +
                      (m.clutch_1v3 ?? 0) +
                      (m.clutch_1v4 ?? 0) +
                      (m.clutch_1v5 ?? 0)}
                  </td>
                  <td className="num-col num">{m.econ !== null ? m.econ.toFixed(0) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
