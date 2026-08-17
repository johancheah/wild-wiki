import { supabase } from "@/lib/supabase";

export const revalidate = 0;

type BySeason = { season_id: string | null; n: number; wins: number; first_date: string };

export default async function SchedulePage() {
  const { data } = await supabase.from("v_team_record_by_season").select("*");
  const seasons = (data ?? []) as BySeason[];

  return (
    <>
      <h1>Schedule</h1>
      <div className="empty-note">
        The original spreadsheet&apos;s Schedule sheet (Week 1&ndash;7 + Playoffs, mapped to
        specific date ranges) is a manually-curated calendar that hasn&apos;t been entered into{" "}
        <code>season_schedule</code> yet — it isn&apos;t something the API or the legacy export
        can derive on its own (see PLAN.md §1/§6.5). Showing seasons grouped by their real dates
        instead until that table is populated.
      </div>

      <div className="table-scroll" style={{ marginTop: 24 }}>
        <table>
          <thead>
            <tr>
              <th>Season</th>
              <th className="num-col">Matches</th>
              <th className="num-col">W</th>
              <th className="num-col">L</th>
              <th>First Match</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((s) => (
              <tr key={s.season_id ?? "unknown"}>
                <td className="name">{s.season_id ?? "—"}</td>
                <td className="num-col num">{s.n}</td>
                <td className="num-col num win">{s.wins}</td>
                <td className="num-col num loss">{s.n - s.wins}</td>
                <td>{s.first_date.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
