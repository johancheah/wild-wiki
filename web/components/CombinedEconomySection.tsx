import { TeamBadge } from "./TeamBadge";
import type { BuyBucket, BucketSummary } from "@/lib/economy";

const BUCKET_ORDER: BuyBucket[] = ["pistol", "eco", "semi_eco", "semi_buy", "full_buy"];
const BUCKET_LABEL: Record<BuyBucket, string> = {
  pistol: "Pistol Won",
  eco: "Eco (won)",
  semi_eco: "$ (won)",
  semi_buy: "$$ (won)",
  full_buy: "$$$ (won)",
};

// WILD-only buy-type summary aggregated across a whole match week — the
// Overall tab's Economy sub-tab (round-by-round detail doesn't merge
// meaningfully across maps with different opponents/round counts, so that
// stays on each map's own EconomySection). Mirrors
// macros.html::combined_economy_table.
export function CombinedEconomySection({ summary }: { summary: BucketSummary }) {
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
            <tr>
              <td className="name">
                <TeamBadge isWild name={null} />
                WILD
              </td>
              {BUCKET_ORDER.map((b) => (
                <td className="num-col num" key={b}>
                  {b === "pistol" ? summary[b].won : `${summary[b].n} (${summary[b].won})`}
                </td>
              ))}
            </tr>
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
    </>
  );
}
