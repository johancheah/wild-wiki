import type { SupabaseClient } from "@supabase/supabase-js";

// Direct port of src/wild_tracker/queries.py::weapon_matrix — WILD-only
// weapon-kills matrix for the match's Weapons tab: one row per player, one
// column per weapon actually used, sorted by total kills descending on
// both axes.

export type WeaponMatrixPlayer = {
  player_id: string;
  display_name: string;
  headshot_filename: string | null;
  kills_by_weapon: Record<string, number>;
  total: number;
};

export type WeaponMatrix = {
  weapons: string[];
  players: WeaponMatrixPlayer[];
};

// Weapons tab column order: category first (rifles -> snipers -> heavy ->
// shotguns -> SMGs -> pistols -> melee), kills descending within a
// category. Ability-kills (e.g. "Blade Storm") aren't real weapons so
// they're never in this map — anything not listed falls into the trailing
// abilities/ults group instead. Mirrors
// src/wild_tracker/queries.py::_WEAPON_CATEGORY_ORDER.
const WEAPON_CATEGORY_ORDER: Record<string, number> = {
  Bulldog: 0, Guardian: 0, Phantom: 0, Vandal: 0,
  Marshal: 1, Outlaw: 1, Operator: 1,
  Ares: 2, Odin: 2,
  Bucky: 3, Judge: 3,
  Stinger: 4, Spectre: 4,
  Classic: 5, Shorty: 5, Frenzy: 5, Ghost: 5, Sheriff: 5,
  Melee: 6,
};
const WEAPON_ABILITY_RANK = 7;

export function sortWeapons(weaponTotals: Map<string, number>): string[] {
  return [...weaponTotals.keys()].sort((a, b) => {
    const rankA = WEAPON_CATEGORY_ORDER[a] ?? WEAPON_ABILITY_RANK;
    const rankB = WEAPON_CATEGORY_ORDER[b] ?? WEAPON_ABILITY_RANK;
    if (rankA !== rankB) return rankA - rankB;
    return weaponTotals.get(b)! - weaponTotals.get(a)!;
  });
}

export async function fetchWeaponMatrix(
  supabase: SupabaseClient,
  matchId: string,
  wildTeamId: string
): Promise<WeaponMatrix | null> {
  const [{ data: kills }, { data: matchPlayers }, { data: players }] = await Promise.all([
    supabase.from("match_player_weapon_kills").select("player_id, weapon, kill_count").eq("match_id", matchId),
    supabase.from("match_players").select("player_id, team_id").eq("match_id", matchId),
    supabase.from("players").select("player_id, riot_name, nickname, headshot_filename"),
  ]);

  if (!kills || kills.length === 0) return null;

  const teamByPlayer = new Map<string, string>();
  for (const mp of matchPlayers ?? []) teamByPlayer.set(mp.player_id, mp.team_id);

  const playerInfo = new Map<string, { display_name: string; headshot_filename: string | null }>();
  for (const p of players ?? []) {
    playerInfo.set(p.player_id, { display_name: p.nickname ?? p.riot_name, headshot_filename: p.headshot_filename });
  }

  const weaponTotals = new Map<string, number>();
  const byPlayer = new Map<string, WeaponMatrixPlayer>();

  for (const k of kills) {
    if (teamByPlayer.get(k.player_id) !== wildTeamId) continue;

    weaponTotals.set(k.weapon, (weaponTotals.get(k.weapon) ?? 0) + k.kill_count);

    if (!byPlayer.has(k.player_id)) {
      const info = playerInfo.get(k.player_id);
      byPlayer.set(k.player_id, {
        player_id: k.player_id,
        display_name: info?.display_name ?? "?",
        headshot_filename: info?.headshot_filename ?? null,
        kills_by_weapon: {},
        total: 0,
      });
    }
    const p = byPlayer.get(k.player_id)!;
    p.kills_by_weapon[k.weapon] = k.kill_count;
    p.total += k.kill_count;
  }

  if (byPlayer.size === 0) return null;

  const weapons = sortWeapons(weaponTotals);
  const playersOut = [...byPlayer.values()].sort((a, b) => b.total - a.total);
  return { weapons, players: playersOut };
}

// Sums a list of per-match weapon matrices into one combined matrix — the
// match-week Overall tab's Weapons view. Mirrors
// src/wild_tracker/queries.py::_merge_weapon_matrices.
export function mergeWeaponMatrices(matrices: (WeaponMatrix | null)[]): WeaponMatrix | null {
  const weaponTotals = new Map<string, number>();
  const byPlayer = new Map<string, WeaponMatrixPlayer>();

  for (const wm of matrices) {
    if (!wm) continue;
    for (const p of wm.players) {
      if (!byPlayer.has(p.player_id)) {
        byPlayer.set(p.player_id, {
          player_id: p.player_id,
          display_name: p.display_name,
          headshot_filename: p.headshot_filename,
          kills_by_weapon: {},
          total: 0,
        });
      }
      const dest = byPlayer.get(p.player_id)!;
      for (const [weapon, count] of Object.entries(p.kills_by_weapon)) {
        dest.kills_by_weapon[weapon] = (dest.kills_by_weapon[weapon] ?? 0) + count;
        dest.total += count;
        weaponTotals.set(weapon, (weaponTotals.get(weapon) ?? 0) + count);
      }
    }
  }

  if (byPlayer.size === 0) return null;

  const weapons = sortWeapons(weaponTotals);
  const playersOut = [...byPlayer.values()].sort((a, b) => b.total - a.total);
  return { weapons, players: playersOut };
}

export type PlayerWeaponTotal = { weapon: string; kills: number };

// Career weapon kills for one player, category-ordered (rifles -> snipers
// -> heavy -> shotguns -> SMGs -> pistols -> melee -> abilities/ults) —
// same ordering as the match-level Weapons tab, for the player page's
// Weapon Stats table. Mirrors queries.py::player_detail's `weapons` query.
export async function fetchPlayerWeaponTotals(supabase: SupabaseClient, playerId: string): Promise<PlayerWeaponTotal[]> {
  const { data } = await supabase.from("match_player_weapon_kills").select("weapon, kill_count").eq("player_id", playerId);
  const totals = new Map<string, number>();
  for (const r of data ?? []) totals.set(r.weapon, (totals.get(r.weapon) ?? 0) + r.kill_count);
  return sortWeapons(totals).map((weapon) => ({ weapon, kills: totals.get(weapon)! }));
}
