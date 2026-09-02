import { BoxScoreTable, type BoxScoreTableRow } from "./BoxScoreTable";
import { PerformanceTable, type PerformanceRow } from "./PerformanceTable";
import { WeaponMatrixTable } from "./WeaponMatrixTable";
import { EconomySection } from "./EconomySection";
import { RoundTimeline } from "./RoundTimeline";
import { H2hTable } from "./H2hTable";
import { TeamSummaryCard } from "./TeamSummaryCard";
import { Tabs } from "./Tabs";
import type { WeaponMatrix } from "@/lib/weapons";
import type { MatchEconomy } from "@/lib/economy";
import type { TimelineEntry } from "@/lib/timeline";
import type { H2hMatrix } from "@/lib/h2h";
import type { EventRounds } from "@/lib/eventRounds";
import type { MatchTeamSummary } from "@/lib/teamSummary";

export type MatchTabsRow = BoxScoreTableRow & PerformanceRow;

export type MatchTabsEconomyEntry = { map: string; opponent: string | null; economy: MatchEconomy };

// Standard set of match-scoped tabs: Overview / Performance / Weapons /
// Economy — shared by the single-match page and each nested Tabs instance
// on the match-week page (Overall + one per map), so every box score /
// weapon matrix / economy grid on the site is rendered by the exact same
// components. Mirrors src/wild_tracker/templates/macros.html::match_tabs.
export function MatchTabs({
  wildRows,
  enemyRows,
  weapons,
  economies,
  boxTitle = "WILD Box Score",
  multiAgent = false,
  subtitle,
  timeline,
  opponentName,
  h2h,
  eventRounds,
  teamSummary,
  map,
}: {
  wildRows: MatchTabsRow[];
  enemyRows?: MatchTabsRow[] | null;
  weapons?: WeaponMatrix | null;
  economies?: MatchTabsEconomyEntry[] | null;
  boxTitle?: string;
  multiAgent?: boolean;
  subtitle?: string;
  timeline?: TimelineEntry[];
  opponentName?: string | null;
  h2h?: H2hMatrix | null;
  eventRounds?: EventRounds;
  teamSummary?: MatchTeamSummary | null;
  map?: string | null;
}) {
  return (
    <>
      {timeline && timeline.length > 0 && <RoundTimeline timeline={timeline} opponentName={opponentName ?? null} />}
      <Tabs
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <>
                {teamSummary && <TeamSummaryCard summary={teamSummary} opponentName={opponentName} map={map} />}
                <section>
                  <h2>{boxTitle}</h2>
                  {subtitle && (
                    <div className="subtitle" style={{ marginTop: -8 }}>
                      {subtitle}
                    </div>
                  )}
                  <BoxScoreTable rows={wildRows} clickable multiAgent={multiAgent} />
                </section>
                {enemyRows && enemyRows.length > 0 ? (
                  <section>
                    <h2>Opponent Box Score</h2>
                    <BoxScoreTable rows={enemyRows} clickable={false} />
                  </section>
                ) : enemyRows !== undefined && enemyRows !== null ? (
                  <div className="empty-note">
                    This match was imported from the legacy spreadsheet, which never recorded opponent identity or
                    individual opponent stats — only the final score (see PLAN.md §5.5).
                  </div>
                ) : null}
              </>
            ),
          },
          {
            id: "performance",
            label: "Performance",
            content: (
              <>
                {h2h && (
                  <section>
                    <h2>Head-to-Head Kills</h2>
                    <H2hTable h2h={h2h} />
                  </section>
                )}
                <section>
                  <h2>Multi-Kills, Clutches &amp; Utility — WILD</h2>
                  <PerformanceTable rows={wildRows} clickable eventRounds={eventRounds} />
                </section>
              </>
            ),
          },
          ...(weapons
            ? [
                {
                  id: "weapons",
                  label: "Weapons",
                  content: (
                    <section>
                      <h2>Weapon Kills — WILD</h2>
                      <WeaponMatrixTable matrix={weapons} />
                    </section>
                  ),
                },
              ]
            : []),
          ...(economies && economies.length > 0
            ? [
                {
                  id: "economy",
                  label: "Economy",
                  content: (
                    <>
                      {economies.map((e) => (
                        <section key={e.map + (e.opponent ?? "")}>
                          <h2>
                            {e.map} vs {e.opponent ?? "Opponent"}
                          </h2>
                          <EconomySection economy={e.economy} opponentName={e.opponent} />
                        </section>
                      ))}
                    </>
                  ),
                },
              ]
            : []),
        ]}
      />
    </>
  );
}
