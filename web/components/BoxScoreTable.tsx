import Link from "next/link";
import { Avatar } from "./Avatar";
import { AgentCellIconOnly, MultiAgentCell } from "./AgentCellIconOnly";
import { StatChip, KdaChip } from "./StatChip";

export type BoxScoreTableRow = {
  player_id: string;
  display_name: string;
  headshot_filename: string | null;
  agent?: string | null;
  agents?: (string | null)[];
  acs: number | null;
  kills: number;
  deaths: number;
  assists: number;
  kast_pct: number | null;
  adr: number | null;
  hs_pct: number | null;
  fk: number | null;
  fd: number | null;
};

// VLR-style compact box score: Player, ACS, K/D/A, +/-, KAST, ADR, HS%, FK, FD, +/-
// Mirrors src/wild_tracker/templates/macros.html::box_score_table exactly,
// including the fixed <colgroup> widths so WILD/Opponent tables line up.
export function BoxScoreTable({
  rows,
  clickable = true,
  multiAgent = false,
}: {
  rows: BoxScoreTableRow[];
  clickable?: boolean;
  multiAgent?: boolean;
}) {
  return (
    <div className="table-scroll">
      <table className="vlr-table">
        <colgroup>
          <col style={{ width: 180 }} />
          <col style={{ width: multiAgent ? 92 : 52 }} />
          <col style={{ width: 56 }} />
          <col style={{ width: 132 }} />
          <col style={{ width: 52 }} />
          <col style={{ width: 56 }} />
          <col style={{ width: 56 }} />
          <col style={{ width: 56 }} />
          <col style={{ width: 46 }} />
          <col style={{ width: 46 }} />
          <col style={{ width: 52 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Player</th>
            <th>Agent</th>
            <th className="num-col">ACS</th>
            <th className="num-col">K / D / A</th>
            <th className="num-col">+/&minus;</th>
            <th className="num-col">KAST</th>
            <th className="num-col">ADR</th>
            <th className="num-col">HS%</th>
            <th className="num-col">FK</th>
            <th className="num-col">FD</th>
            <th className="num-col">+/&minus;</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const nameCell = (
              <>
                <Avatar displayName={r.display_name} headshotFilename={r.headshot_filename} />
                {r.display_name}
              </>
            );
            const fkfd = r.fk !== null && r.fd !== null ? r.fk - r.fd : null;
            return (
              <tr key={r.player_id} className={clickable ? "linkable" : ""}>
                <td className="name">{clickable ? <Link href={`/players/${r.player_id}`}>{nameCell}</Link> : nameCell}</td>
                <td>{multiAgent ? <MultiAgentCell agents={r.agents ?? []} /> : <AgentCellIconOnly agent={r.agent ?? null} />}</td>
                <td className="num-col">
                  <StatChip value={r.acs !== null ? Math.round(r.acs) : null} />
                </td>
                <td className="num-col">
                  <KdaChip kills={r.kills} deaths={r.deaths} assists={r.assists} />
                </td>
                <td className="num-col">
                  <StatChip value={r.kills - r.deaths} diff />
                </td>
                <td className="num-col">
                  <StatChip value={r.kast_pct !== null ? `${Math.round(r.kast_pct)}%` : null} />
                </td>
                <td className="num-col">
                  <StatChip value={r.adr !== null ? Math.round(r.adr) : null} />
                </td>
                <td className="num-col">
                  <StatChip value={r.hs_pct !== null ? `${Math.round(r.hs_pct)}%` : null} />
                </td>
                <td className="num-col">
                  <StatChip value={r.fk} />
                </td>
                <td className="num-col">
                  <StatChip value={r.fd} />
                </td>
                <td className="num-col">
                  <StatChip value={fkfd} diff />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
