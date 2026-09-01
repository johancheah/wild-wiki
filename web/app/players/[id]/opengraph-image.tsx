import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { supabase } from "@/lib/supabase";
import { agentIcon } from "@/lib/assets";

// nodejs (not the edge runtime default for this convention) so we can read
// the headshot/logo straight off disk via fs rather than round-tripping
// through our own deployed origin, which isn't knowable from inside this
// handler.
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "WILD Gaming player card";

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

  const [{ data: careerRows }, { data: agentRows }, logoSrc] = await Promise.all([
    supabase.from("v_player_career").select("*").eq("player_id", id),
    supabase.from("v_player_agent_pool").select("agent, n").eq("player_id", id).order("n", { ascending: false }).limit(1),
    fileDataUri("logo.png"),
  ]);

  const player = careerRows?.[0];
  const topAgent = agentRows?.[0] as { agent: string; n: number } | undefined;

  const avatarSrc = player?.headshot_filename ? await fileDataUri(`headshots/${player.headshot_filename}`) : null;
  const agentIconSrc = topAgent ? agentIcon(topAgent.agent) : null;

  const name = player?.display_name ?? "Unknown Player";
  const matches = player?.matches_played ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#0c0f13",
          fontFamily: "sans-serif",
        }}
      >
        {/* Left: avatar panel */}
        <div
          style={{
            width: 460,
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#12161c",
            position: "relative",
          }}
        >
          {avatarSrc ? (
            <img
              src={avatarSrc}
              width={460}
              height={630}
              style={{ objectFit: "cover" }}
              alt=""
            />
          ) : (
            <div style={{ display: "flex", fontSize: 160, color: "#5b6474", fontWeight: 700 }}>
              {name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(90deg, rgba(12,15,19,0) 60%, rgba(12,15,19,1) 100%)",
              display: "flex",
            }}
          />
        </div>

        {/* Right: name + stats */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 64px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            {logoSrc && (
              <img src={logoSrc} width={40} height={40} alt="" />
            )}
            <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: "#a9f14f", letterSpacing: 2 }}>
              WILD GAMING
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 72, fontWeight: 800, color: "#e7ebf1", marginBottom: 40 }}>
            {name}
          </div>

          <div style={{ display: "flex", gap: 48 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 20, color: "#5b6474", letterSpacing: 1, marginBottom: 8 }}>
                MATCHES PLAYED
              </div>
              <div style={{ display: "flex", fontSize: 48, fontWeight: 700, color: "#e7ebf1" }}>{matches}</div>
            </div>

            {topAgent && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 20, color: "#5b6474", letterSpacing: 1, marginBottom: 8 }}>
                  MOST PLAYED AGENT
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {agentIconSrc && (
                    <img src={agentIconSrc} width={48} height={48} alt="" />
                  )}
                  <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#e7ebf1" }}>
                    {topAgent.agent}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
