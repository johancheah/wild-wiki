import type { MatchTeamSummary } from "@/lib/teamSummary";

// Team-vs-team round-stat overview card — score plus ATK/DEF round wins,
// first bloods (rounds won off first blood in parens), post-plant
// conversion, clutches, and thrifties (rounds won on an Eco/Semi-Eco buy).
// API-sourced matches only (lib/teamSummary.ts returns null otherwise), so
// MatchTabs only renders this when present. Mirrors
// macros.html::team_summary_card.
export function TeamSummaryCard({ summary, opponentName }: { summary: MatchTeamSummary; opponentName?: string | null }) {
  const { wild, enemy } = summary;
  return (
    <div className="team-summary-card">
      <div className="team-summary-header">
        <div className="team-summary-team wild">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="team-summary-logo" src="/logo.png" alt="WILD" />
          <span className="team-summary-score">{wild.score}</span>
        </div>
        <span className="team-summary-sep">&ndash;</span>
        <div className="team-summary-team enemy">
          <span className="team-summary-score">{enemy.score}</span>
          <span className="team-summary-name">{opponentName ?? "Opponent"}</span>
        </div>
      </div>
      <div className="team-summary-body">
        <div className="team-summary-row">
          <span className="team-summary-val">{wild.atk_won}</span>
          <span className="team-summary-label">ATK</span>
          <span className="team-summary-val">{enemy.atk_won}</span>
        </div>
        <div className="team-summary-row">
          <span className="team-summary-val">{wild.def_won}</span>
          <span className="team-summary-label">DEF</span>
          <span className="team-summary-val">{enemy.def_won}</span>
        </div>
        <div className="team-summary-row">
          <span className="team-summary-val">
            {wild.first_bloods} ({wild.first_bloods_won})
          </span>
          <span className="team-summary-label">First Bloods</span>
          <span className="team-summary-val">
            {enemy.first_bloods} ({enemy.first_bloods_won})
          </span>
        </div>
        <div className="team-summary-row">
          <span className="team-summary-val">
            {wild.post_plant_won}/{wild.plants}
          </span>
          <span className="team-summary-label">Post Plant</span>
          <span className="team-summary-val">
            {enemy.post_plant_won}/{enemy.plants}
          </span>
        </div>
        <div className="team-summary-row">
          <span className="team-summary-val">{wild.clutches}</span>
          <span className="team-summary-label">Clutches</span>
          <span className="team-summary-val">{enemy.clutches}</span>
        </div>
        {wild.thrifties !== null && (
          <div className="team-summary-row">
            <span className="team-summary-val">{wild.thrifties}</span>
            <span className="team-summary-label">Thrifties</span>
            <span className="team-summary-val">{enemy.thrifties}</span>
          </div>
        )}
      </div>
    </div>
  );
}
