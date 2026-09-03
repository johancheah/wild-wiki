import Link from "next/link";
import { Avatar } from "./Avatar";

// "Player of the Week" — the top-ACS player from the week's combined box
// score (already sorted by ACS desc), linking to their player page.
// Mirrors home.html's week-spotlight markup.
export function WeekSpotlight({
  playerId,
  displayName,
  headshotFilename,
  acs,
  kills,
  deaths,
  assists,
}: {
  playerId: string;
  displayName: string;
  headshotFilename: string | null;
  acs: number | null;
  kills: number;
  deaths: number;
  assists: number;
}) {
  return (
    <Link className="week-spotlight" href={`/players/${playerId}`}>
      <Avatar displayName={displayName} headshotFilename={headshotFilename} size="lg" />
      <div>
        <div className="week-spotlight-label">Player of the Week</div>
        <div className="week-spotlight-name">{displayName}</div>
        <div className="week-spotlight-stats">
          <span>
            <b>{acs !== null ? Math.round(acs) : "—"}</b> ACS
          </span>
          <span>
            <b>
              {kills} / {deaths} / {assists}
            </b>{" "}
            K/D/A
          </span>
        </div>
      </div>
    </Link>
  );
}
