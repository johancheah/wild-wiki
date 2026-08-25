import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BoxScoreTable } from "@/components/BoxScoreTable";
import { PerformanceTable } from "@/components/PerformanceTable";
import { WeaponKillsTable } from "@/components/WeaponKillsTable";
import { RoundTimeline } from "@/components/RoundTimeline";
import { EconomySection } from "@/components/EconomySection";
import { Tabs } from "@/components/Tabs";
import { mapSplash } from "@/lib/assets";
import { computeMatchTimeline } from "@/lib/timeline";
import { computeMatchEconomy } from "@/lib/economy";
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

  const timeline =
    match.team_id && match.enemy_team_id
      ? await computeMatchTimeline(supabase, id, match.team_id, match.enemy_team_id)
      : [];
  const economy = match.team_id && match.enemy_team_id
    ? await computeMatchEconomy(supabase, id, match.team_id, match.enemy_team_id)
    : null;

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
        <span className={`pill ${match.result === "WIN" ? "win" : "loss"}`} style={{ verticalAlign: "middle" }}>
          {match.result}
        </span>
      </h1>
      <div className="subtitle">
        {match.date.slice(0, 10)} &middot; {match.season_id ?? "—"} &middot; {match.match_type ?? "—"}
        {match.opponent_name && (
          <>
            {" "}
            &middot; vs {match.opponent_name} ({match.opponent_tag})
          </>
        )}{" "}
        &middot; margin {match.margin && match.margin > 0 ? `+${match.margin}` : match.margin} &middot;{" "}
        <span className={`pill ${match.source === "api" ? "src-api" : "src-sheet"}`}>
          {match.source === "api" ? "API-sourced" : "Spreadsheet-sourced"}
        </span>
      </div>

      <RoundTimeline timeline={timeline} opponentName={match.opponent_name} />

      <Tabs
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <>
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
                    This match was imported from the legacy spreadsheet, which never recorded opponent identity or
                    individual opponent stats — only the final score (see PLAN.md §5.5).
                  </div>
                )}
              </>
            ),
          },
          {
            id: "performance",
            label: "Performance",
            content: (
              <>
                <section>
                  <h2>Multi-Kills, Clutches &amp; Utility — WILD</h2>
                  <PerformanceTable rows={wildRows} clickable />
                </section>
                {weaponKills.length > 0 && (
                  <section>
                    <h2>Weapon Kills</h2>
                    <WeaponKillsTable rows={weaponKills} />
                  </section>
                )}
              </>
            ),
          },
          ...(economy
            ? [
                {
                  id: "economy",
                  label: "Economy",
                  content: (
                    <section>
                      <EconomySection economy={economy} opponentName={match.opponent_name} />
                    </section>
                  ),
                },
              ]
            : []),
        ]}
      />
    </>
  );
}
