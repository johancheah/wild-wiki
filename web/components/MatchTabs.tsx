import { BoxScoreTable, type BoxScoreTableRow } from "./BoxScoreTable";
import { PerformanceTable, type PerformanceRow } from "./PerformanceTable";
import { WeaponMatrixTable } from "./WeaponMatrixTable";
import { EconomySection } from "./EconomySection";
import { RoundTimeline } from "./RoundTimeline";
import { Tabs } from "./Tabs";
import type { WeaponMatrix } from "@/lib/weapons";
import type { MatchEconomy } from "@/lib/economy";
import type { TimelineEntry } from "@/lib/timeline";

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
              <section>
                <h2>Multi-Kills, Clutches &amp; Utility — WILD</h2>
                <PerformanceTable rows={wildRows} clickable />
              </section>
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
