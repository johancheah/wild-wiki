"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SeasonGroup as SeasonGroupData } from "@/lib/schedule";

export function SeasonGroup({ season, defaultOpen }: { season: SeasonGroupData; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const router = useRouter();

  return (
    <tbody className={`season-group ${open ? "" : "collapsed"}`}>
      <tr className="season-header" onClick={() => setOpen((o) => !o)}>
        <td className="name" colSpan={3}>
          <span className="season-toggle">&#9656;</span>
          {season.season_id ?? "—"}
        </td>
        <td>
          {season.weeks.length} week{season.weeks.length === 1 ? "" : "s"}
        </td>
        <td className="num-col num">
          {season.wins > season.losses ? (
            <span className="win">{season.record}</span>
          ) : season.losses > season.wins ? (
            <span className="loss">{season.record}</span>
          ) : (
            season.record
          )}
        </td>
      </tr>
      {season.weeks.map((w) => (
        <tr
          key={w.local_date}
          className="week-row linkable"
          onClick={() => router.push(`/schedule/${encodeURIComponent(w.season_id ?? "")}/${w.local_date}`)}
        >
          <td className="num" style={{ paddingLeft: 32 }}>
            &#8627;
          </td>
          <td className="name">{w.label}</td>
          <td>{w.local_date}</td>
          <td>
            {w.maps.map((m) => (
              <span
                key={m.match_id}
                className={`pill pill-map-result ${m.result === "WIN" ? "win" : "loss"}`}
                style={{ marginRight: 6 }}
              >
                {m.map} {m.result}
              </span>
            ))}
          </td>
          <td className="num-col num">
            {w.wins > w.losses ? (
              <span className="win">{w.record}</span>
            ) : w.losses > w.wins ? (
              <span className="loss">{w.record}</span>
            ) : (
              w.record
            )}
          </td>
        </tr>
      ))}
    </tbody>
  );
}
