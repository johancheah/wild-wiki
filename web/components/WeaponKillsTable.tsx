export type WeaponKillRow = { player_id: string; display_name: string; weapon: string; kill_count: number };

export function WeaponKillsTable({ rows }: { rows: WeaponKillRow[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Weapon</th>
            <th className="num-col">Kills</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w, i) => (
            <tr key={`${w.player_id}-${w.weapon}-${i}`}>
              <td className="name">{w.display_name}</td>
              <td>{w.weapon}</td>
              <td className="num-col num">{w.kill_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
