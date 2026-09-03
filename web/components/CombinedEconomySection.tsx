import type { WeekEconomySummary, PctRow } from "@/lib/economy";
import { mapSplash } from "@/lib/assets";

// WILD-only buy-type summary aggregated across a whole match week — the
// Overall tab's Economy sub-tab (round-by-round detail doesn't make sense
// merged across maps with different opponents/round counts, so that stays
// on each map's own Economy tab via EconomySection). Same card/row format
// as WeekTeamStatsCard ("Pistol 3/4 [75%]" etc) and the same map-splash-art
// header, rather than a table. Mirrors macros.html::combined_economy_table.
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

export function CombinedEconomySection({ summary, map }: { summary: WeekEconomySummary; map?: string | null }) {
  const splash = mapSplash(map);
  return (
    <div className="week-team-stats-card" style={splash ? { backgroundImage: `url(${splash})` } : undefined}>
      <div className="week-team-stats-header">Combined Economy — WILD</div>
      <div className="week-team-stats-grid">
        <div className="week-team-stats-col">
          <Row label="Pistol" r={summary.pistol} />
          <Row label="Eco" r={summary.eco} />
          <Row label="Semi-Eco" r={summary.semi_eco} />
        </div>
        <div className="week-team-stats-col">
          <Row label="Semi-Buy" r={summary.semi_buy} />
          <Row label="Full Buy" r={summary.full_buy} />
        </div>
      </div>
    </div>
  );
}
