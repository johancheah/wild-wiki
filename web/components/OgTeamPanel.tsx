// Shared "WILD roster" panel for the match and match-week opengraph-image
// routes — a frosted card listing every WILD player who played (not just
// the MVP), with the top-ACS row picked out via a small crown badge + green
// left border rather than being the only player shown. Rows must arrive
// pre-resolved (avatar/agent icon already fetched to data: URIs, or CDN
// URLs) since this renders inside a satori tree with no async of its own.
export type OgRosterRow = {
  player_id: string;
  display_name: string;
  avatarSrc: string | null;
  agentIconSrc: string | null;
  acs: number | null;
};

export function OgTeamPanel({ title, rows }: { title: string; rows: OgRosterRow[] }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 130,
        right: 64,
        width: 380,
        display: "flex",
        flexDirection: "column",
        borderRadius: 16,
        background: "rgba(18,22,28,0.88)",
        border: "1px solid #262d38",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 14,
          fontWeight: 700,
          color: "#a9f14f",
          letterSpacing: 1.5,
          padding: "14px 18px",
          borderBottom: "1px solid #262d38",
        }}
      >
        {title}
      </div>
      {rows.map((r, i) => (
        <div
          key={r.player_id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 18px",
            borderBottom: i === rows.length - 1 ? "none" : "1px solid #1c2129",
            borderLeft: i === 0 ? "3px solid #a9f14f" : "3px solid transparent",
            background: i === 0 ? "rgba(169,241,79,0.06)" : "transparent",
          }}
        >
          {r.avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={r.avatarSrc}
              width={38}
              height={38}
              style={{ borderRadius: 8, objectFit: "cover" }}
              alt=""
            />
          ) : (
            <div
              style={{
                display: "flex",
                width: 38,
                height: 38,
                borderRadius: 8,
                background: "#181d25",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                color: "#5b6474",
                fontWeight: 700,
              }}
            >
              {r.display_name.slice(0, 2).toUpperCase()}
            </div>
          )}
          {r.agentIconSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.agentIconSrc} width={20} height={20} alt="" />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
            <div style={{ display: "flex", fontSize: 17, fontWeight: 700, color: "#e7ebf1" }}>{r.display_name}</div>
            {i === 0 && (
              <div
                style={{
                  display: "flex",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  color: "#a9f14f",
                  padding: "2px 7px",
                  borderRadius: 6,
                  background: "rgba(169,241,79,0.16)",
                  border: "1px solid #5d7a2f",
                }}
              >
                MVP
              </div>
            )}
          </div>
          <div style={{ display: "flex", fontSize: 16, fontWeight: 700, color: "#8b95a6" }}>
            {r.acs !== null ? Math.round(r.acs) : "—"}
          </div>
        </div>
      ))}
    </div>
  );
}
