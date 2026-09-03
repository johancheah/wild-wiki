import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchMatchWeekByKey, fetchMatchWeekWithNeighbors, fetchCombinedBoxScore } from "@/lib/schedule";
import { fetchMatchFullDetail } from "@/lib/matchDetail";
import { mergeWeaponMatrices } from "@/lib/weapons";
import { formatMatchDate } from "@/lib/schedule";
import { aggregateWeekTeamStats } from "@/lib/teamSummary";
import { aggregateWeekEconomy } from "@/lib/economy";
import { MatchTabs, type MatchTabsEconomyEntry } from "@/components/MatchTabs";
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

  const result = await fetchMatchWeekWithNeighbors(supabase, season, date);
  if (!result) notFound();
  const { week, prevWeek, nextWeek } = result;

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

  const weekTeamStats = aggregateWeekTeamStats(mapDetails.map((d) => d?.teamSummary).filter((t) => t != null));
  const combinedEconomy = aggregateWeekEconomy(mapDetails.map((d) => d?.economy).filter((e) => e != null));

  const navLabel = week.season_id ? `${week.season_id} · ${week.label}` : week.label;

  return (
    <>
      <NavLabelSync label={navLabel} />
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
        {formatMatchDate(week.local_date)} &middot; {week.match_type}
      </div>

      <div className="week-nav">
        {prevWeek ? (
          <Link className="week-nav-link" href={`/schedule/${encodeURIComponent(prevWeek.season_id ?? "")}/${prevWeek.local_date}`}>
            &larr; {prevWeek.season_id} &middot; {prevWeek.label}
          </Link>
        ) : (
          <span className="week-nav-link disabled">&larr;</span>
        )}
        {nextWeek ? (
          <Link className="week-nav-link" href={`/schedule/${encodeURIComponent(nextWeek.season_id ?? "")}/${nextWeek.local_date}`}>
            {nextWeek.season_id} &middot; {nextWeek.label} &rarr;
          </Link>
        ) : (
          <span className="week-nav-link disabled">&rarr;</span>
        )}
      </div>

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
                weekTeamStats={weekTeamStats}
                combinedEconomy={combinedEconomy}
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
                  teamSummary={d.teamSummary}
                  map={m.map}
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
