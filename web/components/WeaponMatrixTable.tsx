import Link from "next/link";
import { Avatar } from "./Avatar";
import { StatChip } from "./StatChip";
import { weaponIcon } from "@/lib/assets";
import type { WeaponMatrix } from "@/lib/weapons";

// Mirrors src/wild_tracker/templates/macros.html::weapon_matrix_table —
// WILD-only weapon-kills matrix, players down the side, weapons across the
// top (real weapon icons where available, ability-kills fall back to text).
export function WeaponMatrixTable({ matrix }: { matrix: WeaponMatrix }) {
  return (
    <div className="table-scroll">
      <table className="weapon-matrix-table">
        <thead>
          <tr>
            <th>Player</th>
            {matrix.weapons.map((w) => {
              const icon = weaponIcon(w);
              return (
                <th className="num-col" key={w} title={w}>
                  {icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="weapon-col-icon" src={icon} alt={w} />
                  ) : (
                    w
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {matrix.players.map((p) => (
            <tr key={p.player_id} className="linkable">
              <td className="name">
                <Link href={`/players/${p.player_id}`}>
                  <Avatar displayName={p.display_name} headshotFilename={p.headshot_filename} />
                  {p.display_name}
                </Link>
              </td>
              {matrix.weapons.map((w) => (
                <td className="num-col" key={w}>
                  <StatChip value={p.kills_by_weapon[w] ?? null} blankZero square />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
