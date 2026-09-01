import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/components/Avatar";
import { AgentCell } from "@/components/AgentCell";
import { RoleCell } from "@/components/RoleCell";
import { StatChip } from "@/components/StatChip";
import { MatchLogTable } from "@/components/MatchLogTable";
import { PlayerHeaderSync } from "@/components/PlayerHeaderSync";
import type { PlayerCareer, MatchPlayerStats } from "@/lib/types";
import type { NavPlayer } from "@/lib/PlayerHeaderContext";

export const revalidate = 0;

type AgentPool = { agent: string; n: number; wins: number; kd: number | null; acs: number | null; adr: number | null; hs_pct: number | null };
type RoleBreakdown = { role: string; n: number; wins: number; kd: number | null; acs: number | null; adr: number | null };

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [{ data: careerRows }, { data: agentRows }, { data: roleRows }, { data: matchLog }, { data: rosterRows }] =
    await Promise.all([
      supabase.from("v_player_career").select("*").eq("player_id", id),
      supabase
        .from("v_player_agent_pool")
        .select("*")
        .eq("player_id", id)
        .order("n", { ascending: false }),
      supabase
        .from("v_player_role_breakdown")
        .select("*")
        .eq("player_id", id)
        .order("n", { ascending: false }),
      supabase
        .from("v_wild_player_match_stats")
        .select("*")
        .eq("player_id", id)
        .order("date", { ascending: false }),
      supabase.from("v_player_career").select("player_id, display_name, headshot_filename"),
    ]);

  const player = (careerRows as PlayerCareer[] | null)?.[0];
  if (!player) notFound();

  const agents = (agentRows ?? []) as AgentPool[];
  const roles = (roleRows ?? []) as RoleBreakdown[];
  const totalWithRole = roles.reduce((s, r) => s + r.n, 0);
  const log = (matchLog ?? []) as MatchPlayerStats[];
  const roster = ((rosterRows ?? []) as NavPlayer[]).sort((a, b) =>
    a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" })
  );
  const navPlayer: NavPlayer = {
    player_id: player.player_id,
    display_name: player.display_name,
    headshot_filename: player.headshot_filename,
  };

  return (
    <>
      <PlayerHeaderSync player={navPlayer} roster={roster} />
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
          <div className="label">ACS</div>
          <div className="value num">{player.acs !== null ? Math.round(player.acs) : "—"}</div>
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
          <table className="performance-table">
            <thead>
              <tr>
                <th className="num-col">2K</th>
                <th className="num-col">3K</th>
                <th className="num-col">4K</th>
                <th className="num-col">5K</th>
                <th className="num-col">1v1</th>
                <th className="num-col">1v2</th>
                <th className="num-col">1v3</th>
                <th className="num-col">1v4</th>
                <th className="num-col">1v5</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="num-col">
                  <StatChip value={player.two_k} blankZero square level={1} />
                </td>
                <td className="num-col">
                  <StatChip value={player.three_k} blankZero square level={2} />
                </td>
                <td className="num-col">
                  <StatChip value={player.four_k} blankZero square level={3} />
                </td>
                <td className="num-col">
                  <StatChip value={player.five_k} blankZero square level={4} />
                </td>
                <td className="num-col">
                  <StatChip value={player.clutch_1v1} blankZero square level={1} />
                </td>
                <td className="num-col">
                  <StatChip value={player.clutch_1v2} blankZero square level={2} />
                </td>
                <td className="num-col">
                  <StatChip value={player.clutch_1v3} blankZero square level={3} />
                </td>
                <td className="num-col">
                  <StatChip value={player.clutch_1v4} blankZero square level={4} />
                </td>
                <td className="num-col">
                  <StatChip value={player.clutch_1v5} blankZero square level={5} />
                </td>
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
                <th className="num-col">ACS</th>
                <th className="num-col">ADR</th>
                <th className="num-col">HS%</th>
                <th className="num-col">K/D</th>
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
                  <td className="num-col num">{a.acs ?? "—"}</td>
                  <td className="num-col num">{a.adr ?? "—"}</td>
                  <td className="num-col num">{a.hs_pct !== null ? `${a.hs_pct}%` : "—"}</td>
                  <td className="num-col num">{a.kd ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Role Breakdown</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th className="num-col">Maps</th>
                <th className="num-col">% of Maps</th>
                <th className="num-col">Win %</th>
                <th className="num-col">K/D</th>
                <th className="num-col">ACS</th>
                <th className="num-col">ADR</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.role}>
                  <td className="name">
                    <RoleCell role={r.role} />
                  </td>
                  <td className="num-col num">{r.n}</td>
                  <td className="num-col num">{totalWithRole ? ((100 * r.n) / totalWithRole).toFixed(1) : "0.0"}%</td>
                  <td className="num-col num">{((100 * r.wins) / r.n).toFixed(0)}%</td>
                  <td className="num-col num">{r.kd ?? "—"}</td>
                  <td className="num-col num">{r.acs ?? "—"}</td>
                  <td className="num-col num">{r.adr ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Match Log</h2>
        <MatchLogTable log={log} />
      </section>
    </>
  );
}
