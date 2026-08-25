import { Fragment } from "react";
import { TeamBadge } from "./TeamBadge";
import type { BuyBucket, MatchEconomy } from "@/lib/economy";

const BUCKET_ORDER: BuyBucket[] = ["pistol", "eco", "semi_eco", "semi_buy", "full_buy"];
const BUCKET_LABEL: Record<BuyBucket, string> = {
  pistol: "Pistol Won",
  eco: "Eco (won)",
  semi_eco: "$ (won)",
  semi_buy: "$$ (won)",
  full_buy: "$$$ (won)",
};
const BUCKET_SYMBOL: Partial<Record<BuyBucket, string>> = { eco: "", semi_eco: "$", semi_buy: "$$", full_buy: "$$$" };

// Mirrors src/wild_tracker/templates/macros.html::economy_section.
export function EconomySection({ economy, opponentName }: { economy: MatchEconomy; opponentName: string | null }) {
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Team</th>
              {BUCKET_ORDER.map((b) => (
                <th className="num-col" key={b}>
                  {BUCKET_LABEL[b]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {([
              ["WILD", economy.wild_summary],
              [opponentName ?? "Opponent", economy.enemy_summary],
            ] as const).map(([label, summary]) => (
              <tr key={label}>
                <td className="name">
                  <TeamBadge isWild={label === "WILD"} name={opponentName} />
                  {label}
                </td>
                {BUCKET_ORDER.map((b) => (
                  <td className="num-col num" key={b}>
                    {b === "pistol" ? summary[b].won : `${summary[b].n} (${summary[b].won})`}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="econ-legend">
        <span>
          <strong>Eco:</strong> 0&ndash;5k
        </span>
        <span>
          <strong>$ Semi-eco:</strong> 5&ndash;10k
        </span>
        <span>
          <strong>$$ Semi-buy:</strong> 10&ndash;20k
        </span>
        <span>
          <strong>$$$ Full buy:</strong> 20k+
        </span>
      </div>

      <h3 className="econ-round-heading">Round-by-Round Economy</h3>
      <div className="econ-round-scroll">
        <div className="econ-round-grid">
          <div className="econ-round-row bank-row">
            <div className="econ-label">Bank</div>
            {economy.rounds.map((r) => (
              <Fragment key={r.round_number}>
                <div className="econ-cell">{r.wild ? (r.wild.remaining / 1000).toFixed(1) : "—"}k</div>
                {r.label === 12 && <div className="econ-gap" />}
              </Fragment>
            ))}
          </div>
          <div className="econ-round-row">
            <TeamBadge isWild name={null} />
            {economy.rounds.map((r) => {
              const info = r.wild;
              const cls = info ? (info.bucket === "pistol" ? "pistol" : info.won ? "won" : "lost") : "";
              return (
                <Fragment key={r.round_number}>
                  <div className={`econ-cell ${cls}`}>
                    {info ? (info.bucket === "pistol" ? "P" : BUCKET_SYMBOL[info.bucket] ?? "") : ""}
                  </div>
                  {r.label === 12 && <div className="econ-gap" />}
                </Fragment>
              );
            })}
          </div>
          <div className="econ-round-row">
            <TeamBadge isWild={false} name={opponentName} />
            {economy.rounds.map((r) => {
              const info = r.enemy;
              const cls = info ? (info.bucket === "pistol" ? "pistol" : info.won ? "won" : "lost") : "";
              return (
                <Fragment key={r.round_number}>
                  <div className={`econ-cell ${cls}`}>
                    {info ? (info.bucket === "pistol" ? "P" : BUCKET_SYMBOL[info.bucket] ?? "") : ""}
                  </div>
                  {r.label === 12 && <div className="econ-gap" />}
                </Fragment>
              );
            })}
          </div>
          <div className="econ-round-row bank-row">
            <div className="econ-label">Bank</div>
            {economy.rounds.map((r) => (
              <Fragment key={r.round_number}>
                <div className="econ-cell">{r.enemy ? (r.enemy.remaining / 1000).toFixed(1) : "—"}k</div>
                {r.label === 12 && <div className="econ-gap" />}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
