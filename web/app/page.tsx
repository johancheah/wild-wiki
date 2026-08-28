import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchUpcomingMatch, fetchLatestMatch } from "@/lib/home";
import { mapSplash } from "@/lib/assets";
import { MapCell } from "@/components/MapCell";
import { BoxScoreTable } from "@/components/BoxScoreTable";

export const revalidate = 0;

export default async function HomePage() {
  const [upcoming, latest] = await Promise.all([fetchUpcomingMatch(supabase), fetchLatestMatch(supabase)]);
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
            const splash = mapSplash(latest.match.map);
            return splash ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="map-splash-banner" src={splash} alt={latest.match.map} />
            ) : null;
          })()}
          <h1>
            <Link href={`/matches/${latest.match.match_id}`}>
              {latest.match.map}{" "}
              <span
                className={`pill ${latest.match.result === "WIN" ? "win" : "loss"}`}
                style={{ verticalAlign: "middle" }}
              >
                {latest.match.result}
              </span>
            </Link>
          </h1>
          <div className="subtitle">
            {latest.match.date.slice(0, 10)} &middot; {latest.match.season_id ?? "—"} &middot;{" "}
            {latest.match.match_type ?? "—"}
            {latest.match.opponent_name && (
              <>
                {" "}
                &middot; vs {latest.match.opponent_name} ({latest.match.opponent_tag})
              </>
            )}{" "}
            &middot; margin {latest.match.margin && latest.match.margin > 0 ? `+${latest.match.margin}` : latest.match.margin}
          </div>
          <BoxScoreTable rows={latest.wildRows} clickable />
          <Link className="back-link" href={`/matches/${latest.match.match_id}`}>
            View full match &rarr;
          </Link>
        </section>
      )}
    </>
  );
}
