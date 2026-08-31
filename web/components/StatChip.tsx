// Mirrors src/wild_tracker/templates/macros.html::chip exactly.
export function StatChip({
  value,
  diff = false,
  blankZero = false,
  square = false,
  level = 0,
}: {
  value: number | string | null;
  diff?: boolean;
  blankZero?: boolean;
  square?: boolean;
  level?: number;
}) {
  const sq = square ? " sq" : "";
  const lvl = level && value ? ` chip-lvl-${level}` : "";
  if (blankZero && (value === null || value === 0)) {
    return <span className={`stat-chip zero${sq}`} />;
  }
  if (value === null || value === undefined) {
    return <span className={`stat-chip${sq}`}>—</span>;
  }
  if (diff && typeof value === "number") {
    const cls = value > 0 ? "chip-pos" : value < 0 ? "chip-neg" : "";
    const label = value > 0 ? `+${value}` : `${value}`;
    return <span className={`stat-chip${sq} ${cls}`}>{label}</span>;
  }
  return <span className={`stat-chip${sq}${lvl}`}>{value}</span>;
}

// K/D/A split into fixed-width slots so digits align vertically down the
// column regardless of 1 vs 2 digit values (mirrors macros.html's kda-num/
// kda-sep markup).
export function KdaChip({ kills, deaths, assists }: { kills: number; deaths: number; assists: number }) {
  return (
    <span className="stat-chip kda">
      <span className="kda-num">{kills}</span>
      <span className="kda-sep">/</span>
      <span className="kda-num">{deaths}</span>
      <span className="kda-sep">/</span>
      <span className="kda-num">{assists}</span>
    </span>
  );
}
