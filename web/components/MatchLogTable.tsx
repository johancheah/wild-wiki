"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AgentCell } from "./AgentCell";
import { MapCell } from "./MapCell";
import { RoleCellIconOnly } from "./RoleCell";
import { formatMatchDate, localDate } from "@/lib/schedule";
import type { MatchPlayerStats } from "@/lib/types";

// Plain numeric cell that fades a zero (or missing value) down to a dash
// instead of a distracting "0" — used by the Expanded Stats columns
// (2K-5K, 1v1-1v5, Plants, Defuses), which are mostly zero for any given
// match. Mirrors macros.html::num_zero.
function NumZero({ value }: { value: number | null }) {
  return value ? <>{value}</> : <span className="num-zero">—</span>;
}

type Column = {
  key: string;
  label: string;
  type: "string" | "num" | "date";
  numCol?: boolean;
  // Which Expanded Stats state this column belongs to — omitted means
  // always shown. "collapse" columns (the combined Multi-K/Clutch totals)
  // swap out for their "expand" breakdown (2K-5K, 1v1-1v5, Plants,
  // Defuses) when the toggle is on, widening the table rather than
  // reflowing it.
  group?: "collapse" | "expand";
  value: (m: MatchPlayerStats) => string | number | null;
};

const COLUMNS: Column[] = [
  { key: "date", label: "Date", type: "date", value: (m) => localDate(m.date) },
  { key: "stage", label: "Stage", type: "string", value: (m) => m.season_id },
  { key: "map", label: "Map", type: "string", value: (m) => m.map },
  { key: "result", label: "Result", type: "string", value: (m) => m.match_result },
  { key: "agent", label: "Agent", type: "string", value: (m) => m.agent },
  { key: "role", label: "Role", type: "string", value: (m) => m.role },
  { key: "acs", label: "ACS", type: "num", numCol: true, value: (m) => m.acs },
  { key: "k", label: "K", type: "num", numCol: true, value: (m) => m.kills },
  { key: "d", label: "D", type: "num", numCol: true, value: (m) => m.deaths },
  { key: "a", label: "A", type: "num", numCol: true, value: (m) => m.assists },
  { key: "plusminus", label: "+/−", type: "num", numCol: true, value: (m) => m.kills - m.deaths },
  { key: "kd", label: "K/D", type: "num", numCol: true, value: (m) => (m.deaths ? m.kills / m.deaths : m.kills) },
  { key: "kast_pct", label: "KAST", type: "num", numCol: true, value: (m) => m.kast_pct },
  { key: "adr", label: "ADR", type: "num", numCol: true, value: (m) => m.adr },
  { key: "hs_pct", label: "HS%", type: "num", numCol: true, value: (m) => m.hs_pct },
  { key: "fk", label: "FK", type: "num", numCol: true, value: (m) => m.fk },
  { key: "fd", label: "FD", type: "num", numCol: true, value: (m) => m.fd },
  { key: "fkfd", label: "+/−", type: "num", numCol: true, value: (m) => (m.fk ?? 0) - (m.fd ?? 0) },
  {
    key: "multi_k",
    label: "Multi-K",
    type: "num",
    numCol: true,
    group: "collapse",
    value: (m) => (m.two_k ?? 0) + (m.three_k ?? 0) + (m.four_k ?? 0) + (m.five_k ?? 0),
  },
  { key: "two_k", label: "2K", type: "num", numCol: true, group: "expand", value: (m) => m.two_k },
  { key: "three_k", label: "3K", type: "num", numCol: true, group: "expand", value: (m) => m.three_k },
  { key: "four_k", label: "4K", type: "num", numCol: true, group: "expand", value: (m) => m.four_k },
  { key: "five_k", label: "5K", type: "num", numCol: true, group: "expand", value: (m) => m.five_k },
  {
    key: "clutch",
    label: "Clutch",
    type: "num",
    numCol: true,
    group: "collapse",
    value: (m) =>
      (m.clutch_1v1 ?? 0) + (m.clutch_1v2 ?? 0) + (m.clutch_1v3 ?? 0) + (m.clutch_1v4 ?? 0) + (m.clutch_1v5 ?? 0),
  },
  { key: "clutch_1v1", label: "1v1", type: "num", numCol: true, group: "expand", value: (m) => m.clutch_1v1 },
  { key: "clutch_1v2", label: "1v2", type: "num", numCol: true, group: "expand", value: (m) => m.clutch_1v2 },
  { key: "clutch_1v3", label: "1v3", type: "num", numCol: true, group: "expand", value: (m) => m.clutch_1v3 },
  { key: "clutch_1v4", label: "1v4", type: "num", numCol: true, group: "expand", value: (m) => m.clutch_1v4 },
  { key: "clutch_1v5", label: "1v5", type: "num", numCol: true, group: "expand", value: (m) => m.clutch_1v5 },
  { key: "plants", label: "Plants", type: "num", numCol: true, group: "expand", value: (m) => m.plants },
  { key: "defuses", label: "Defuses", type: "num", numCol: true, group: "expand", value: (m) => m.defuses },
  { key: "econ", label: "ECON", type: "num", numCol: true, value: (m) => m.econ },
];

type FilterKey = "agent" | "season_id" | "role" | "map";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "agent", label: "Agents" },
  { key: "season_id", label: "Stages" },
  { key: "role", label: "Roles" },
  { key: "map", label: "Maps" },
];

export function MatchLogTable({ log }: { log: MatchPlayerStats[] }) {
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    agent: "",
    season_id: "",
    role: "",
    map: "",
  });
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>({ col: "date", dir: -1 });
  const [expanded, setExpanded] = useState(false);

  const visibleColumns = useMemo(
    () => COLUMNS.filter((c) => !c.group || (expanded ? c.group === "expand" : c.group === "collapse")),
    [expanded]
  );

  // Week-grouping stripe: rows sharing the same match week (same season,
  // Eastern-local calendar night, and match_type — see lib/schedule.ts's
  // week grouping) alternate background so weeks are visually separated,
  // most useful since a week is usually 2 maps played back to back. Keyed
  // by match_id off the original (date-desc) `log` order rather than the
  // current sort, so re-sorting the table doesn't reshuffle which rows are
  // striped — same degrade as the Python app's click-to-sort, which moves
  // the same DOM rows (and their stripe class) around instead of
  // recomputing groups.
  const weekAlt = useMemo(() => {
    const out = new Map<string, boolean>();
    let prevKey: string | null = null;
    let alt = false;
    for (const m of log) {
      const key = `${m.season_id ?? ""}|${localDate(m.date)}|${m.match_type ?? ""}`;
      if (key !== prevKey) {
        alt = !alt;
        prevKey = key;
      }
      out.set(m.match_id, alt);
    }
    return out;
  }, [log]);

  const options = useMemo(() => {
    const out: Record<FilterKey, string[]> = { agent: [], season_id: [], role: [], map: [] };
    for (const key of FILTERS.map((f) => f.key)) {
      out[key] = [...new Set(log.map((m) => m[key]).filter((v): v is string => !!v))].sort();
    }
    return out;
  }, [log]);

  const filtered = useMemo(
    () => log.filter((m) => FILTERS.every(({ key }) => !filters[key] || m[key] === filters[key])),
    [log, filters]
  );

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = COLUMNS.find((c) => c.key === sort.col)!;
    return [...filtered].sort((a, b) => {
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
  }, [filtered, sort]);

  function handleSort(col: Column) {
    setSort((prev) => {
      if (prev?.col === col.key) return { col: col.key, dir: prev.dir === 1 ? -1 : 1 };
      return { col: col.key, dir: col.type === "num" ? -1 : 1 };
    });
  }

  return (
    <>
      <div className="filters-row">
        {FILTERS.map((f) => (
          <select
            key={f.key}
            value={filters[f.key]}
            onChange={(e) => setFilters((prev) => ({ ...prev, [f.key]: e.target.value }))}
          >
            <option value="">All {f.label}</option>
            {options[f.key].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ))}
        <button
          className="expand-toggle-btn"
          type="button"
          aria-pressed={expanded}
          onClick={() => setExpanded((e) => !e)}
        >
          <span className="expand-toggle-caret">▶</span> Expanded Stats
        </button>
      </div>

      <div className="table-scroll">
        <table className="sortable-table">
          <thead>
            <tr>
              {visibleColumns.map((c) => (
                <th
                  key={c.key}
                  className={`${c.numCol ? "num-col" : ""} ${
                    sort?.col === c.key ? (sort.dir === 1 ? "sort-asc" : "sort-desc") : ""
                  }`}
                  onClick={() => handleSort(c)}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.match_id} className={`linkable${weekAlt.get(m.match_id) ? " week-alt" : ""}`}>
                <td>
                  <Link href={`/matches/${m.match_id}`}>{formatMatchDate(m.date)}</Link>
                </td>
                <td>{m.season_id ?? "—"}</td>
                <td>
                  <MapCell map={m.map} />
                </td>
                <td>
                  <span className={`pill ${m.match_result === "WIN" ? "win" : "loss"}`}>{m.match_result}</span>
                </td>
                <td>
                  <AgentCell agent={m.agent} />
                </td>
                <td>
                  <RoleCellIconOnly role={m.role} />
                </td>
                <td className="num-col num">{m.acs !== null ? Math.round(m.acs) : "—"}</td>
                <td className="num-col num">{m.kills}</td>
                <td className="num-col num">{m.deaths}</td>
                <td className="num-col num">{m.assists}</td>
                <td className={`num-col num ${m.kills - m.deaths > 0 ? "margin-pos" : m.kills - m.deaths < 0 ? "margin-neg" : ""}`}>
                  {m.kills - m.deaths > 0 ? `+${m.kills - m.deaths}` : m.kills - m.deaths}
                </td>
                <td className="num-col num">{(m.deaths ? m.kills / m.deaths : m.kills).toFixed(2)}</td>
                <td className="num-col num">{m.kast_pct !== null ? `${Math.round(m.kast_pct)}%` : "—"}</td>
                <td className="num-col num">{m.adr !== null ? Math.round(m.adr) : "—"}</td>
                <td className="num-col num">{m.hs_pct !== null ? `${m.hs_pct.toFixed(1)}%` : "—"}</td>
                <td className="num-col num">{m.fk ?? "—"}</td>
                <td className="num-col num">{m.fd ?? "—"}</td>
                <td className={`num-col num ${(m.fk ?? 0) - (m.fd ?? 0) > 0 ? "margin-pos" : (m.fk ?? 0) - (m.fd ?? 0) < 0 ? "margin-neg" : ""}`}>
                  {(m.fk ?? 0) - (m.fd ?? 0) > 0 ? `+${(m.fk ?? 0) - (m.fd ?? 0)}` : (m.fk ?? 0) - (m.fd ?? 0)}
                </td>
                {expanded ? (
                  <>
                    <td className="num-col num"><NumZero value={m.two_k} /></td>
                    <td className="num-col num"><NumZero value={m.three_k} /></td>
                    <td className="num-col num"><NumZero value={m.four_k} /></td>
                    <td className="num-col num"><NumZero value={m.five_k} /></td>
                    <td className="num-col num"><NumZero value={m.clutch_1v1} /></td>
                    <td className="num-col num"><NumZero value={m.clutch_1v2} /></td>
                    <td className="num-col num"><NumZero value={m.clutch_1v3} /></td>
                    <td className="num-col num"><NumZero value={m.clutch_1v4} /></td>
                    <td className="num-col num"><NumZero value={m.clutch_1v5} /></td>
                    <td className="num-col num"><NumZero value={m.plants} /></td>
                    <td className="num-col num"><NumZero value={m.defuses} /></td>
                  </>
                ) : (
                  <>
                    <td className="num-col num">
                      {(m.two_k ?? 0) + (m.three_k ?? 0) + (m.four_k ?? 0) + (m.five_k ?? 0)}
                    </td>
                    <td className="num-col num">
                      {(m.clutch_1v1 ?? 0) +
                        (m.clutch_1v2 ?? 0) +
                        (m.clutch_1v3 ?? 0) +
                        (m.clutch_1v4 ?? 0) +
                        (m.clutch_1v5 ?? 0)}
                    </td>
                  </>
                )}
                <td className="num-col num">{m.econ !== null ? m.econ.toFixed(0) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
