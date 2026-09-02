import Link from "next/link";
import { Avatar } from "./Avatar";
import { StatChip } from "./StatChip";
import type { EventRounds, EventRoundKey } from "@/lib/eventRounds";

export type PerformanceRow = {
  player_id: string;
  display_name: string;
  headshot_filename: string | null;
  two_k: number | null;
  three_k: number | null;
  four_k: number | null;
  five_k: number | null;
  clutch_1v1: number | null;
  clutch_1v2: number | null;
  clutch_1v3: number | null;
  clutch_1v4: number | null;
  clutch_1v5: number | null;
  plants: number | null;
  defuses: number | null;
  econ: number | null;
};

// Builds the hover-tooltip text for a multi-kill/clutch cell from its list
// of round numbers, e.g. "Round 4" or "Rounds 4, 9, 12" — undefined when
// there are no rounds, so StatChip just omits the title. Mirrors
// macros.html::_rounds_title.
function roundsTitle(rounds: number[] | undefined): string | undefined {
  if (!rounds || rounds.length === 0) return undefined;
  return `${rounds.length === 1 ? "Round" : "Rounds"} ${rounds.join(", ")}`;
}

// Mirrors src/wild_tracker/templates/macros.html::performance_table.
export function PerformanceTable({
  rows,
  clickable = true,
  eventRounds,
}: {
  rows: PerformanceRow[];
  clickable?: boolean;
  eventRounds?: EventRounds;
}) {
  const roundsFor = (playerId: string, key: EventRoundKey) => roundsTitle(eventRounds?.[playerId]?.[key]);
  return (
    <div className="table-scroll">
      <table className="performance-table sticky-first-col">
        <thead>
          <tr>
            <th>Player</th>
            <th className="num-col">2K</th>
            <th className="num-col">3K</th>
            <th className="num-col">4K</th>
            <th className="num-col">5K</th>
            <th className="num-col">Total</th>
            <th className="num-col">1v1</th>
            <th className="num-col">1v2</th>
            <th className="num-col">1v3</th>
            <th className="num-col">1v4</th>
            <th className="num-col">1v5</th>
            <th className="num-col">Total</th>
            <th className="col-gap" />
            <th className="num-col">PL</th>
            <th className="num-col">DE</th>
            <th className="num-col">ECON</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const multiTotal = (r.two_k ?? 0) + (r.three_k ?? 0) + (r.four_k ?? 0) + (r.five_k ?? 0);
            const clutchTotal =
              (r.clutch_1v1 ?? 0) + (r.clutch_1v2 ?? 0) + (r.clutch_1v3 ?? 0) + (r.clutch_1v4 ?? 0) + (r.clutch_1v5 ?? 0);
            const nameCell = (
              <>
                <Avatar displayName={r.display_name} headshotFilename={r.headshot_filename} />
                {r.display_name}
              </>
            );
            return (
              <tr key={r.player_id} className={clickable ? "linkable" : ""}>
                <td className="name">
                  {clickable ? <Link href={`/players/${r.player_id}`}>{nameCell}</Link> : nameCell}
                </td>
                <td className="num-col">
                  <StatChip value={r.two_k} blankZero square level={1} title={roundsFor(r.player_id, "two_k")} />
                </td>
                <td className="num-col">
                  <StatChip value={r.three_k} blankZero square level={2} title={roundsFor(r.player_id, "three_k")} />
                </td>
                <td className="num-col">
                  <StatChip value={r.four_k} blankZero square level={3} title={roundsFor(r.player_id, "four_k")} />
                </td>
                <td className="num-col">
                  <StatChip value={r.five_k} blankZero square level={4} title={roundsFor(r.player_id, "five_k")} />
                </td>
                <td className="num-col">
                  <StatChip value={multiTotal} blankZero square />
                </td>
                <td className="num-col">
                  <StatChip value={r.clutch_1v1} blankZero square level={1} title={roundsFor(r.player_id, "clutch_1v1")} />
                </td>
                <td className="num-col">
                  <StatChip value={r.clutch_1v2} blankZero square level={2} title={roundsFor(r.player_id, "clutch_1v2")} />
                </td>
                <td className="num-col">
                  <StatChip value={r.clutch_1v3} blankZero square level={3} title={roundsFor(r.player_id, "clutch_1v3")} />
                </td>
                <td className="num-col">
                  <StatChip value={r.clutch_1v4} blankZero square level={4} title={roundsFor(r.player_id, "clutch_1v4")} />
                </td>
                <td className="num-col">
                  <StatChip value={r.clutch_1v5} blankZero square level={5} title={roundsFor(r.player_id, "clutch_1v5")} />
                </td>
                <td className="num-col">
                  <StatChip value={clutchTotal} blankZero square />
                </td>
                <td className="col-gap" />
                <td className="num-col">
                  <StatChip value={r.plants} blankZero square />
                </td>
                <td className="num-col">
                  <StatChip value={r.defuses} blankZero square />
                </td>
                <td className="num-col">
                  <StatChip value={r.econ !== null ? Math.round(r.econ) : null} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
