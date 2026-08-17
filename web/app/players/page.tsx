import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/components/Avatar";
import type { PlayerCareer } from "@/lib/types";

export const revalidate = 0;

export default async function PlayersPage() {
  const { data } = await supabase
    .from("v_player_career")
    .select("*")
    .order("kills", { ascending: false });
  const players = (data ?? []) as PlayerCareer[];

  return (
    <>
      <h1>Player Stats</h1>
      <div className="subtitle">
        Career totals across all {players.length} tracked roster members. Click a player for
        match log + agent pool.
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th className="num-col">MP</th>
              <th className="num-col">Kills</th>
              <th className="num-col">Deaths</th>
              <th className="num-col">Assists</th>
              <th className="num-col">K/D</th>
              <th className="num-col">ADR</th>
              <th className="num-col">HS%</th>
              <th className="num-col">Multi-K</th>
              <th className="num-col">Clutches</th>
              <th className="num-col">ECON</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.player_id} className="linkable">
                <td className="name">
                  <Link href={`/players/${p.player_id}`}>
                    <Avatar displayName={p.display_name} headshotFilename={p.headshot_filename} />
                    {p.display_name}
                  </Link>
                </td>
                <td className="num-col num">{p.matches_played}</td>
                <td className="num-col num">{p.kills}</td>
                <td className="num-col num">{p.deaths}</td>
                <td className="num-col num">{p.assists}</td>
                <td className="num-col num">{p.kd ?? "—"}</td>
                <td className="num-col num">{p.adr ?? "—"}</td>
                <td className="num-col num">{p.hs_pct ?? "—"}%</td>
                <td className="num-col num">
                  {(p.two_k ?? 0) + (p.three_k ?? 0) + (p.four_k ?? 0) + (p.five_k ?? 0)}
                </td>
                <td className="num-col num">{p.clutches ?? 0}</td>
                <td className="num-col num">{p.econ ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
