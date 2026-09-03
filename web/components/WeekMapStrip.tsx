import Link from "next/link";
import { mapSplash } from "@/lib/assets";
import type { MatchTeamSummary } from "@/lib/teamSummary";

// One compact map-result card in the homepage's Latest Result section —
// map splash art + score, then the same 6-stat breakdown as TeamSummaryCard
// (ATK/DEF/First Bloods/Post Plant/Clutches/Thrifties) laid out as a dense
// "wild-value/enemy-value" grid rather than the full h2h card's stacked
// rows, since this is a teaser linking to the real match page, not the
// match page itself. Mirrors home.html's per-map card markup.
export function WeekMapStrip({
  map,
  opponent,
  matchId,
  result,
  teamSummary,
}: {
  map: string;
  opponent: string | null;
  matchId: string;
  result: string | null;
  teamSummary: MatchTeamSummary | null;
}) {
  const splash = mapSplash(map);
  return (
    <Link className="week-map-strip" href={`/matches/${matchId}`}>
      <div className="week-map-art" style={splash ? { backgroundImage: `url(${splash})` } : undefined}>
        <div className="week-map-name">{map}</div>
        {teamSummary && (
          <div className="week-map-score">
            <span className="us">{teamSummary.wild.score}</span>
            <span className="sep">&ndash;</span>
            <span className="them">{teamSummary.enemy.score}</span>
          </div>
        )}
        <div className="week-map-opp">
          vs {opponent ?? "Opponent"}
          <span className={`pill ${result === "WIN" ? "win" : "loss"}`}>{result}</span>
        </div>
      </div>
      {teamSummary && (
        <div className="week-map-stats">
          <div>
            <b>
              {teamSummary.wild.atk_won}/{teamSummary.enemy.atk_won}
            </b>
            <label>ATK</label>
          </div>
          <div>
            <b>
              {teamSummary.wild.def_won}/{teamSummary.enemy.def_won}
            </b>
            <label>DEF</label>
          </div>
          <div>
            <b>
              {teamSummary.wild.first_bloods}/{teamSummary.enemy.first_bloods}
            </b>
            <label>First Bloods</label>
          </div>
          <div>
            <b>
              {teamSummary.wild.post_plant_won}/{teamSummary.enemy.post_plant_won}
            </b>
            <label>Post Plant</label>
          </div>
          <div>
            <b>
              {teamSummary.wild.clutches}/{teamSummary.enemy.clutches}
            </b>
            <label>Clutches</label>
          </div>
          <div>
            <b>
              {teamSummary.wild.thrifties}/{teamSummary.enemy.thrifties}
            </b>
            <label>Thrifties</label>
          </div>
        </div>
      )}
    </Link>
  );
}
