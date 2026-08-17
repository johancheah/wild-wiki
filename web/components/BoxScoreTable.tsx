import Link from "next/link";
import { Avatar } from "./Avatar";
import { AgentCell } from "./AgentCell";
import type { BoxScoreRow } from "@/lib/types";

function Chip({
  value,
  diff = false,
}: {
  value: number | string | null;
  diff?: boolean;
}) {
  if (value === null || value === undefined) {
    return <span className="stat-chip">—</span>;
  }
  if (diff && typeof value === "number") {
    const cls = value > 0 ? "chip-pos" : value < 0 ? "chip-neg" : "";
    const label = value > 0 ? `+${value}` : `${value}`;
    return <span className={`stat-chip ${cls}`}>{label}</span>;
  }
  return <span className="stat-chip">{value}</span>;
}

// VLR-style compact box score: Player, ACS, K/D/A, +/-, KAST, ADR, HS%, FK, FD, +/-
// Mirrors src/wild_tracker/templates/macros.html::box_score_table exactly.
export function BoxScoreTable({
  rows,
  clickable = true,
}: {
  rows: BoxScoreRow[];
  clickable?: boolean;
}) {
  return (
    <div className="table-scroll">
      <table className="vlr-table">
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
            const fkfd =
              r.fk !== null && r.fd !== null ? r.fk - r.fd : null;
            return (
              <tr key={r.player_id}>
                <td className="name">
                  {clickable ? (
                    <Link href={`/players/${r.player_id}`}>{nameCell}</Link>
                  ) : (
                    nameCell
                  )}
                </td>
                <td>
                  <AgentCell agent={r.agent} />
                </td>
                <td className="num-col">
                  <Chip value={r.acs !== null ? Math.round(r.acs) : null} />
                </td>
                <td className="num-col">
                  <span className="stat-chip kda">
                    {r.kills} / {r.deaths} / {r.assists}
                  </span>
                </td>
                <td className="num-col">
                  <Chip value={r.kills - r.deaths} diff />
                </td>
                <td className="num-col">
                  <Chip value={r.kast_pct !== null ? `${Math.round(r.kast_pct)}%` : null} />
                </td>
                <td className="num-col">
                  <Chip value={r.adr !== null ? Math.round(r.adr) : null} />
                </td>
                <td className="num-col">
                  <Chip value={r.hs_pct !== null ? `${Math.round(r.hs_pct)}%` : null} />
                </td>
                <td className="num-col">
                  <Chip value={r.fk} />
                </td>
                <td className="num-col">
                  <Chip value={r.fd} />
                </td>
                <td className="num-col">
                  <Chip value={fkfd} diff />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
