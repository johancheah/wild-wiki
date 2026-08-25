import { supabase } from "@/lib/supabase";
import { fetchScheduleBySeason } from "@/lib/schedule";
import { SeasonGroup } from "@/components/SeasonGroup";

export const revalidate = 0;

export default async function SchedulePage() {
  const seasons = await fetchScheduleBySeason(supabase);

  return (
    <>
      <h1>Schedule</h1>
      <div className="subtitle">
        Organized by match week — Premier plays one assigned map per week, twice (against two different opponents),
        so a week&apos;s outcome is 2&ndash;0, 1&ndash;1, or 0&ndash;2. Older seasons (Beta through early E8) ran
        single-map weeks instead; those show one map per row.
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Season</th>
              <th>Week</th>
              <th>Date</th>
              <th>Maps</th>
              <th className="num-col">Record</th>
            </tr>
          </thead>
          {seasons.map((s, i) => (
            <SeasonGroup key={s.season_id ?? "unknown"} season={s} defaultOpen={i === 0} />
          ))}
        </table>
      </div>
    </>
  );
}
