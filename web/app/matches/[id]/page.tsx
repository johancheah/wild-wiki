import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BoxScoreTable } from "@/components/BoxScoreTable";
import { mapSplash } from "@/lib/assets";
import type { BoxScoreRow, MatchRow, WeaponKillRow } from "@/lib/types";

export const revalidate = 0;

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [{ data: matchRows }, { data: boxScoreRows }, { data: weaponRows }] = await Promise.all([
    supabase.from("v_match_row").select("*").eq("match_id", id),
    supabase.from("v_match_box_score").select("*").eq("match_id", id),
    supabase.from("v_match_weapon_kills").select("*").eq("match_id", id).order("kill_count", { ascending: false }),
  ]);

  const match = (matchRows as MatchRow[] | null)?.[0];
  if (!match) notFound();

  const boxScore = (boxScoreRows ?? []) as BoxScoreRow[];
  const weaponKills = (weaponRows ?? []) as WeaponKillRow[];

  const wildRows = boxScore.filter((r) => r.is_wild_player).sort((a, b) => (b.acs ?? 0) - (a.acs ?? 0));
  const enemyRows = boxScore.filter((r) => !r.is_wild_player).sort((a, b) => (b.acs ?? 0) - (a.acs ?? 0));

  const splash = mapSplash(match.map);

  return (
    <>
      <Link className="back-link" href="/matches">
        &larr; All Matches
      </Link>
      {splash && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="map-splash-banner" src={splash} alt={match.map} />
      )}
      <h1>
        {match.map}{" "}
        <span
          className={`pill ${match.result === "WIN" ? "win" : "loss"}`}
          style={{ verticalAlign: "middle" }}
        >
          {match.result}
        </span>
      </h1>
      <div className="subtitle">
        {match.date.slice(0, 10)} &middot; {match.season_id ?? "—"} &middot;{" "}
        {match.match_type ?? "—"}
        {match.opponent_name && (
          <>
            {" "}
            &middot; vs {match.opponent_name} ({match.opponent_tag})
          </>
        )}{" "}
        &middot; margin {match.margin && match.margin > 0 ? `+${match.margin}` : match.margin}{" "}
        &middot;{" "}
        <span className={`pill ${match.source === "api" ? "src-api" : "src-sheet"}`}>
          {match.source === "api" ? "API-sourced" : "Spreadsheet-sourced"}
        </span>
        {match.source === "api" && (
          <>
            {" "}
            &middot;{" "}
            <span style={{ color: "var(--text-faint)" }}>
              KAST unavailable from the API — see PLAN.md §5
            </span>
          </>
        )}
      </div>

      <section>
        <h2>WILD Box Score</h2>
        <BoxScoreTable rows={wildRows} clickable />
      </section>

      {enemyRows.length > 0 ? (
        <section>
          <h2>Opponent Box Score</h2>
          <BoxScoreTable rows={enemyRows} clickable={false} />
        </section>
      ) : (
        <div className="empty-note">
          This match was imported from the legacy spreadsheet, which never recorded opponent
          identity or individual opponent stats — only the final score (see PLAN.md §5.5).
        </div>
      )}

      <section>
        <h2>Advanced Stats — WILD</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th className="num-col">2K</th>
                <th className="num-col">3K</th>
                <th className="num-col">4K</th>
                <th className="num-col">5K</th>
                <th className="num-col">Clutch</th>
                <th className="num-col">PL</th>
                <th className="num-col">DE</th>
                <th className="num-col">ECON</th>
              </tr>
            </thead>
            <tbody>
              {wildRows.map((r) => (
                <tr key={r.player_id} className="linkable">
                  <td className="name">
                    <Link href={`/players/${r.player_id}`}>{r.display_name}</Link>
                  </td>
                  <td className="num-col num">{r.two_k ?? 0}</td>
                  <td className="num-col num">{r.three_k ?? 0}</td>
                  <td className="num-col num">{r.four_k ?? 0}</td>
                  <td className="num-col num">{r.five_k ?? 0}</td>
                  <td className="num-col num">
                    {(r.clutch_1v1 ?? 0) +
                      (r.clutch_1v2 ?? 0) +
                      (r.clutch_1v3 ?? 0) +
                      (r.clutch_1v4 ?? 0) +
                      (r.clutch_1v5 ?? 0)}
                  </td>
                  <td className="num-col num">{r.plants ?? 0}</td>
                  <td className="num-col num">{r.defuses ?? 0}</td>
                  <td className="num-col num">{r.econ !== null ? r.econ.toFixed(0) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {weaponKills.length > 0 && (
        <section>
          <h2>Weapon Kills</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Weapon</th>
                  <th className="num-col">Kills</th>
                </tr>
              </thead>
              <tbody>
                {weaponKills.map((w, i) => (
                  <tr key={`${w.player_id}-${w.weapon}-${i}`}>
                    <td className="name">{w.display_name}</td>
                    <td>{w.weapon}</td>
                    <td className="num-col num">{w.kill_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
