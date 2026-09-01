import { Fragment } from "react";
import { StatChip } from "./StatChip";
import { weaponIcon } from "@/lib/assets";
import type { PlayerWeaponGrid, PlayerWeaponTotal } from "@/lib/weapons";

function WeaponTile({ w }: { w: PlayerWeaponTotal }) {
  const icon = weaponIcon(w.weapon);
  return (
    <div className="weapon-tile">
      <div className="weapon-tile-icon">
        {icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt={w.weapon} />
        ) : (
          <span className="avatar-fallback">—</span>
        )}
      </div>
      <StatChip value={w.kills} blankZero />
      <div className="weapon-tile-name">{w.weapon}</div>
    </div>
  );
}

// Career weapon kills laid out like the VALORANT buy menu — columns of
// category groups (Sidearms | SMGs+Shotguns | Rifles+Machine Guns | Sniper
// Rifles), kill count standing in for price. Mirrors
// macros.html::weapon_buy_grid.
export function WeaponBuyGrid({ weaponGrid }: { weaponGrid: PlayerWeaponGrid }) {
  return (
    <div className="weapon-grid">
      {weaponGrid.columns.map((col, i) => (
        <div className="weapon-grid-col" key={i}>
          {col.map((cat) => (
            <Fragment key={cat.label}>
              <div className="weapon-cat-label">{cat.label}</div>
              {cat.weapons.map((w) => (
                <WeaponTile w={w} key={w.weapon} />
              ))}
            </Fragment>
          ))}
        </div>
      ))}
      {weaponGrid.other.length > 0 && (
        <div className="weapon-grid-col">
          <div className="weapon-cat-label">Melee / Abilities</div>
          {weaponGrid.other.map((w) => (
            <WeaponTile w={w} key={w.weapon} />
          ))}
        </div>
      )}
    </div>
  );
}
