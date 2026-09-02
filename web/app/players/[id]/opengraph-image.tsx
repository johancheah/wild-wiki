import { ImageResponse } from "next/og";
import { supabase } from "@/lib/supabase";
import { agentIcon } from "@/lib/assets";
import { fileDataUri } from "@/lib/ogAssets";

// nodejs (not the edge runtime default for this convention) so we can read
// the headshot/logo straight off disk via fs rather than round-tripping
// through our own deployed origin, which isn't knowable from inside this
// handler.
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "WILD Gaming player card";

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
  const acs = player?.acs;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0c0f13",
          fontFamily: "sans-serif",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {logoSrc && (
            <img src={logoSrc} width={36} height={36} alt="" />
          )}
          <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: "#a9f14f", letterSpacing: 2 }}>
            WILD GAMING
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 36, marginTop: 44 }}>
          {avatarSrc ? (
            <img
              src={avatarSrc}
              width={220}
              height={220}
              style={{ borderRadius: 32, objectFit: "cover", border: "2px solid #262d38" }}
              alt=""
            />
          ) : (
            <div
              style={{
                display: "flex",
                width: 220,
                height: 220,
                borderRadius: 32,
                background: "#12161c",
                border: "2px solid #262d38",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 88,
                color: "#5b6474",
                fontWeight: 700,
              }}
            >
              {name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800, color: "#e7ebf1" }}>{name}</div>
        </div>

        <div style={{ display: "flex", gap: 56, marginTop: 56 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 20, color: "#5b6474", letterSpacing: 1, marginBottom: 8 }}>
              MATCHES PLAYED
            </div>
            <div style={{ display: "flex", fontSize: 48, fontWeight: 700, color: "#e7ebf1" }}>{matches}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 20, color: "#5b6474", letterSpacing: 1, marginBottom: 8 }}>
              ACS
            </div>
            <div style={{ display: "flex", fontSize: 48, fontWeight: 700, color: "#e7ebf1" }}>
              {acs !== null && acs !== undefined ? Math.round(acs) : "—"}
            </div>
          </div>

          {topAgent && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 20, color: "#5b6474", letterSpacing: 1, marginBottom: 8 }}>
                MOST PLAYED AGENT
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {agentIconSrc && (
                  <img src={agentIconSrc} width={44} height={44} alt="" />
                )}
                <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: "#e7ebf1" }}>
                  {topAgent.agent}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
