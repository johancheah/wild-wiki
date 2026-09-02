import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { MapCell } from "@/components/MapCell";
import { formatMatchDate } from "@/lib/schedule";
import type { MatchListItem } from "@/lib/types";

export const revalidate = 0;

export default async function MatchesPage() {
  const { data } = await supabase
    .from("v_match_list")
    .select("*")
    .order("date", { ascending: false });
  const matches = (data ?? []) as MatchListItem[];
  const apiCount = matches.filter((m) => m.source === "api").length;
  const sheetCount = matches.filter((m) => m.source === "spreadsheet").length;

  return (
    <>
      <h1>Match History</h1>
      <div className="subtitle">
        {matches.length} matches — {apiCount} from the API, {sheetCount} from the legacy
        spreadsheet import.
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Season</th>
              <th>Type</th>
              <th>Map</th>
              <th>Opponent</th>
              <th>Result</th>
              <th className="num-col">Margin</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.match_id} className="linkable">
                <td>
                  <Link href={`/matches/${m.match_id}`}>{formatMatchDate(m.date)}</Link>
                </td>
                <td className="num">{m.season_id ?? "—"}</td>
                <td className="type-tag">{m.match_type ?? "—"}</td>
                <td>
                  <MapCell map={m.map} />
                </td>
                <td>{m.opponent ?? "—"}</td>
                <td>
                  <span className={`pill ${m.result === "WIN" ? "win" : "loss"}`}>{m.result}</span>
                </td>
                <td className={`num-col num ${m.margin && m.margin > 0 ? "margin-pos" : "margin-neg"}`}>
                  {m.margin && m.margin > 0 ? `+${m.margin}` : m.margin}
                </td>
                <td>
                  <span className={`pill ${m.source === "api" ? "src-api" : "src-sheet"}`}>
                    {m.source === "api" ? "API" : "Sheet"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
