import { Fragment } from "react";
import Link from "next/link";
import { Avatar } from "./Avatar";
import { StatChip } from "./StatChip";
import { weaponIcon } from "@/lib/assets";
import type { WeaponPlayerGrid, WeaponTileEntry } from "@/lib/weapons";

// One weapon tile for the match/match-week Weapons tab — same tile shell as
// WeaponBuyGrid's WeaponTile (icon + name), but instead of a single career
// kill chip, a row of small avatar-and-count pairs — one per WILD player
// who got a kill with this weapon, sorted by kills desc — so the grid still
// shows *who* got the kills, the whole point of a team (not career) view.
function WeaponTilePlayers({ w }: { w: WeaponTileEntry }) {
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
      {w.players.length > 0 ? (
        <div className="weapon-tile-players">
          {w.players.map((pl) => (
            <Link
              className="weapon-tile-player"
              href={`/players/${pl.player_id}`}
              key={pl.player_id}
              title={`${pl.display_name}: ${pl.kills} kills`}
            >
              <Avatar displayName={pl.display_name} headshotFilename={pl.headshot_filename} size="sm" />
              <span className="weapon-tile-player-count">{pl.kills}</span>
            </Link>
          ))}
        </div>
      ) : (
        <StatChip value={null} blankZero />
      )}
      <div className="weapon-tile-name">{w.weapon}</div>
    </div>
  );
}

// Match/match-week Weapons tab — same VALORANT-buy-menu grid layout as the
// player page's career WeaponBuyGrid (so both pages read the same way),
// but each tile breaks kills down per player instead of one team total.
// Mirrors macros.html::weapon_buy_grid_players.
export function WeaponBuyGridPlayers({ weaponGrid }: { weaponGrid: WeaponPlayerGrid }) {
  return (
    <div className="weapon-grid">
      {weaponGrid.columns.map((col, i) => (
        <div className="weapon-grid-col" key={i}>
          {col.map((cat) => (
            <Fragment key={cat.label}>
              <div className="weapon-cat-label">{cat.label}</div>
              {cat.weapons.map((w) => (
                <WeaponTilePlayers w={w} key={w.weapon} />
              ))}
            </Fragment>
          ))}
        </div>
      ))}
      {weaponGrid.other.length > 0 && (
        <div className="weapon-grid-col">
          <div className="weapon-cat-label">Melee / Abilities</div>
          {weaponGrid.other.map((w) => (
            <WeaponTilePlayers w={w} key={w.weapon} />
          ))}
        </div>
      )}
    </div>
  );
}
