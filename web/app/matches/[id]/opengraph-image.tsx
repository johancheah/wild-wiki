import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { supabase } from "@/lib/supabase";
import { mapSplash, agentIcon } from "@/lib/assets";
import type { MatchRow, BoxScoreRow } from "@/lib/types";

// nodejs (not the edge runtime default for this convention) so we can read
// the logo/headshot straight off disk via fs rather than round-tripping
// through our own deployed origin, which isn't knowable from inside this
// handler.
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "WILD Gaming match result";

const MIME_BY_EXT: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

// Reads a public/ asset straight off disk into a data: URI — satori (which
// next/og's ImageResponse renders through) sniffs the declared mime to pick
// a decoder, so this must match the file's real format or image decoding
// throws deep inside satori rather than just mis-rendering.
async function fileDataUri(relPath: string): Promise<string | null> {
  try {
    const buf = await readFile(join(process.cwd(), "public", relPath));
    const ext = relPath.split(".").pop()?.toLowerCase() ?? "";
    const mime = MIME_BY_EXT[ext] ?? "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [{ data: matchRows }, { data: mvpRows }, logoSrc] = await Promise.all([
    supabase.from("v_match_row").select("*").eq("match_id", id),
    supabase
      .from("v_match_box_score")
      .select("*")
      .eq("match_id", id)
      .eq("is_wild_player", true)
      .order("acs", { ascending: false })
      .limit(1),
    fileDataUri("logo.png"),
  ]);

  const match = (matchRows as MatchRow[] | null)?.[0];
  const mvp = (mvpRows as BoxScoreRow[] | null)?.[0];

  const splash = match ? mapSplash(match.map) : null;
  const isWin = match?.result === "WIN";
  const margin = match?.margin;
  const marginText = margin != null ? (margin > 0 ? `+${margin}` : `${margin}`) : null;

  const mvpAvatar = mvp?.headshot_filename ? await fileDataUri(`headshots/${mvp.headshot_filename}`) : null;
  const mvpAgentIcon = mvp?.agent ? agentIcon(mvp.agent) : null;

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

        {/* Result pill, top right */}
        {match?.result && (
          <div
            style={{
              position: "absolute",
              top: 48,
              right: 64,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 22px",
              borderRadius: 999,
              background: isWin ? "rgba(47,214,127,0.18)" : "rgba(242,104,95,0.18)",
              border: `2px solid ${isWin ? "#4fd88a" : "#f2685f"}`,
            }}
          >
            <div style={{ display: "flex", fontSize: 28, fontWeight: 800, color: isWin ? "#4fd88a" : "#f2685f" }}>
              {match.result}
            </div>
            {marginText && (
              <div style={{ display: "flex", fontSize: 22, fontWeight: 600, color: isWin ? "#4fd88a" : "#f2685f" }}>
                {marginText}
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

        {/* MVP card, bottom-right */}
        {mvp && (
          <div
            style={{
              position: "absolute",
              bottom: 48,
              right: 64,
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: "16px 24px",
              borderRadius: 16,
              background: "rgba(18,22,28,0.85)",
              border: "1px solid #262d38",
            }}
          >
            {mvpAvatar ? (
              <img
                src={mvpAvatar}
                width={64}
                height={64}
                style={{ borderRadius: 10, objectFit: "cover" }}
                alt=""
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  width: 64,
                  height: 64,
                  borderRadius: 10,
                  background: "#181d25",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  color: "#5b6474",
                  fontWeight: 700,
                }}
              >
                {mvp.display_name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 16, fontWeight: 700, color: "#a9f14f", letterSpacing: 1, marginBottom: 4 }}>
                WILD MVP
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {mvpAgentIcon && (
                  <img src={mvpAgentIcon} width={22} height={22} alt="" />
                )}
                <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#e7ebf1" }}>
                  {mvp.display_name}
                </div>
                <div style={{ display: "flex", fontSize: 20, color: "#8b95a6" }}>
                  {mvp.acs !== null ? `${Math.round(mvp.acs)} ACS` : ""}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
