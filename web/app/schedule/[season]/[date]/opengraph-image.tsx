import { ImageResponse } from "next/og";
import { supabase } from "@/lib/supabase";
import { mapSplash, agentIcon } from "@/lib/assets";
import { fileDataUri } from "@/lib/ogAssets";
import { fetchMatchWeekByKey, fetchCombinedBoxScore } from "@/lib/schedule";
import { OgTeamPanel, type OgRosterRow } from "@/components/OgTeamPanel";

// nodejs (not the edge runtime default for this convention) so we can read
// the logo/headshots straight off disk via fs rather than round-tripping
// through our own deployed origin, which isn't knowable from inside this
// handler.
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "WILD Gaming match week result";

export default async function Image({ params }: { params: Promise<{ season: string; date: string }> }) {
  const { season, date } = await params;

  const week = await fetchMatchWeekByKey(supabase, season, date);
  if (!week) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", background: "#0c0f13" }} />
      ),
      { ...size }
    );
  }

  const matchIds = week.maps.map((m) => m.match_id);
  const [combined, logoSrc] = await Promise.all([fetchCombinedBoxScore(supabase, matchIds), fileDataUri("logo.png")]);

  const splash = mapSplash(week.maps[0]?.map ?? null);
  const record = week.record; // "2-0" | "1-1" | "0-2" style
  const isGoodWeek = week.wins > week.losses;
  const isEvenWeek = week.wins === week.losses;
  const badgeColor = isEvenWeek ? "#8b95a6" : isGoodWeek ? "#4fd88a" : "#f2685f";

  // Regular-season weeks play the same assigned map twice (against two
  // different opponents), so "Summit & Summit" is just noise — collapse to
  // "Summit" once. Playoffs weeks can run different maps per round, so
  // those still list each distinct one.
  const mapNames = [...new Set(week.maps.map((m) => m.map))].join(" & ");
  const opponent = week.maps[0]?.opponent;

  const roster: OgRosterRow[] = await Promise.all(
    combined.slice(0, 5).map(async (r) => ({
      player_id: r.player_id,
      display_name: r.display_name,
      avatarSrc: r.headshot_filename ? await fileDataUri(`headshots/${r.headshot_filename}`) : null,
      agentIconSrc: agentIcon(r.agents.find((a) => a) ?? null),
      acs: r.acs,
      kills: r.kills,
      deaths: r.deaths,
      assists: r.assists,
    }))
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#0c0f13",
          fontFamily: "sans-serif",
        }}
      >
        {splash && (
          <img
            src={splash}
            width={1200}
            height={630}
            style={{ objectFit: "cover", position: "absolute", inset: 0 }}
            alt=""
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(180deg, rgba(12,15,19,0.55) 0%, rgba(12,15,19,0.55) 40%, rgba(12,15,19,0.96) 100%)",
          }}
        />

        {/* Top: WILD logo + brand */}
        <div style={{ position: "absolute", top: 48, left: 64, display: "flex", alignItems: "center", gap: 14 }}>
          {logoSrc && (
            <img src={logoSrc} width={44} height={44} alt="" />
          )}
          <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: "#a9f14f", letterSpacing: 2 }}>
            WILD GAMING
          </div>
        </div>

        {/* Week record badge, top right — the week's outcome (2-0 / 1-1 /
            0-2), not a single map's score. */}
        <div
          style={{
            position: "absolute",
            top: 48,
            right: 64,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "10px 22px",
            borderRadius: 999,
            background: `rgba(${isEvenWeek ? "139,149,166" : isGoodWeek ? "47,214,127" : "242,104,95"},0.18)`,
            border: `2px solid ${badgeColor}`,
          }}
        >
          <div style={{ display: "flex", fontSize: 26, fontWeight: 800, color: badgeColor }}>{record}</div>
        </div>

        {/* Week label + maps, bottom-left */}
        <div style={{ position: "absolute", bottom: 56, left: 64, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 24, color: "#8b95a6", marginBottom: 10 }}>
            {[week.season_id, week.label, opponent ? `vs ${opponent}` : null].filter(Boolean).join(" · ")}
          </div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: "#e7ebf1" }}>{mapNames}</div>
        </div>

        {/* Team panel, top-right below the record badge — combined ACS
            across the week's maps, top row is the week's MVP. */}
        {roster.length > 0 && <OgTeamPanel title="WILD ROSTER · WEEK" rows={roster} />}
      </div>
    ),
    { ...size }
  );
}
