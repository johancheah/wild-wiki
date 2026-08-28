import { supabase } from "@/lib/supabase";
import { MapCell } from "@/components/MapCell";

export const revalidate = 0;

type Overall = { wins: number; losses: number; draws: number; total: number };
type ByMap = { map: string; n: number; wins: number };
type BySeason = { season_id: string | null; n: number; wins: number; first_date: string };
type ByType = { match_type: string; n: number; wins: number };

export default async function TeamStatsPage() {
  const [{ data: overallRows }, { data: byMap }, { data: bySeason }, { data: byType }] =
    await Promise.all([
      supabase.from("v_team_record").select("*"),
      supabase.from("v_team_record_by_map").select("*"),
      supabase.from("v_team_record_by_season").select("*"),
      supabase.from("v_team_record_by_type").select("*"),
    ]);

  const overall = (overallRows?.[0] ?? { wins: 0, losses: 0, draws: 0, total: 0 }) as Overall;
  const winPct = overall.total ? (100 * overall.wins) / overall.total : 0;
  const maps = (byMap ?? []) as ByMap[];
  const seasons = (bySeason ?? []) as BySeason[];
  const types = (byType ?? []) as ByType[];

  return (
    <>
      <h1>Team Stats</h1>

      <div className="stat-row">
        <div className="stat">
          <div className="label">Record</div>
          <div className="value">
            <span className="win">{overall.wins}</span>
            <span className="of">&ndash;</span>
            <span className="loss">{overall.losses}</span>
          </div>
        </div>
        <div className="stat">
          <div className="label">Win Rate</div>
          <div className="value num">
            {winPct.toFixed(1)}
            <span className="of">%</span>
          </div>
        </div>
        <div className="stat">
          <div className="label">Matches</div>
          <div className="value num">{overall.total}</div>
        </div>
        <div className="stat">
          <div className="label">Seasons</div>
          <div className="value num">{seasons.length}</div>
        </div>
      </div>

      <section>
        <h2>By Map</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Map</th>
                <th className="num-col">Played</th>
                <th className="num-col">W</th>
                <th className="num-col">L</th>
                <th className="num-col">Win %</th>
              </tr>
            </thead>
            <tbody>
              {maps.map((m) => (
                <tr key={m.map}>
                  <td className="name">
                    <MapCell map={m.map} />
                  </td>
                  <td className="num-col num">{m.n}</td>
                  <td className="num-col num win">{m.wins}</td>
                  <td className="num-col num loss">{m.n - m.wins}</td>
                  <td className="num-col num">{((100 * m.wins) / m.n).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>By Season</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Season</th>
                <th className="num-col">Played</th>
                <th className="num-col">W</th>
                <th className="num-col">L</th>
                <th className="num-col">Win %</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((s) => (
                <tr key={s.season_id ?? "unknown"}>
                  <td className="name">{s.season_id ?? "—"}</td>
                  <td className="num-col num">{s.n}</td>
                  <td className="num-col num win">{s.wins}</td>
                  <td className="num-col num loss">{s.n - s.wins}</td>
                  <td className="num-col num">{((100 * s.wins) / s.n).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>By Match Type</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th className="num-col">Played</th>
                <th className="num-col">W</th>
                <th className="num-col">L</th>
                <th className="num-col">Win %</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.match_type}>
                  <td className="name">{t.match_type}</td>
                  <td className="num-col num">{t.n}</td>
                  <td className="num-col num win">{t.wins}</td>
                  <td className="num-col num loss">{t.n - t.wins}</td>
                  <td className="num-col num">{((100 * t.wins) / t.n).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
