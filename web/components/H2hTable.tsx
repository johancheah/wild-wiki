"use client";

import { useState } from "react";
import { Avatar } from "./Avatar";
import type { H2hMatrix } from "@/lib/h2h";

const VARIANTS = [
  { id: "all", label: "All Kills" },
  { id: "first", label: "First Kills" },
  { id: "op", label: "Op Kills" },
] as const;

// Mirrors src/wild_tracker/templates/macros.html::h2h_table — WILD-vs-
// opponent kill/death grid with an All/First/Op Kills segmented toggle.
export function H2hTable({ h2h }: { h2h: H2hMatrix }) {
  const [active, setActive] = useState<(typeof VARIANTS)[number]["id"]>("all");
  const rows = h2h.variants[active];

  return (
    <div className="h2h-block">
      <div className="tabs h2h-toggle">
        {VARIANTS.map((v) => (
          <button key={v.id} className={`tab-btn ${active === v.id ? "active" : ""}`} onClick={() => setActive(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      <div className="table-scroll">
        <table className="h2h-table">
          <thead>
            <tr>
              <th></th>
              {h2h.enemy_players.map((e) => (
                <th key={e.player_id}>
                  <div className="h2h-col-head">
                    <Avatar displayName={e.display_name} headshotFilename={e.headshot_filename} size="sm" />
                    <span>{e.display_name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.player_id}>
                <td className="name">
                  <Avatar displayName={row.display_name} headshotFilename={row.headshot_filename} />
                  {row.display_name}
                </td>
                {row.cells.map((cell, i) => (
                  <td key={i}>
                    <div className="h2h-cell">
                      <span className="h2h-kd">
                        <span className="h2h-k">{cell.k}</span>
                        <span className="h2h-d">{cell.d}</span>
                      </span>
                      <span className={`h2h-diff ${cell.diff > 0 ? "chip-pos" : cell.diff < 0 ? "chip-neg" : ""}`}>
                        {cell.diff > 0 ? `+${cell.diff}` : cell.diff}
                      </span>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
