import { ImageResponse } from "next/og";
import { supabase } from "@/lib/supabase";
import { mapSplash, agentIcon } from "@/lib/assets";
import { fileDataUri, matchRoundScore } from "@/lib/ogAssets";
import { OgTeamPanel, type OgRosterRow } from "@/components/OgTeamPanel";
import type { MatchRow, BoxScoreRow } from "@/lib/types";

// nodejs (not the edge runtime default for this convention) so we can read
// the logo/headshots straight off disk via fs rather than round-tripping
// through our own deployed origin, which isn't knowable from inside this
// handler.
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "WILD Gaming match result";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [{ data: matchRows }, { data: wildRows }, logoSrc] = await Promise.all([
    supabase.from("v_match_row").select("*").eq("match_id", id),
    supabase
      .from("v_match_box_score")
      .select("*")
      .eq("match_id", id)
      .eq("is_wild_player", true)
      .order("acs", { ascending: false }),
    fileDataUri("logo.png"),
  ]);

  const match = (matchRows as MatchRow[] | null)?.[0];
  const wild = (wildRows as BoxScoreRow[] | null) ?? [];

  const splash = match ? mapSplash(match.map) : null;
  const isWin = match?.result === "WIN";
  const score = matchRoundScore(match?.margin ?? null, match?.result ?? null, wild[0]?.rounds_played ?? null);

  const roster: OgRosterRow[] = await Promise.all(
    wild.slice(0, 5).map(async (r) => ({
      player_id: r.player_id,
      display_name: r.display_name,
      avatarSrc: r.headshot_filename ? await fileDataUri(`headshots/${r.headshot_filename}`) : null,
      agentIconSrc: agentIcon(r.agent),
      acs: r.acs,
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

        {/* Result pill + real round score, top right */}
        {match?.result && (
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
              background: isWin ? "rgba(47,214,127,0.18)" : "rgba(242,104,95,0.18)",
              border: `2px solid ${isWin ? "#4fd88a" : "#f2685f"}`,
            }}
          >
            <div style={{ display: "flex", fontSize: 26, fontWeight: 800, color: isWin ? "#4fd88a" : "#f2685f" }}>
              {match.result}
            </div>
            {score && (
              <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: isWin ? "#4fd88a" : "#f2685f" }}>
                {score.wildScore}&ndash;{score.oppScore}
              </div>
            )}
          </div>
        )}

        {/* Map name, bottom-left */}
        <div style={{ position: "absolute", bottom: 56, left: 64, display: "flex", flexDirection: "column" }}>
          {match?.opponent_name && (
            <div style={{ display: "flex", fontSize: 24, color: "#8b95a6", marginBottom: 10 }}>
              vs {match.opponent_name}
            </div>
          )}
          <div style={{ display: "flex", fontSize: 76, fontWeight: 800, color: "#e7ebf1" }}>
            {match?.map ?? "Unknown Map"}
          </div>
        </div>

        {/* Team panel, top-right below the result pill */}
        {roster.length > 0 && <OgTeamPanel title="WILD ROSTER" rows={roster} />}
      </div>
    ),
    { ...size }
  );
}
