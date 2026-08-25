import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchMatchWeekByKey, fetchCombinedBoxScore, fetchCombinedWeaponKills } from "@/lib/schedule";
import { computeMatchEconomy } from "@/lib/economy";
import { BoxScoreTable } from "@/components/BoxScoreTable";
import { PerformanceTable } from "@/components/PerformanceTable";
import { WeaponKillsTable } from "@/components/WeaponKillsTable";
import { EconomySection } from "@/components/EconomySection";
import { MapCell } from "@/components/MapCell";
import { Tabs } from "@/components/Tabs";
import type { MatchEconomy } from "@/lib/economy";

export const revalidate = 0;

export default async function MatchWeekDetailPage({
  params,
}: {
  params: Promise<{ season: string; date: string }>;
}) {
  const { season, date } = await params;

  const week = await fetchMatchWeekByKey(supabase, season, date);
  if (!week) notFound();

  const matchIds = week.maps.map((m) => m.match_id);

  const [combinedBoxScore, weaponKills] = await Promise.all([
    fetchCombinedBoxScore(supabase, matchIds),
    fetchCombinedWeaponKills(supabase, matchIds),
  ]);

  const economies: { map: string; opponent: string | null; economy: MatchEconomy }[] = [];
  for (const m of week.maps) {
    const { data: matchRow } = await supabase
      .from("matches")
      .select("team_id, enemy_team_id")
      .eq("match_id", m.match_id)
      .single();
    if (!matchRow?.team_id) continue;
    const economy = await computeMatchEconomy(supabase, m.match_id, matchRow.team_id, matchRow.enemy_team_id);
    if (economy) economies.push({ map: m.map, opponent: m.opponent, economy });
  }

  return (
    <>
      <Link className="back-link" href="/schedule">
        &larr; Schedule
      </Link>
      <h1>
        {week.season_id} &middot; {week.label}{" "}
        <span
          className={`pill ${week.wins > week.losses ? "win" : week.losses > week.wins ? "loss" : ""}`}
          style={{ verticalAlign: "middle" }}
        >
          {week.record}
        </span>
      </h1>
      <div className="subtitle">
        {week.local_date} &middot; {week.match_type}
      </div>

      <section>
        <h2>Maps This Week</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Map</th>
                <th>Opponent</th>
                <th>Result</th>
                <th className="num-col">Margin</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {week.maps.map((m) => (
                <tr key={m.match_id} className="linkable">
                  <td className="name">
                    <Link href={`/matches/${m.match_id}`}>
                      <MapCell map={m.map} />
                    </Link>
                  </td>
                  <td>{m.opponent ?? "—"}</td>
                  <td>
                    <span className={`pill ${m.result === "WIN" ? "win" : "loss"}`}>{m.result}</span>
                  </td>
                  <td className={`num-col num ${m.margin && m.margin > 0 ? "margin-pos" : "margin-neg"}`}>
                    {m.margin && m.margin > 0 ? `+${m.margin}` : m.margin}
                  </td>
                  <td>
                    <span className={`pill ${m.source === "api" ? "src-api" : "src-sheet"}`}>
                      {m.source === "api" ? "API" : "Sheet"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Tabs
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <section>
                <h2>Combined Box Score — WILD</h2>
                <div className="subtitle" style={{ marginTop: -8 }}>
                  Stats summed/averaged across all {week.maps.length} map{week.maps.length !== 1 ? "s" : ""} this week
                  (ADR/HS%/ACS/KAST weighted by rounds played, not simple per-map averages).
                </div>
                <BoxScoreTable rows={combinedBoxScore} clickable multiAgent />
              </section>
            ),
          },
          {
            id: "performance",
            label: "Performance",
            content: (
              <>
                <section>
                  <h2>Multi-Kills, Clutches &amp; Utility — Combined</h2>
                  <PerformanceTable rows={combinedBoxScore} clickable />
                </section>
                {weaponKills.length > 0 && (
                  <section>
                    <h2>Weapon Kills — Combined</h2>
                    <WeaponKillsTable rows={weaponKills} />
                  </section>
                )}
              </>
            ),
          },
          ...(economies.length > 0
            ? [
                {
                  id: "economy",
                  label: "Economy",
                  content: (
                    <>
                      {economies.map((e) => (
                        <section key={e.map + (e.opponent ?? "")}>
                          <h2>
                            {e.map} vs {e.opponent ?? "Opponent"}
                          </h2>
                          <EconomySection economy={e.economy} opponentName={e.opponent} />
                        </section>
                      ))}
                    </>
                  ),
                },
              ]
            : []),
        ]}
      />
    </>
  );
}
