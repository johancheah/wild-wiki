import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchUpcomingMatch, fetchLatestWeek } from "@/lib/home";
import { mapSplash } from "@/lib/assets";
import { MapCell } from "@/components/MapCell";
import { BoxScoreTable } from "@/components/BoxScoreTable";
import { PerformanceTable } from "@/components/PerformanceTable";
import { WeekMapStrip } from "@/components/WeekMapStrip";
import { WeekSpotlight } from "@/components/WeekSpotlight";
import { WeekTeamStatsCard } from "@/components/WeekTeamStatsCard";
import { CombinedEconomySection } from "@/components/CombinedEconomySection";

export const revalidate = 0;

export default async function HomePage() {
  const [upcoming, latest] = await Promise.all([fetchUpcomingMatch(supabase), fetchLatestWeek(supabase)]);
  const upcomingSplash = upcoming ? mapSplash(upcoming.map) : null;

  const weekHref = latest ? `/schedule/${encodeURIComponent(latest.week.season_id ?? "")}/${latest.week.local_date}` : "";
  const mvp = latest && latest.combinedBoxScore.length > 0 ? latest.combinedBoxScore[0] : null;

  return (
    <>
      <section>
        <h2>Upcoming Match</h2>
        {upcoming ? (
          <div className="upcoming-card">
            {upcomingSplash && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="upcoming-card-bg" src={upcomingSplash} alt={upcoming.map} />
            )}
            <div className="upcoming-card-content">
              <div className="upcoming-card-label">Next Map</div>
              <div className="upcoming-card-map">
                <MapCell map={upcoming.map} />
              </div>
              {upcoming.note && <div className="upcoming-card-note">{upcoming.note}</div>}
            </div>
          </div>
        ) : (
          <div className="empty-note">
            No upcoming match set yet — run <code>set_upcoming_match.py</code> once the next map is known (Premier
            doesn&apos;t publish this via the API in a way we can trust — see PLAN.md).
          </div>
        )}
      </section>

      {latest && (
        <section>
          <div className="latest-head">
            <h2>Latest Result</h2>
            <Link className="week-pill-link" href={weekHref}>
              {latest.week.season_id} &middot; {latest.week.label}{" "}
              <span
                className={`pill ${
                  latest.week.wins > latest.week.losses ? "win" : latest.week.losses > latest.week.wins ? "loss" : ""
                }`}
              >
                {latest.week.record}
              </span>
            </Link>
          </div>

          <div className="week-maps-row">
            {latest.week.maps.map((m, i) => (
              <WeekMapStrip
                key={m.match_id}
                map={m.map}
                opponent={m.opponent}
                matchId={m.match_id}
                result={m.result}
                teamSummary={latest.mapTeamSummaries[i]}
              />
            ))}
          </div>

          {mvp && (
            <WeekSpotlight
              playerId={mvp.player_id}
              displayName={mvp.display_name}
              headshotFilename={mvp.headshot_filename}
              acs={mvp.acs}
              kills={mvp.kills}
              deaths={mvp.deaths}
              assists={mvp.assists}
            />
          )}

          <section>
            <h2>Combined Scoreboard — WILD</h2>
            <BoxScoreTable rows={latest.combinedBoxScore} clickable multiAgent />
          </section>

          <section>
            <h2>Multikills &amp; Clutches — WILD</h2>
            <PerformanceTable rows={latest.combinedBoxScore} clickable />
          </section>

          <div className="week-bottom-grid">
            {latest.weekTeamStats && <WeekTeamStatsCard stats={latest.weekTeamStats} />}
            {latest.combinedEconomy && <CombinedEconomySection summary={latest.combinedEconomy} />}
          </div>

          <Link className="back-link" href={weekHref}>
            View full week &rarr;
          </Link>
        </section>
      )}
    </>
  );
}
