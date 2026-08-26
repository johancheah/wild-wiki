import { agentIcon, headshotUrl } from "@/lib/assets";
import type { CompAgent } from "@/lib/comps";

// Mirrors src/wild_tracker/templates/macros.html::comp_agent — agent icon,
// with a hover preview of the player who played it. comp-agent-gap adds a
// fixed margin-left when this icon starts a new role group, so the gap
// between classes is always the same pixel value.
export function CompAgentIcon({ a }: { a: CompAgent }) {
  const icon = agentIcon(a.agent);
  const hs = headshotUrl(a.headshot_filename);
  return (
    <span
      className={`comp-agent ${a.gap_before ? "comp-agent-gap" : ""}`}
      data-headshot={hs ?? undefined}
      data-name={hs ? a.display_name : undefined}
    >
      {icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="agent-icon-only" src={icon} alt={a.agent ?? ""} />
      )}
    </span>
  );
}
