"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar } from "./Avatar";
import type { PlayerCareer } from "@/lib/types";

type Column = {
  key: string;
  label: string;
  type: "string" | "num";
  value: (p: PlayerCareer) => string | number | null;
};

const COLUMNS: Column[] = [
  { key: "player", label: "Player", type: "string", value: (p) => p.display_name },
  { key: "mp", label: "MP", type: "num", value: (p) => p.matches_played },
  { key: "kills", label: "Kills", type: "num", value: (p) => p.kills },
  { key: "deaths", label: "Deaths", type: "num", value: (p) => p.deaths },
  { key: "assists", label: "Assists", type: "num", value: (p) => p.assists },
  { key: "kd", label: "K/D", type: "num", value: (p) => p.kd },
  { key: "adr", label: "ADR", type: "num", value: (p) => p.adr },
  { key: "hs_pct", label: "HS%", type: "num", value: (p) => p.hs_pct },
  {
    key: "multi_k",
    label: "Multi-K",
    type: "num",
    value: (p) => (p.two_k ?? 0) + (p.three_k ?? 0) + (p.four_k ?? 0) + (p.five_k ?? 0),
  },
  { key: "clutches", label: "Clutches", type: "num", value: (p) => p.clutches ?? 0 },
  { key: "econ", label: "ECON", type: "num", value: (p) => p.econ },
];

export function PlayersTable({ players }: { players: PlayerCareer[] }) {
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return players;
    const col = COLUMNS.find((c) => c.key === sort.col)!;
    return [...players].sort((a, b) => {
      let av = col.value(a);
      let bv = col.value(b);
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (av < bv) return -1 * sort.dir;
      if (av > bv) return 1 * sort.dir;
      return 0;
    });
  }, [players, sort]);

  function handleSort(col: Column) {
    setSort((prev) => {
      if (prev?.col === col.key) return { col: col.key, dir: prev.dir === 1 ? -1 : 1 };
      return { col: col.key, dir: col.type === "string" ? 1 : -1 };
    });
  }

  return (
    <div className="table-scroll">
      <table className="sortable-table">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className={`${c.key !== "player" ? "num-col" : ""} ${sort?.col === c.key ? (sort.dir === 1 ? "sort-asc" : "sort-desc") : ""}`}
                onClick={() => handleSort(c)}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.player_id} className="linkable">
              <td className="name">
                <Link href={`/players/${p.player_id}`}>
                  <Avatar displayName={p.display_name} headshotFilename={p.headshot_filename} />
                  {p.display_name}
                </Link>
              </td>
              <td className="num-col num">{p.matches_played}</td>
              <td className="num-col num">{p.kills}</td>
              <td className="num-col num">{p.deaths}</td>
              <td className="num-col num">{p.assists}</td>
              <td className="num-col num">{p.kd ?? "—"}</td>
              <td className="num-col num">{p.adr ?? "—"}</td>
              <td className="num-col num">{p.hs_pct !== null ? `${p.hs_pct}%` : "—"}</td>
              <td className="num-col num">{(p.two_k ?? 0) + (p.three_k ?? 0) + (p.four_k ?? 0) + (p.five_k ?? 0)}</td>
              <td className="num-col num">{p.clutches ?? 0}</td>
              <td className="num-col num">{p.econ ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
