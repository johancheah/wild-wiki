import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchMatchWeekByKey, fetchCombinedBoxScore } from "@/lib/schedule";
import { fetchMatchFullDetail } from "@/lib/matchDetail";
import { mergeWeaponMatrices } from "@/lib/weapons";
import { mapSplash } from "@/lib/assets";
import { MatchTabs, type MatchTabsEconomyEntry } from "@/components/MatchTabs";
import { MapCell } from "@/components/MapCell";
import { Tabs } from "@/components/Tabs";
import { NavLabelSync } from "@/components/NavLabelSync";

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string; date: string }>;
}): Promise<Metadata> {
  const { season, date } = await params;
  const week = await fetchMatchWeekByKey(supabase, season, date);
  if (!week) return { title: "Match Week — WILD Gaming" };

  const mapNames = [...new Set(week.maps.map((m) => m.map))].join(" & ");
  const title = `${week.label} (${week.record}) — WILD Gaming`;
  const description = [week.season_id, mapNames, week.maps[0]?.opponent ? `vs ${week.maps[0].opponent}` : null]
    .filter(Boolean)
    .join(" · ");

  return { title, description };
}

export default async function MatchWeekDetailPage({
  params,
}: {
  params: Promise<{ season: string; date: string }>;
}) {
  const { season, date } = await params;

  const week = await fetchMatchWeekByKey(supabase, season, date);
  if (!week) notFound();

  const matchIds = week.maps.map((m) => m.match_id);

  const [combinedBoxScore, mapDetails] = await Promise.all([
    fetchCombinedBoxScore(supabase, matchIds),
    Promise.all(week.maps.map((m) => fetchMatchFullDetail(supabase, m.match_id))),
  ]);

  const combinedWeapons = mergeWeaponMatrices(mapDetails.map((d) => d?.weapons ?? null));

  const economies: MatchTabsEconomyEntry[] = [];
  week.maps.forEach((m, i) => {
    const d = mapDetails[i];
    if (d?.economy) economies.push({ map: m.map, opponent: m.opponent, economy: d.economy });
  });

  const navLabel = week.season_id ? `${week.season_id} · ${week.label}` : week.label;
  const splash = week.maps.length > 0 ? mapSplash(week.maps[0].map) : null;

  return (
    <>
      <NavLabelSync label={navLabel} />
      <Link className="back-link" href="/schedule">
        &larr; Schedule
      </Link>
      {splash && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="map-splash-banner" src={splash} alt={week.maps[0].map} />
      )}
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
            id: "overall",
            label: "Overall",
            content: (
              <MatchTabs
                wildRows={combinedBoxScore}
                weapons={combinedWeapons}
                economies={economies}
                boxTitle="Combined Box Score — WILD"
                multiAgent
              />
            ),
          },
          ...week.maps.map((m, i) => {
            const d = mapDetails[i];
            return {
              id: `map${i + 1}`,
              label: `Map ${i + 1}`,
              content: d ? (
                <MatchTabs
                  wildRows={d.wildRows}
                  enemyRows={d.enemyRows}
                  weapons={d.weapons}
                  economies={d.economy ? [{ map: m.map, opponent: m.opponent, economy: d.economy }] : null}
                  timeline={d.timeline}
                  opponentName={m.opponent}
                  h2h={d.h2h}
                  eventRounds={d.eventRounds}
                />
              ) : (
                <div className="empty-note">This map&apos;s data could not be loaded.</div>
              ),
            };
          }),
        ]}
      />
    </>
  );
}
