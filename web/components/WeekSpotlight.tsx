import Link from "next/link";
import { Avatar } from "./Avatar";

// Top-ACS player spotlight — "Player of the Week" for a whole match week
// (homepage, schedule page's Overall tab) or "Map MVP" for a single map
// (schedule page's Map N tabs), same tile either way. Row is already
// sorted by ACS desc by the caller. Mirrors home.html's week-spotlight
// markup.
export function WeekSpotlight({
  playerId,
  displayName,
  headshotFilename,
  acs,
  kills,
  deaths,
  assists,
  label = "Player of the Week",
}: {
  playerId: string;
  displayName: string;
  headshotFilename: string | null;
  acs: number | null;
  kills: number;
  deaths: number;
  assists: number;
  label?: string;
}) {
  return (
    <Link className="week-spotlight" href={`/players/${playerId}`}>
      <Avatar displayName={displayName} headshotFilename={headshotFilename} size="lg" />
      <div>
        <div className="week-spotlight-label">{label}</div>
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
