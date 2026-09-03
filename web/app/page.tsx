import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchUpcomingMatch, fetchLatestWeek } from "@/lib/home";
import { mapSplash } from "@/lib/assets";
import { formatMatchDate } from "@/lib/schedule";
import { MapCell } from "@/components/MapCell";
import { BoxScoreTable } from "@/components/BoxScoreTable";

export const revalidate = 0;

export default async function HomePage() {
  const [upcoming, latest] = await Promise.all([fetchUpcomingMatch(supabase), fetchLatestWeek(supabase)]);
  const upcomingSplash = upcoming ? mapSplash(upcoming.map) : null;

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
          <h2>Latest Result</h2>
          {(() => {
            const splash = latest.week.maps.length > 0 ? mapSplash(latest.week.maps[0].map) : null;
            return splash ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="map-splash-banner" src={splash} alt={latest.week.maps[0].map} />
            ) : null;
          })()}
          <h1>
            <Link href={`/schedule/${encodeURIComponent(latest.week.season_id ?? "")}/${latest.week.local_date}`}>
              {latest.week.season_id} &middot; {latest.week.label}{" "}
              <span
                className={`pill ${
                  latest.week.wins > latest.week.losses ? "win" : latest.week.losses > latest.week.wins ? "loss" : ""
                }`}
                style={{ verticalAlign: "middle" }}
              >
                {latest.week.record}
              </span>
            </Link>
          </h1>
          <div className="subtitle">
            {formatMatchDate(latest.week.local_date)} &middot; {latest.week.match_type ?? "—"} &middot;{" "}
            {latest.week.maps.map((m, i) => (
              <span key={m.match_id}>
                {i > 0 && ", "}
                {m.map} vs {m.opponent ?? "Opponent"} ({m.result})
              </span>
            ))}
          </div>
          <BoxScoreTable rows={latest.combinedBoxScore} clickable multiAgent />
          <Link
            className="back-link"
            href={`/schedule/${encodeURIComponent(latest.week.season_id ?? "")}/${latest.week.local_date}`}
          >
            View full week &rarr;
          </Link>
        </section>
      )}
    </>
  );
}
