import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { MatchTabs } from "@/components/MatchTabs";
import { mapSplash } from "@/lib/assets";
import { fetchMatchFullDetail } from "@/lib/matchDetail";
import { matchRoundScore } from "@/lib/ogAssets";
import type { MatchRow } from "@/lib/types";

export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [{ data: matchRows }, { data: roundsRows }] = await Promise.all([
    supabase.from("v_match_row").select("*").eq("match_id", id),
    supabase.from("v_match_box_score").select("rounds_played").eq("match_id", id).eq("is_wild_player", true).limit(1),
  ]);
  const match = (matchRows as MatchRow[] | null)?.[0];
  if (!match) return { title: "Match — WILD Gaming" };

  const score = matchRoundScore(match.margin, match.result, roundsRows?.[0]?.rounds_played ?? null);
  const scoreText = score ? `${score.wildScore}-${score.oppScore}` : null;
  const title = `${match.map}${match.opponent_name ? ` vs ${match.opponent_name}` : ""} — WILD Gaming`;
  const description = [match.result, scoreText, match.season_id].filter(Boolean).join(" · ");

  return { title, description };
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const detail = await fetchMatchFullDetail(supabase, id);
  if (!detail) notFound();

  const { match, wildRows, enemyRows, timeline, economy, weapons, h2h, eventRounds } = detail;
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
        h2h={h2h}
        eventRounds={eventRounds}
      />
    </>
  );
}
