import type { WeekTeamStats, PctRow } from "@/lib/teamSummary";

// Whole-week "Team Stats" widget — WILD-only round-conversion rates
// (ATK/DEF/Post Plant/Retake, plus Opening split into 5v4/4v5), aggregated
// across every API-sourced map that week. Unlike TeamSummaryCard this isn't
// a head-to-head (the Overall tab spans two different opponents), so it
// only ever shows WILD's own numbers. Background is a noisy accent-green
// gradient (.week-team-stats-card in globals.css) rather than map splash
// art — a week can span two different maps, and the map is already shown
// on the map strips above this widget on the homepage. Mirrors
// macros.html::team_stats_card.
function Row({ label, r }: { label: string; r: PctRow }) {
  return (
    <div className="week-team-stats-row">
      <span className="wts-label">{label}</span>
      <span className="wts-frac">
        {r.won}/{r.total}
      </span>
      <span className="wts-pct">{r.pct !== null ? `[${r.pct}%]` : "—"}</span>
    </div>
  );
}

export function WeekTeamStatsCard({ stats }: { stats: WeekTeamStats }) {
  return (
    <div className="week-team-stats-card">
      <div className="week-team-stats-header">Team Stats</div>
      <div className="week-team-stats-grid">
        <div className="week-team-stats-col">
          <Row label="ATK" r={stats.atk} />
          <Row label="DEF" r={stats.def} />
          <Row label="Post Plant" r={stats.post_plant} />
          <Row label="Retake" r={stats.retake} />
        </div>
        <div className="week-team-stats-col">
          <Row label="Opening" r={stats.opening} />
          <Row label="5v4" r={stats.five_v_four} />
          <Row label="4v5" r={stats.four_v_five} />
        </div>
      </div>
    </div>
  );
}
