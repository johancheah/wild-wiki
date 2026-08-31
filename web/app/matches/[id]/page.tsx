import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { MatchTabs } from "@/components/MatchTabs";
import { mapSplash } from "@/lib/assets";
import { fetchMatchFullDetail } from "@/lib/matchDetail";

export const revalidate = 0;

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const detail = await fetchMatchFullDetail(supabase, id);
  if (!detail) notFound();

  const { match, wildRows, enemyRows, timeline, economy, weapons } = detail;
  const splash = mapSplash(match.map);
  const economies = economy ? [{ map: match.map, opponent: match.opponent_name, economy }] : null;

  return (
    <>
      <Link className="back-link" href="/matches">
        &larr; All Matches
      </Link>
      {splash && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="map-splash-banner" src={splash} alt={match.map} />
      )}
      <h1>
        {match.map}{" "}
        <span className={`pill ${match.result === "WIN" ? "win" : "loss"}`} style={{ verticalAlign: "middle" }}>
          {match.result}
        </span>
      </h1>
      <div className="subtitle">
        {match.date.slice(0, 10)} &middot; {match.season_id ?? "—"} &middot; {match.match_type ?? "—"}
        {match.opponent_name && (
          <>
            {" "}
            &middot; vs {match.opponent_name} ({match.opponent_tag})
          </>
        )}{" "}
        &middot; margin {match.margin && match.margin > 0 ? `+${match.margin}` : match.margin} &middot;{" "}
        <span className={`pill ${match.source === "api" ? "src-api" : "src-sheet"}`}>
          {match.source === "api" ? "API-sourced" : "Spreadsheet-sourced"}
        </span>
      </div>

      <MatchTabs
        wildRows={wildRows}
        enemyRows={enemyRows}
        weapons={weapons}
        economies={economies}
        timeline={timeline}
        opponentName={match.opponent_name}
      />
    </>
  );
}
